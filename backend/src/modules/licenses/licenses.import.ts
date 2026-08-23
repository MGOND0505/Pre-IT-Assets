import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { parseSpreadsheet, findColumn } from "../../utils/spreadsheet";
import { License, LICENSE_STATUSES, type LicenseStatus } from "../../models/License";
import { Vendor } from "../../models/Vendor";
import { Department } from "../../models/Department";
import { User } from "../../models/User";
import { logAction } from "../audit/audit.service";
import * as licensesService from "./licenses.service";

type ImportMode = "catalog" | "per-user";

function resolveMode(value: unknown): ImportMode {
  return value === "per-user" ? "per-user" : "catalog";
}

type MappedFields = {
  softwareName: string;
  productName: string;
  publisher: string;
  licenseType: string;
  vendorName: string;
  departmentName: string;
  purchaseDate: string;
  expiryDate: string;
  totalLicenses: string;
  costPerLicense: string;
  status: string;
  poNumber: string;
  invoiceNumber: string;
  notes: string;
};

export type MappedLicenseRow = {
  rowIndex: number;
  mapped: MappedFields;
  classification: "new" | "duplicate" | "invalid";
  reason?: string;
  duplicateLicenseId?: string;
};

function isBlank(value: string): boolean {
  return !value || value.trim() === "" || value.trim().toUpperCase() === "N/A";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDateOrUndefined(value: string): Date | undefined {
  if (isBlank(value)) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function mapStatus(raw: string): LicenseStatus {
  if (/expir/i.test(raw)) return "Expired";
  if (/cancel/i.test(raw)) return "Cancelled";
  return (LICENSE_STATUSES as readonly string[]).includes(raw) ? (raw as LicenseStatus) : "Active";
}

function mapRow(row: Record<string, string>): MappedFields {
  return {
    softwareName: findColumn(row, ["Software Name", "Software", "Product", "License Name"]),
    productName: findColumn(row, ["Product Name", "Product"]),
    publisher: findColumn(row, ["Publisher", "Vendor Name", "Vendor"]),
    licenseType: findColumn(row, ["License Type", "Type"]),
    vendorName: findColumn(row, ["Vendor Name", "Vendor"]),
    departmentName: findColumn(row, ["Department"]),
    purchaseDate: findColumn(row, ["Purchase Date", "Purchase date"]),
    expiryDate: findColumn(row, ["Expiry Date", "Expiry", "Valid Till", "Renewal Date"]),
    totalLicenses: findColumn(row, ["Total Licenses", "Quantity", "Qty", "Seats"]),
    costPerLicense: findColumn(row, ["Cost Per License", "Cost", "Price"]),
    status: findColumn(row, ["Status"]),
    poNumber: findColumn(row, ["PO Number", "PO No"]),
    invoiceNumber: findColumn(row, ["Invoice Number", "Invoice No"]),
    notes: findColumn(row, ["Notes", "Remarks"]),
  };
}

async function classifyRows(rawRows: Record<string, string>[]): Promise<MappedLicenseRow[]> {
  const existing = await License.find({ isDeleted: false }).select("licenseId softwareName");
  const existingByName = new Map(existing.map((l) => [l.softwareName.toLowerCase(), l.licenseId]));
  const seen = new Set<string>();

  return rawRows.map((row, rowIndex) => {
    const mapped = mapRow(row);
    const key = mapped.softwareName.toLowerCase();

    let classification: MappedLicenseRow["classification"] = "new";
    let reason: string | undefined;
    let duplicateLicenseId: string | undefined;

    if (isBlank(mapped.softwareName)) {
      classification = "invalid";
      reason = "No software name column found for this row";
    } else if (existingByName.has(key) || seen.has(key)) {
      classification = "duplicate";
      duplicateLicenseId = existingByName.get(key);
      reason = "A license for this software already exists";
    }

    if (!isBlank(mapped.softwareName)) seen.add(key);

    return { rowIndex, mapped, classification, reason, duplicateLicenseId };
  });
}

// --- Per-user assignment mode: one row per employee per software (real-world license
// export shape - e.g. "who has an AutoCAD LT seat", not "what license records exist").
// Rows are grouped by software name into one license-to-be-created per distinct software,
// with the seat count and assignedUsers derived from the group's rows.

export type MappedLicenseGroup = {
  softwareName: string;
  seatCount: number;
  emails: string[];
  resolvedUserIds: string[];
  unresolvedEmails: string[];
  classification: "new" | "duplicate" | "invalid";
  reason?: string;
  duplicateLicenseId?: string;
};

function splitSoftwareNames(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim())
    .filter(Boolean);
}

async function classifyPerUserRows(rawRows: Record<string, string>[]): Promise<MappedLicenseGroup[]> {
  const existing = await License.find({ isDeleted: false }).select("licenseId softwareName");
  const existingByName = new Map(existing.map((l) => [l.softwareName.toLowerCase(), l.licenseId]));

  const groups = new Map<string, { displayName: string; emails: string[] }>();
  for (const row of rawRows) {
    const email = findColumn(row, ["Email", "Email Id", "Email Address"]);
    const rawSoftware = findColumn(row, [
      "Type of License",
      "offering_name",
      "License Name",
      "Software",
      "Software Name",
    ]);
    if (isBlank(rawSoftware)) continue;

    for (const name of splitSoftwareNames(rawSoftware)) {
      const key = name.toLowerCase();
      if (!groups.has(key)) groups.set(key, { displayName: name, emails: [] });
      if (!isBlank(email)) groups.get(key)!.emails.push(email.toLowerCase().trim());
    }
  }

  const allEmails = [...new Set([...groups.values()].flatMap((g) => g.emails))];
  const users = allEmails.length > 0 ? await User.find({ email: { $in: allEmails } }).select("email") : [];
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  const result: MappedLicenseGroup[] = [];
  for (const [key, group] of groups) {
    const uniqueEmails = [...new Set(group.emails)];
    const resolvedUserIds = uniqueEmails.filter((e) => userByEmail.has(e)).map((e) => String(userByEmail.get(e)!._id));
    const unresolvedEmails = uniqueEmails.filter((e) => !userByEmail.has(e));

    let classification: MappedLicenseGroup["classification"] = "new";
    let reason: string | undefined;
    let duplicateLicenseId: string | undefined;

    if (existingByName.has(key)) {
      classification = "duplicate";
      duplicateLicenseId = existingByName.get(key);
      reason = "A license for this software already exists";
    }

    result.push({
      softwareName: group.displayName,
      seatCount: uniqueEmails.length,
      emails: uniqueEmails,
      resolvedUserIds,
      unresolvedEmails,
      classification,
      reason,
      duplicateLicenseId,
    });
  }

  return result;
}

export const previewLicenseImport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const mode = resolveMode(req.query.mode);
  const rawRows = parseSpreadsheet(req.file.buffer);
  if (rawRows.length === 0) throw new ApiError(400, "The file has no data rows");

  if (mode === "per-user") {
    const groups = await classifyPerUserRows(rawRows);
    const counts = {
      total: groups.length,
      new: groups.filter((g) => g.classification === "new").length,
      duplicate: groups.filter((g) => g.classification === "duplicate").length,
      invalid: groups.filter((g) => g.classification === "invalid").length,
    };
    ok(res, { mode, counts, groups }, "Import preview");
    return;
  }

  const rows = await classifyRows(rawRows);
  const counts = {
    total: rows.length,
    new: rows.filter((r) => r.classification === "new").length,
    duplicate: rows.filter((r) => r.classification === "duplicate").length,
    invalid: rows.filter((r) => r.classification === "invalid").length,
  };

  ok(res, { mode, counts, rows }, "Import preview");
});

