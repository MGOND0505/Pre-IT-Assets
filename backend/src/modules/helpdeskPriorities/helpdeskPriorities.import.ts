import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { parseSpreadsheet, findColumn } from "../../utils/spreadsheet";
import { HelpdeskPriority, type IHelpdeskPriority } from "../../models/HelpdeskPriority";
import { logAction } from "../audit/audit.service";
import { recordImportBatch, listImportBatches } from "../importHistory/importHistory.service";
import * as helpdeskPrioritiesService from "./helpdeskPriorities.service";

/** Canonical column headers - what "Download template" hands back. */
export const HELPDESK_PRIORITY_IMPORT_TEMPLATE_COLUMNS = [
  "Name",
  "Order",
  "Color",
  "SLA Response (minutes)",
  "SLA Resolution (minutes)",
];

const COLOR_PATTERN = /^#?[0-9A-Fa-f]{6}$/;

type MappedFields = {
  name: string;
  order: string;
  color: string;
  slaResponseMinutes: string;
  slaResolutionMinutes: string;
};

export type MappedHelpdeskPriorityRow = {
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

function normalizeColor(value: string): string {
  const trimmed = value.trim();
  return (trimmed.startsWith("#") ? trimmed : `#${trimmed}`).toUpperCase();
}

function parseIntOrUndefined(value: string): number | undefined {
  if (isBlank(value)) return undefined;
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parsePositiveIntOrUndefined(value: string): number | undefined {
  const parsed = parseIntOrUndefined(value);
  return parsed !== undefined && parsed >= 1 ? parsed : undefined;
}

function mapRow(row: Record<string, string>): MappedFields {
  return {
    name: findColumn(row, ["Name", "Priority Name"]),
    order: findColumn(row, ["Order"]),
    color: findColumn(row, ["Color"]),
    slaResponseMinutes: findColumn(row, ["SLA Response (minutes)", "SLA Response", "Response SLA"]),
    slaResolutionMinutes: findColumn(row, ["SLA Resolution (minutes)", "SLA Resolution", "Resolution SLA"]),
  };
}

/** Only compares fields the row actually provides - a blank cell means "leave unchanged", not "clear this field". */
function diffAgainstExisting(mapped: MappedFields, existing: IHelpdeskPriority): string[] {
  const changed: string[] = [];

  const order = parseIntOrUndefined(mapped.order);
  if (order !== undefined && order !== existing.order) changed.push("order");

  if (!isBlank(mapped.color) && normalizeColor(mapped.color) !== existing.color.toUpperCase()) changed.push("color");

  const response = parsePositiveIntOrUndefined(mapped.slaResponseMinutes);
  if (response !== undefined && response !== existing.slaResponseMinutes) changed.push("slaResponseMinutes");

  const resolution = parsePositiveIntOrUndefined(mapped.slaResolutionMinutes);
  if (resolution !== undefined && resolution !== existing.slaResolutionMinutes) changed.push("slaResolutionMinutes");

  return changed;
}

function hasAnyRecognizableColumn(rawRows: Record<string, string>[]): boolean {
  return rawRows.some((row) => !isBlank(mapRow(row).name));
}

async function classifyRows(rawRows: Record<string, string>[], organizationId: string): Promise<MappedHelpdeskPriorityRow[]> {
  const existingPriorities = await HelpdeskPriority.find({ organization: organizationId, isDeleted: false });
  const byName = new Map(existingPriorities.map((p) => [p.name.toLowerCase(), p]));

  const seenInFile = new Set<string>();

  return rawRows.map((row, rowIndex) => {
    const mapped = mapRow(row);
    const nameKey = normalize(mapped.name);
    const existing = nameKey ? byName.get(nameKey) : undefined;
    const isNewRecord = !existing;

    let classification: MappedHelpdeskPriorityRow["classification"];
    let reason: string | undefined;
    let existingId: string | undefined;

    if (isBlank(mapped.name)) {
      classification = "invalid";
      reason = "Missing priority name";
    } else if (!isBlank(mapped.order) && parseIntOrUndefined(mapped.order) === undefined) {
      classification = "invalid";
      reason = "Order must be a whole number";
    } else if (!isBlank(mapped.color) && !COLOR_PATTERN.test(mapped.color.trim())) {
      classification = "invalid";
      reason = "Color must be a hex value like #0080F0";
    } else if (
      (isNewRecord && isBlank(mapped.slaResponseMinutes)) ||
      (!isBlank(mapped.slaResponseMinutes) && parsePositiveIntOrUndefined(mapped.slaResponseMinutes) === undefined)
    ) {
      classification = "invalid";
      reason = "SLA Response (minutes) must be a positive whole number";
    } else if (
      (isNewRecord && isBlank(mapped.slaResolutionMinutes)) ||
      (!isBlank(mapped.slaResolutionMinutes) && parsePositiveIntOrUndefined(mapped.slaResolutionMinutes) === undefined)
    ) {
      classification = "invalid";
      reason = "SLA Resolution (minutes) must be a positive whole number";
    } else if (existing) {
      existingId = String(existing._id);
      const changedFields = diffAgainstExisting(mapped, existing);

      if (seenInFile.has(nameKey)) {
        classification = "duplicate";
        reason = "This priority appears more than once in this file";
      } else if (changedFields.length > 0) {
        classification = "updated";
        reason = `${changedFields.length} field(s) will change: ${changedFields.join(", ")}`;
      } else {
        classification = "duplicate";
        reason = "No changes from the existing record";
      }
    } else if (seenInFile.has(nameKey)) {
      classification = "duplicate";
      reason = "This priority appears more than once in this file";
    } else {
      classification = "new";
    }

    if (nameKey) seenInFile.add(nameKey);

    return { rowIndex, mapped, classification, reason, existingId };
  });
}

export const previewHelpdeskPriorityImport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const rawRows = parseSpreadsheet(req.file.buffer);
  if (rawRows.length === 0) throw new ApiError(400, "The file has no data rows");
  if (!hasAnyRecognizableColumn(rawRows)) {
    throw new ApiError(400, "This file doesn't look like a priority CSV - no Name column was found. Try the template.");
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
 * on update; for a create, classifyRows already rejected any row missing a required SLA field as
 * "invalid", so both SLA fields are guaranteed present here whenever this is a new row). */
function buildPayload(mapped: MappedFields): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  const order = parseIntOrUndefined(mapped.order);
  if (order !== undefined) payload.order = order;

  if (!isBlank(mapped.color)) payload.color = normalizeColor(mapped.color);

  const response = parsePositiveIntOrUndefined(mapped.slaResponseMinutes);
  if (response !== undefined) payload.slaResponseMinutes = response;

  const resolution = parsePositiveIntOrUndefined(mapped.slaResolutionMinutes);
  if (resolution !== undefined) payload.slaResolutionMinutes = resolution;

  return payload;
}

export const confirmHelpdeskPriorityImport = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const rows = (req.body.rows as MappedHelpdeskPriorityRow[]) ?? [];
  const fileName = (req.body.fileName as string | undefined) ?? null;
  const newRows = rows.filter((r) => r.classification === "new");
  const updatedRows = rows.filter((r) => r.classification === "updated");
  const duplicates = rows.filter((r) => r.classification === "duplicate").length;
  const invalid = rows.filter((r) => r.classification === "invalid").length;

  let added = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of newRows) {
    try {
      const payload = buildPayload(row.mapped);
      await helpdeskPrioritiesService.createHelpdeskPriority(
        {
          name: row.mapped.name,
          order: payload.order as number | undefined,
          color: payload.color as string | undefined,
          slaResponseMinutes: payload.slaResponseMinutes as number,
          slaResolutionMinutes: payload.slaResolutionMinutes as number,
        },
        organizationId
      );
      added += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  for (const row of updatedRows) {
    try {
      if (!row.existingId) throw new Error("missing existing record reference");
      await helpdeskPrioritiesService.updateHelpdeskPriority(row.existingId, buildPayload(row.mapped), organizationId);
      updated += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  const counts = { total: rows.length, added, updated, duplicates, invalid };

  await logAction({
    req,
    action: "IMPORT",
    module: "HelpdeskPriority",
    recordLabel: `${added} added, ${updated} updated`,
    newValue: { ...counts, errors: errors.length },
  });
  await recordImportBatch({ organizationId, module: "HelpdeskPriority", userId: req.user?.id, fileName, counts, errors });

  ok(res, { ...counts, errors }, "Import complete");
});

export const downloadHelpdeskPriorityTemplate = asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="helpdesk-priority-import-template.csv"');
  res.send(HELPDESK_PRIORITY_IMPORT_TEMPLATE_COLUMNS.join(",") + "\n");
});

export const getHelpdeskPriorityImportHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await listImportBatches({
    organizationId: req.organization!._id,
    module: "HelpdeskPriority",
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  ok(res, result, "Import history");
});
