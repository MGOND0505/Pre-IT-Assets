import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { parseSpreadsheet, findColumn } from "../../utils/spreadsheet";
import { License, LICENSE_STATUSES, type ILicense, type LicenseStatus } from "../../models/License";
import { Vendor } from "../../models/Vendor";
import { Department } from "../../models/Department";
import { User } from "../../models/User";
import { logAction } from "../audit/audit.service";
import { escapeRegex } from "../../utils/regex";
import * as licensesService from "./licenses.service";

type ImportMode = "catalog" | "per-user";

function resolveMode(value: unknown): ImportMode {
  return value === "per-user" ? "per-user" : "catalog";
}

/** Canonical column headers for "Download template" / "Download current data" (catalog mode). */
export const LICENSE_IMPORT_TEMPLATE_COLUMNS = [
  "License ID",
  "Software Name",
  "Product Name",
  "Publisher",
  "License Type",
  "Vendor",
  "Department",
  "Purchase Date",
  "Expiry Date",
  "Total Licenses",
  "Cost Per License",
  "Status",
  "PO Number",
  "Invoice Number",
  "Notes",
];

type MappedFields = {
  licenseIdRaw: string;
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
  classification: "new" | "updated" | "duplicate" | "invalid";
  reason?: string;
  existingId?: string;
  existingLicenseId?: string;
  changedFields?: string[];
};

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim() === "" || value.trim().toUpperCase() === "N/A";
}

function normalize(value: string | null | undefined): string {
  return isBlank(value) ? "" : value!.trim().toLowerCase();
}