async function findOrCreateVendor(name: string) {
  if (isBlank(name)) return null;
  const existing = await Vendor.findOne({ name: new RegExp(`^${escapeRegExp(name.trim())}$`, "i") });
  if (existing) return existing;
  return Vendor.create({ name: name.trim() });
}

async function findOrCreateDepartment(name: string) {
  if (isBlank(name)) return null;
  const existing = await Department.findOne({ name: new RegExp(`^${escapeRegExp(name.trim())}$`, "i") });
  if (existing) return existing;
  return Department.create({ name: name.trim() });
}

export const confirmLicenseImport = asyncHandler(async (req: Request, res: Response) => {
  const mode = resolveMode(req.body.mode);

  if (mode === "per-user") {
    const groups = (req.body.groups as MappedLicenseGroup[]) ?? [];
    const toImport = groups.filter((g) => g.classification === "new");

    let created = 0;
    const errors: string[] = [];

    for (const group of toImport) {
      try {
        await licensesService.createLicense(
          {
            softwareName: group.softwareName,
            totalLicenses: group.seatCount || 1,
            assignedUsers: group.resolvedUserIds as never,
            status: "Active",
            notes:
              group.unresolvedEmails.length > 0
                ? `${group.unresolvedEmails.length} assignee(s) from the import had no matching user account: ${group.unresolvedEmails.join(", ")}`
                : "",
          },
          req.user!.id
        );
        created += 1;
      } catch (err) {
        errors.push(`${group.softwareName}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }

    await logAction({
      req,
      action: "IMPORT",
      module: "License",
      recordLabel: `${created} license(s) imported (per-user mode)`,
      newValue: { created, skipped: groups.length - toImport.length, errors: errors.length },
    });

    ok(res, { created, skipped: groups.length - toImport.length, errors }, "Import complete");
    return;
  }

  const rows = (req.body.rows as MappedLicenseRow[]) ?? [];
  const toImport = rows.filter((r) => r.classification === "new");

  let created = 0;
  const errors: string[] = [];

  for (const row of toImport) {
    try {
      const [vendor, department] = await Promise.all([
        findOrCreateVendor(row.mapped.vendorName),
        findOrCreateDepartment(row.mapped.departmentName),
      ]);

      await licensesService.createLicense(
        {
          softwareName: row.mapped.softwareName,
          productName: row.mapped.productName,
          publisher: row.mapped.publisher,
          vendor: vendor ? (String(vendor._id) as never) : null,
          department: department ? (String(department._id) as never) : null,
          purchaseDate: parseDateOrUndefined(row.mapped.purchaseDate) ?? null,
          expiryDate: parseDateOrUndefined(row.mapped.expiryDate) ?? null,
          totalLicenses: row.mapped.totalLicenses ? Number(row.mapped.totalLicenses.replace(/[^0-9]/g, "")) || 1 : 1,
          costPerLicense: row.mapped.costPerLicense
            ? Number(row.mapped.costPerLicense.replace(/[^0-9.]/g, "")) || null
            : null,
          status: mapStatus(row.mapped.status),
          poNumber: row.mapped.poNumber,
          invoiceNumber: row.mapped.invoiceNumber,
          notes: row.mapped.notes,
        },
        req.user!.id
      );
      created += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  await logAction({
    req,
    action: "IMPORT",
    module: "License",
    recordLabel: `${created} license(s) imported`,
    newValue: { created, skipped: rows.length - toImport.length, errors: errors.length },
  });

  ok(res, { created, skipped: rows.length - toImport.length, errors }, "Import complete");
});
