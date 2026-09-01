import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { parseSpreadsheet, findColumn } from "../../utils/spreadsheet";
import { HelpdeskCategory, type IHelpdeskCategory } from "../../models/HelpdeskCategory";
import { User } from "../../models/User";
import { logAction } from "../audit/audit.service";
import { recordImportBatch, listImportBatches } from "../importHistory/importHistory.service";
import * as helpdeskCategoriesService from "./helpdeskCategories.service";

/** Canonical column headers - what "Download template" hands back. */
export const HELPDESK_CATEGORY_IMPORT_TEMPLATE_COLUMNS = ["Name", "Description", "Default Agent Email"];

type MappedFields = {
  name: string;
  description: string;
  defaultAgentEmail: string;
};

export type MappedHelpdeskCategoryRow = {
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

function mapRow(row: Record<string, string>): MappedFields {
  return {
    name: findColumn(row, ["Name", "Category Name"]),
    description: findColumn(row, ["Description"]),
    defaultAgentEmail: findColumn(row, ["Default Agent Email", "Default Agent", "Agent Email"]),
  };
}

/** Only compares fields the row actually provides - a blank cell means "leave unchanged", not "clear this field". */
function diffAgainstExisting(mapped: MappedFields, existing: IHelpdeskCategory, resolvedAgentId: string | null): string[] {
  const changed: string[] = [];
  if (!isBlank(mapped.description) && normalize(mapped.description) !== normalize(existing.description)) {
    changed.push("description");
  }
  if (!isBlank(mapped.defaultAgentEmail) && resolvedAgentId !== String(existing.defaultAgent ?? "")) {
    changed.push("defaultAgent");
  }
  return changed;
}

function hasAnyRecognizableColumn(rawRows: Record<string, string>[]): boolean {
  return rawRows.some((row) => !isBlank(mapRow(row).name));
}

async function classifyRows(rawRows: Record<string, string>[], organizationId: string): Promise<MappedHelpdeskCategoryRow[]> {
  const existingCategories = await HelpdeskCategory.find({ organization: organizationId, isDeleted: false });
  const byName = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c]));

  const activeAgents = await User.find({ organization: organizationId, status: "Active", isDeleted: false }).select("email");
  const byEmail = new Map(activeAgents.map((u) => [u.email.toLowerCase(), String(u._id)]));

  const seenInFile = new Set<string>();

  return rawRows.map((row, rowIndex) => {
    const mapped = mapRow(row);
    const nameKey = normalize(mapped.name);
    const existing = nameKey ? byName.get(nameKey) : undefined;
    const emailKey = normalize(mapped.defaultAgentEmail);
    const resolvedAgentId = emailKey ? (byEmail.get(emailKey) ?? null) : null;

    let classification: MappedHelpdeskCategoryRow["classification"];
    let reason: string | undefined;
    let existingId: string | undefined;

    if (isBlank(mapped.name)) {
      classification = "invalid";
      reason = "Missing category name";
    } else if (!isBlank(mapped.defaultAgentEmail) && !resolvedAgentId) {
      classification = "invalid";
      reason = `Default agent "${mapped.defaultAgentEmail}" not found or not an active user in this organization`;
    } else if (existing) {
      existingId = String(existing._id);
      const changedFields = diffAgainstExisting(mapped, existing, resolvedAgentId);

      if (seenInFile.has(nameKey)) {
        classification = "duplicate";
        reason = "This category appears more than once in this file";
      } else if (changedFields.length > 0) {
        classification = "updated";
        reason = `${changedFields.length} field(s) will change: ${changedFields.join(", ")}`;
      } else {
        classification = "duplicate";
        reason = "No changes from the existing record";
      }
    } else if (seenInFile.has(nameKey)) {
      classification = "duplicate";
      reason = "This category appears more than once in this file";
    } else {
      classification = "new";
    }

    if (nameKey) seenInFile.add(nameKey);

    return { rowIndex, mapped, classification, reason, existingId };
  });
}

export const previewHelpdeskCategoryImport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const rawRows = parseSpreadsheet(req.file.buffer);
  if (rawRows.length === 0) throw new ApiError(400, "The file has no data rows");
  if (!hasAnyRecognizableColumn(rawRows)) {
    throw new ApiError(400, "This file doesn't look like a ticket category CSV - no Name column was found. Try the template.");
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

/** Resolves the default-agent email fresh at confirm time (never trusts a client-echoed id) - same
 * "look it up again, don't trust the client" precedent as assets.import.ts#resolveAssignedUser. */
async function resolveDefaultAgent(email: string, organizationId: string): Promise<string | null> {
  if (isBlank(email)) return null;
  const agent = await User.findOne({ organization: organizationId, email: email.trim(), status: "Active", isDeleted: false });
  return agent ? String(agent._id) : null;
}

/** Builds a payload containing only the fields the row actually provides (blank = leave unchanged
 * on update; always applied verbatim on create, since a fresh row has no "unchanged" ambiguity). */
async function buildPayload(mapped: MappedFields, isCreate: boolean, organizationId: string): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {};
  if (isCreate || !isBlank(mapped.description)) payload.description = mapped.description;
  if (isCreate || !isBlank(mapped.defaultAgentEmail)) {
    payload.defaultAgent = await resolveDefaultAgent(mapped.defaultAgentEmail, organizationId);
  }
  return payload;
}

export const confirmHelpdeskCategoryImport = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const rows = (req.body.rows as MappedHelpdeskCategoryRow[]) ?? [];
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
      const payload = await buildPayload(row.mapped, true, organizationId);
      await helpdeskCategoriesService.createHelpdeskCategory({ name: row.mapped.name, ...payload }, organizationId);
      added += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  for (const row of updatedRows) {
    try {
      if (!row.existingId) throw new Error("missing existing record reference");
      const payload = await buildPayload(row.mapped, false, organizationId);
      await helpdeskCategoriesService.updateHelpdeskCategory(row.existingId, payload, organizationId);
      updated += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  const counts = { total: rows.length, added, updated, duplicates, invalid };

  await logAction({
    req,
    action: "IMPORT",
    module: "HelpdeskCategory",
    recordLabel: `${added} added, ${updated} updated`,
    newValue: { ...counts, errors: errors.length },
  });
  await recordImportBatch({ organizationId, module: "HelpdeskCategory", userId: req.user?.id, fileName, counts, errors });

  ok(res, { ...counts, errors }, "Import complete");
});

export const downloadHelpdeskCategoryTemplate = asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="ticket-category-import-template.csv"');
  res.send(HELPDESK_CATEGORY_IMPORT_TEMPLATE_COLUMNS.join(",") + "\n");
});

export const getHelpdeskCategoryImportHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await listImportBatches({
    organizationId: req.organization!._id,
    module: "HelpdeskCategory",
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  ok(res, result, "Import history");
});
