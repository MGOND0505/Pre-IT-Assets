import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { parseSpreadsheet, findColumn } from "../../utils/spreadsheet";
import { Vendor, type IVendor } from "../../models/Vendor";
import { logAction } from "../audit/audit.service";
import * as vendorsService from "./vendors.service";

/** Canonical column headers - what "Download template" hands back. */
export const VENDOR_IMPORT_TEMPLATE_COLUMNS = [
  "Name",
  "Contact Person",
  "Email",
  "Phone",
  "Service",
  "Address",
  "Contract Start",
  "Contract End",
  "Status",
  "Notes",
];

type MappedFields = {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  service: string;
  address: string;
  contractStart: string;
  contractEnd: string;
  status: string;
  notes: string;
};

export type MappedVendorRow = {
  rowIndex: number;
  mapped: MappedFields;
  classification: "new" | "updated" | "duplicate" | "invalid";
  reason?: string;
  existingId?: string;
};

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim() === "";
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

function mapStatus(raw: string): "Active" | "Inactive" {
  return /inactive/i.test(raw) ? "Inactive" : "Active";
}

function mapRow(row: Record<string, string>): MappedFields {
  return {
    name: findColumn(row, ["Name", "Vendor Name"]),
    contactPerson: findColumn(row, ["Contact Person", "Contact"]),
    email: findColumn(row, ["Email", "Email ID"]),
    phone: findColumn(row, ["Phone", "Phone Number"]),
    service: findColumn(row, ["Service", "Service Type"]),
    address: findColumn(row, ["Address"]),
    contractStart: findColumn(row, ["Contract Start", "Contract Start Date"]),
    contractEnd: findColumn(row, ["Contract End", "Contract End Date"]),
    status: findColumn(row, ["Status"]),
    notes: findColumn(row, ["Notes", "Remarks"]),
  };
}

const STRING_DIFF_FIELDS: (keyof MappedFields & keyof IVendor)[] = [
  "contactPerson",
  "email",
  "phone",
  "service",
  "address",
  "notes",
];

/** Only compares fields the row actually provides - a blank cell means "leave unchanged", not "clear this field". */
function diffAgainstExisting(mapped: MappedFields, existing: IVendor): string[] {
  const changed: string[] = [];

  for (const field of STRING_DIFF_FIELDS) {
    const incoming = mapped[field] as string;
    const current = existing[field] as string;
    if (!isBlank(incoming) && normalize(incoming) !== normalize(current)) changed.push(field);
  }

  if (!isBlank(mapped.status) && mapStatus(mapped.status) !== existing.status) changed.push("status");
  if (!isBlank(mapped.contractStart) && dateToDayString(parseDateOrUndefined(mapped.contractStart) ?? null) !== dateToDayString(existing.contractStart)) {
    changed.push("contractStart");
  }
  if (!isBlank(mapped.contractEnd) && dateToDayString(parseDateOrUndefined(mapped.contractEnd) ?? null) !== dateToDayString(existing.contractEnd)) {
    changed.push("contractEnd");
  }

  return changed;
}

function hasAnyRecognizableColumn(rawRows: Record<string, string>[]): boolean {
  return rawRows.some((row) => !isBlank(mapRow(row).name));
}

async function classifyRows(rawRows: Record<string, string>[], organizationId: string): Promise<MappedVendorRow[]> {
  const existingVendors = await Vendor.find({ organization: organizationId, isDeleted: false });
  const byName = new Map(existingVendors.map((v) => [v.name.toLowerCase(), v]));

  const seenInFile = new Set<string>();

  return rawRows.map((row, rowIndex) => {
    const mapped = mapRow(row);
    const nameKey = normalize(mapped.name);
    const existing = nameKey ? byName.get(nameKey) : undefined;

    let classification: MappedVendorRow["classification"];
    let reason: string | undefined;
    let existingId: string | undefined;

    if (isBlank(mapped.name)) {
      classification = "invalid";
      reason = "Missing vendor name";
    } else if (existing) {
      existingId = String(existing._id);
      const changedFields = diffAgainstExisting(mapped, existing);

      if (seenInFile.has(nameKey)) {
        classification = "duplicate";
        reason = "This vendor appears more than once in this file";
      } else if (changedFields.length > 0) {
        classification = "updated";
        reason = `${changedFields.length} field(s) will change: ${changedFields.join(", ")}`;
      } else {
        classification = "duplicate";
        reason = "No changes from the existing record";
      }
    } else if (seenInFile.has(nameKey)) {
      classification = "duplicate";
      reason = "This vendor appears more than once in this file";
    } else {
      classification = "new";
    }

    if (nameKey) seenInFile.add(nameKey);

    return { rowIndex, mapped, classification, reason, existingId };
  });
}

export const previewVendorImport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const rawRows = parseSpreadsheet(req.file.buffer);
  if (rawRows.length === 0) throw new ApiError(400, "The file has no data rows");
  if (!hasAnyRecognizableColumn(rawRows)) {
    throw new ApiError(400, "This file doesn't look like a vendor CSV - no Name column was found. Try the template.");
  }

  const rows = await classifyRows(rawRows, req.organization!._id);
  const counts = {
    total: rows.length,
    new: rows.filter((r) => r.classification === "new").length,
    updated: rows.filter((r) => r.classification === "updated").length,
    duplicate: rows.filter((r) => r.classification === "duplicate").length,
    invalid: rows.filter((r) => r.classification === "invalid").length,
  };

  ok(res, { counts, rows }, "Import preview");
});

/** Builds a payload containing only the fields the row actually provides (blank = leave unchanged
 * on update; always applied verbatim on create, since a fresh row has no "unchanged" ambiguity). */
function buildPayload(mapped: MappedFields, isCreate: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const field of STRING_DIFF_FIELDS) {
    const value = mapped[field] as string;
    if (isCreate || !isBlank(value)) payload[field] = value;
  }

  if (isCreate || !isBlank(mapped.status)) payload.status = mapStatus(mapped.status);
  if (isCreate || !isBlank(mapped.contractStart)) payload.contractStart = parseDateOrUndefined(mapped.contractStart) ?? null;
  if (isCreate || !isBlank(mapped.contractEnd)) payload.contractEnd = parseDateOrUndefined(mapped.contractEnd) ?? null;

  return payload;
}

export const confirmVendorImport = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const rows = (req.body.rows as MappedVendorRow[]) ?? [];
  const newRows = rows.filter((r) => r.classification === "new");
  const updatedRows = rows.filter((r) => r.classification === "updated");
  const duplicates = rows.filter((r) => r.classification === "duplicate").length;
  const invalid = rows.filter((r) => r.classification === "invalid").length;

  let added = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of newRows) {
    try {
      await vendorsService.createVendor({ name: row.mapped.name, ...buildPayload(row.mapped, true) } as never, organizationId);
      added += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  for (const row of updatedRows) {
    try {
      if (!row.existingId) throw new Error("missing existing record reference");
      await vendorsService.updateVendor(row.existingId, buildPayload(row.mapped, false) as never, organizationId);
      updated += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  await logAction({
    req,
    action: "IMPORT",
    module: "Vendor",
    recordLabel: `${added} added, ${updated} updated`,
    newValue: { total: rows.length, added, updated, duplicates, invalid, errors: errors.length },
  });

  ok(res, { total: rows.length, added, updated, duplicates, invalid, errors }, "Import complete");
});

export const downloadVendorTemplate = asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="vendor-import-template.csv"');
  res.send(VENDOR_IMPORT_TEMPLATE_COLUMNS.join(",") + "\n");
});