function parseDateOrUndefined(value: string): Date | undefined {
  if (isBlank(value)) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function dateToDayString(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function parseNumberOrNull(value: string): number | null {
  if (isBlank(value)) return null;
  const num = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) && value.replace(/[^0-9.]/g, "") !== "" ? num : null;
}

function mapStatus(raw: string): LicenseStatus {
  if (/expir/i.test(raw)) return "Expired";
  if (/cancel/i.test(raw)) return "Cancelled";
  return (LICENSE_STATUSES as readonly string[]).includes(raw) ? (raw as LicenseStatus) : "Active";
}

function mapRow(row: Record<string, string>): MappedFields {
  return {
    licenseIdRaw: findColumn(row, ["License ID", "LicenseId"]),
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

type ExistingLicense = ILicense & {
  _id: unknown;
  vendor?: { name?: string } | null;
  department?: { name?: string } | null;
};

function diffAgainstExisting(mapped: MappedFields, existing: ExistingLicense): string[] {
  const changed: string[] = [];

  const stringChecks: [string, string, string | undefined][] = [
    ["softwareName", mapped.softwareName, existing.softwareName],
    ["productName", mapped.productName, existing.productName],
    ["publisher", mapped.publisher, existing.publisher],
    ["licenseType", mapped.licenseType, existing.licenseType],
    ["vendorName", mapped.vendorName, existing.vendor?.name],
    ["departmentName", mapped.departmentName, existing.department?.name],
    ["poNumber", mapped.poNumber, existing.poNumber],
    ["invoiceNumber", mapped.invoiceNumber, existing.invoiceNumber],
    ["notes", mapped.notes, existing.notes],
  ];
  for (const [field, incoming, current] of stringChecks) {
    if (!isBlank(incoming) && normalize(incoming) !== normalize(current)) changed.push(field);
  }

  if (!isBlank(mapped.status) && mapStatus(mapped.status) !== existing.status) changed.push("status");
  if (!isBlank(mapped.purchaseDate) && dateToDayString(parseDateOrUndefined(mapped.purchaseDate) ?? null) !== dateToDayString(existing.purchaseDate)) {
    changed.push("purchaseDate");
  }
  if (!isBlank(mapped.expiryDate) && dateToDayString(parseDateOrUndefined(mapped.expiryDate) ?? null) !== dateToDayString(existing.expiryDate)) {
    changed.push("expiryDate");
  }
  if (!isBlank(mapped.totalLicenses) && parseNumberOrNull(mapped.totalLicenses) !== existing.totalLicenses) changed.push("totalLicenses");
  if (!isBlank(mapped.costPerLicense) && parseNumberOrNull(mapped.costPerLicense) !== existing.costPerLicense) changed.push("costPerLicense");

  return changed;
}

function hasAnyRecognizableColumn(rawRows: Record<string, string>[]): boolean {
  return rawRows.some((row) => {
    const mapped = mapRow(row);
    return !isBlank(mapped.softwareName) || !isBlank(mapped.licenseIdRaw);
  });
}

async function classifyRows(organizationId: string, rawRows: Record<string, string>[]): Promise<MappedLicenseRow[]> {
  const existingLicenses = (await License.find({ organization: organizationId, isDeleted: false }).populate([
    { path: "vendor", select: "name" },
    { path: "department", select: "name" },
  ])) as unknown as ExistingLicense[];

  const byLicenseId = new Map(existingLicenses.map((l) => [l.licenseId.toLowerCase(), l]));
  const byName = new Map(existingLicenses.map((l) => [l.softwareName.toLowerCase(), l]));

  const seenInFile = new Set<string>();

  return rawRows.map((row, rowIndex) => {
    const mapped = mapRow(row);
    const idKey = normalize(mapped.licenseIdRaw);
    const nameKey = normalize(mapped.softwareName);

    const existing = (idKey && byLicenseId.get(idKey)) || (nameKey && byName.get(nameKey));
    const fileKey = idKey || nameKey;

    let classification: MappedLicenseRow["classification"];
    let reason: string | undefined;
    let existingId: string | undefined;
    let existingLicenseId: string | undefined;
    let changedFields: string[] | undefined;

    if (isBlank(mapped.softwareName) && !existing) {
      classification = "invalid";
      reason = "No software name column found for this row";
    } else if (existing) {
      existingId = String(existing._id);
      existingLicenseId = existing.licenseId;
      changedFields = diffAgainstExisting(mapped, existing);

      if (fileKey && seenInFile.has(fileKey)) {
        classification = "duplicate";
        reason = "This license appears more than once in this file";
      } else if (changedFields.length > 0) {
        classification = "updated";
        reason = `${changedFields.length} field(s) will change: ${changedFields.join(", ")}`;
      } else {
        classification = "duplicate";
        reason = "No changes from the existing record";
      }
    } else {
      classification = "new";
    }

    if (fileKey) seenInFile.add(fileKey);

    return { rowIndex, mapped, classification, reason, existingId, existingLicenseId, changedFields };
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
  classification: "new" | "updated" | "duplicate" | "invalid";
  reason?: string;
  existingId?: string;
  existingLicenseId?: string;
};

function splitSoftwareNames(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim())
    .filter(Boolean);
}

async function classifyPerUserRows(organizationId: string, rawRows: Record<string, string>[]): Promise<MappedLicenseGroup[]> {
  const existingLicenses = (await License.find({ organization: organizationId, isDeleted: false })) as unknown as ExistingLicense[];
  const existingByName = new Map(existingLicenses.map((l) => [l.softwareName.toLowerCase(), l]));

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
  const users =
    allEmails.length > 0
      ? await User.find({ organization: organizationId, email: { $in: allEmails } }).select("email")
      : [];
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  const result: MappedLicenseGroup[] = [];
  for (const [key, group] of groups) {
    const uniqueEmails = [...new Set(group.emails)];
    const resolvedUserIds = uniqueEmails.filter((e) => userByEmail.has(e)).map((e) => String(userByEmail.get(e)!._id));
    const unresolvedEmails = uniqueEmails.filter((e) => !userByEmail.has(e));

    const existing = existingByName.get(key);
    let classification: MappedLicenseGroup["classification"] = "new";
    let reason: string | undefined;
    let existingId: string | undefined;
    let existingLicenseId: string | undefined;

    if (existing) {
      existingId = String(existing._id);
      existingLicenseId = existing.licenseId;
      const existingUserIds = new Set(existing.assignedUsers.map((id) => String(id)));
      const sameSeatCount = existing.totalLicenses === uniqueEmails.length;
      const sameAssignees =
        resolvedUserIds.length === existingUserIds.size && resolvedUserIds.every((id) => existingUserIds.has(id));

      if (sameSeatCount && sameAssignees) {
        classification = "duplicate";
        reason = "No changes from the existing record";
      } else {
        classification = "updated";
        reason = `Seat count/assignees changed (was ${existing.totalLicenses}, now ${uniqueEmails.length})`;
      }
    }

    result.push({
      softwareName: group.displayName,
      seatCount: uniqueEmails.length,
      emails: uniqueEmails,
      resolvedUserIds,
      unresolvedEmails,
      classification,
      reason,
      existingId,
      existingLicenseId,
    });
  }

  return result;
}

export const previewLicenseImport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const organizationId = req.organization!._id;
  const mode = resolveMode(req.query.mode);
  const rawRows = parseSpreadsheet(req.file.buffer);
  if (rawRows.length === 0) throw new ApiError(400, "The file has no data rows");

  if (mode === "per-user") {
    const groups = await classifyPerUserRows(organizationId, rawRows);
    const counts = {
      total: groups.length,
      new: groups.filter((g) => g.classification === "new").length,
      updated: groups.filter((g) => g.classification === "updated").length,
      duplicate: groups.filter((g) => g.classification === "duplicate").length,
      invalid: groups.filter((g) => g.classification === "invalid").length,
    };
    ok(res, { mode, counts, groups }, "Import preview");
    return;
  }

  if (!hasAnyRecognizableColumn(rawRows)) {
    throw new ApiError(
      400,
      "This file doesn't look like a license CSV - no recognizable columns (Software Name or License ID) were found. Try the template."
    );
  }

  const rows = await classifyRows(organizationId, rawRows);
  const counts = {
    total: rows.length,
    new: rows.filter((r) => r.classification === "new").length,
    updated: rows.filter((r) => r.classification === "updated").length,
    duplicate: rows.filter((r) => r.classification === "duplicate").length,
    invalid: rows.filter((r) => r.classification === "invalid").length,
  };

  ok(res, { mode, counts, rows }, "Import preview");
});

async function findOrCreateVendor(organizationId: string, name: string) {
  if (isBlank(name)) return null;
  const existing = await Vendor.findOne({
    organization: organizationId,
    name: new RegExp(`^${escapeRegex(name.trim())}$`, "i"),
  });
  if (existing) return existing;
  return Vendor.create({ organization: organizationId, name: name.trim() });
}

async function findOrCreateDepartment(organizationId: string, name: string) {
  if (isBlank(name)) return null;
  const existing = await Department.findOne({
    organization: organizationId,
    name: new RegExp(`^${escapeRegex(name.trim())}$`, "i"),
  });
  if (existing) return existing;
  return Department.create({ organization: organizationId, name: name.trim() });
}

async function buildPartialPayload(organizationId: string, mapped: MappedFields) {
  const payload: Record<string, unknown> = {};

  if (!isBlank(mapped.softwareName)) payload.softwareName = mapped.softwareName;
  if (!isBlank(mapped.productName)) payload.productName = mapped.productName;
  if (!isBlank(mapped.publisher)) payload.publisher = mapped.publisher;
  if (!isBlank(mapped.licenseType)) payload.licenseType = mapped.licenseType;
  if (!isBlank(mapped.purchaseDate)) payload.purchaseDate = parseDateOrUndefined(mapped.purchaseDate) ?? null;
  if (!isBlank(mapped.expiryDate)) payload.expiryDate = parseDateOrUndefined(mapped.expiryDate) ?? null;
  if (!isBlank(mapped.totalLicenses)) payload.totalLicenses = parseNumberOrNull(mapped.totalLicenses) || 1;
  if (!isBlank(mapped.costPerLicense)) payload.costPerLicense = parseNumberOrNull(mapped.costPerLicense);
  if (!isBlank(mapped.status)) payload.status = mapStatus(mapped.status);
  if (!isBlank(mapped.poNumber)) payload.poNumber = mapped.poNumber;
  if (!isBlank(mapped.invoiceNumber)) payload.invoiceNumber = mapped.invoiceNumber;
  if (!isBlank(mapped.notes)) payload.notes = mapped.notes;

  if (!isBlank(mapped.vendorName)) {
    const vendor = await findOrCreateVendor(organizationId, mapped.vendorName);
    payload.vendor = vendor ? String(vendor._id) : null;
  }
  if (!isBlank(mapped.departmentName)) {
    const department = await findOrCreateDepartment(organizationId, mapped.departmentName);
    payload.department = department ? String(department._id) : null;
  }

  return payload;
}

export const confirmLicenseImport = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const mode = resolveMode(req.body.mode);

  if (mode === "per-user") {
    const groups = (req.body.groups as MappedLicenseGroup[]) ?? [];
    const newGroups = groups.filter((g) => g.classification === "new");
    const updatedGroups = groups.filter((g) => g.classification === "updated");
    const duplicates = groups.filter((g) => g.classification === "duplicate").length;
    const invalid = groups.filter((g) => g.classification === "invalid").length;

    let added = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const group of newGroups) {
      try {
        await licensesService.createLicense(
          organizationId,
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
        added += 1;
      } catch (err) {
        errors.push(`${group.softwareName}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }

    for (const group of updatedGroups) {
      try {
        if (!group.existingId) throw new Error("missing existing record reference");
        await licensesService.updateLicense(organizationId, group.existingId, {
          totalLicenses: group.seatCount || 1,
          assignedUsers: group.resolvedUserIds as never,
        });
        updated += 1;
      } catch (err) {
        errors.push(`${group.softwareName}: ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }

    await logAction({
      req,
      action: "IMPORT",
      module: "License",
      recordLabel: `${added} added, ${updated} updated (per-user mode)`,
      newValue: { total: groups.length, added, updated, duplicates, invalid, errors: errors.length },
    });

    ok(res, { total: groups.length, added, updated, duplicates, invalid, errors }, "Import complete");
    return;
  }

  const rows = (req.body.rows as MappedLicenseRow[]) ?? [];
  const newRows = rows.filter((r) => r.classification === "new");
  const updatedRows = rows.filter((r) => r.classification === "updated");
  const duplicates = rows.filter((r) => r.classification === "duplicate").length;
  const invalid = rows.filter((r) => r.classification === "invalid").length;

  let added = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of newRows) {
    try {
      const [vendor, department] = await Promise.all([
        findOrCreateVendor(organizationId, row.mapped.vendorName),
        findOrCreateDepartment(organizationId, row.mapped.departmentName),
      ]);

      await licensesService.createLicense(
        organizationId,
        {
          softwareName: row.mapped.softwareName,
          productName: row.mapped.productName,
          publisher: row.mapped.publisher,
          vendor: vendor ? (String(vendor._id) as never) : null,
          department: department ? (String(department._id) as never) : null,
          purchaseDate: parseDateOrUndefined(row.mapped.purchaseDate) ?? null,
          expiryDate: parseDateOrUndefined(row.mapped.expiryDate) ?? null,
          totalLicenses: parseNumberOrNull(row.mapped.totalLicenses) || 1,
          costPerLicense: parseNumberOrNull(row.mapped.costPerLicense),
          status: mapStatus(row.mapped.status),
          poNumber: row.mapped.poNumber,
          invoiceNumber: row.mapped.invoiceNumber,
          notes: row.mapped.notes,
        },
        req.user!.id
      );
      added += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  for (const row of updatedRows) {
    try {
      if (!row.existingId) throw new Error("missing existing record reference");
      const payload = await buildPartialPayload(organizationId, row.mapped);
      await licensesService.updateLicense(organizationId, row.existingId, payload as never);
      updated += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  await logAction({
    req,
    action: "IMPORT",
    module: "License",
    recordLabel: `${added} added, ${updated} updated`,
    newValue: { total: rows.length, added, updated, duplicates, invalid, errors: errors.length },
  });

  ok(res, { total: rows.length, added, updated, duplicates, invalid, errors }, "Import complete");
});

export const downloadLicenseTemplate = asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="license-import-template.csv"');
  res.send(LICENSE_IMPORT_TEMPLATE_COLUMNS.join(",") + "\n");
});
