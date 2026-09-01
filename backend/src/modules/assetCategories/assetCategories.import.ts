import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { parseSpreadsheet, findColumn } from "../../utils/spreadsheet";
import { AssetCategory, type IAssetCategory } from "../../models/AssetCategory";
import { logAction } from "../audit/audit.service";
import { recordImportBatch, listImportBatches } from "../importHistory/importHistory.service";
import * as assetCategoriesService from "./assetCategories.service";

/** Canonical column headers - what "Download template" hands back. */
export const ASSET_CATEGORY_IMPORT_TEMPLATE_COLUMNS = ["Name", "Prefix", "Description"];

const PREFIX_PATTERN = /^[A-Z0-9]{2,6}$/;

type MappedFields = {
  name: string;
  prefix: string;
  description: string;
};

export type MappedAssetCategoryRow = {
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
    prefix: findColumn(row, ["Prefix"]).trim().toUpperCase(),
    description: findColumn(row, ["Description"]),
  };
}

/** Only compares fields the row actually provides - a blank cell means "leave unchanged", not "clear this field". */
function diffAgainstExisting(mapped: MappedFields, existing: IAssetCategory): string[] {
  const changed: string[] = [];
  if (!isBlank(mapped.description) && normalize(mapped.description) !== normalize(existing.description)) {
    changed.push("description");
  }
  if (!isBlank(mapped.prefix) && mapped.prefix !== existing.prefix) changed.push("prefix");
  return changed;
}

function hasAnyRecognizableColumn(rawRows: Record<string, string>[]): boolean {
  return rawRows.some((row) => !isBlank(mapRow(row).name));
}

async function classifyRows(rawRows: Record<string, string>[], organizationId: string): Promise<MappedAssetCategoryRow[]> {
  // Hard-delete module - no isDeleted filter, every remaining doc is "current".
  const existingCategories = await AssetCategory.find({ organization: organizationId });
  const byName = new Map(existingCategories.map((c) => [c.name.toLowerCase(), c]));
  const byPrefix = new Map(existingCategories.map((c) => [c.prefix.toLowerCase(), c]));

  const seenNameInFile = new Set<string>();
  const seenPrefixInFile = new Set<string>();

  return rawRows.map((row, rowIndex) => {
    const mapped = mapRow(row);
    const nameKey = normalize(mapped.name);
    const prefixKey = normalize(mapped.prefix);
    const byNameMatch = nameKey ? byName.get(nameKey) : undefined;
    const byPrefixMatch = prefixKey ? byPrefix.get(prefixKey) : undefined;
    const dupeInFile = seenNameInFile.has(nameKey) || (prefixKey && seenPrefixInFile.has(prefixKey));

    let classification: MappedAssetCategoryRow["classification"];
    let reason: string | undefined;
    let existingId: string | undefined;

    if (isBlank(mapped.name)) {
      classification = "invalid";
      reason = "Missing category name";
    } else if (isBlank(mapped.prefix) || !PREFIX_PATTERN.test(mapped.prefix)) {
      classification = "invalid";
      reason = "Prefix must be 2-6 letters/digits (e.g. LAP, MON)";
    } else if (byNameMatch && byPrefixMatch && String(byNameMatch._id) !== String(byPrefixMatch._id)) {
      classification = "invalid";
      reason = `Name matches "${byNameMatch.name}" but prefix "${mapped.prefix}" belongs to a different category`;
    } else {
      const existing = byNameMatch ?? byPrefixMatch;
      if (existing) {
        existingId = String(existing._id);
        const changedFields = diffAgainstExisting(mapped, existing);

        if (dupeInFile) {
          classification = "duplicate";
          reason = "This category appears more than once in this file";
        } else if (changedFields.length > 0) {
          classification = "updated";
          reason = `${changedFields.length} field(s) will change: ${changedFields.join(", ")}`;
        } else {
          classification = "duplicate";
          reason = "No changes from the existing record";
        }
      } else if (dupeInFile) {
        classification = "duplicate";
        reason = "This category appears more than once in this file";
      } else {
        classification = "new";
      }
    }

    if (nameKey) seenNameInFile.add(nameKey);
    if (prefixKey) seenPrefixInFile.add(prefixKey);

    return { rowIndex, mapped, classification, reason, existingId };
  });
}

export const previewAssetCategoryImport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const rawRows = parseSpreadsheet(req.file.buffer);
  if (rawRows.length === 0) throw new ApiError(400, "The file has no data rows");
  if (!hasAnyRecognizableColumn(rawRows)) {
    throw new ApiError(400, "This file doesn't look like an asset category CSV - no Name column was found. Try the template.");
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
  if (isCreate || !isBlank(mapped.prefix)) payload.prefix = mapped.prefix;
  if (isCreate || !isBlank(mapped.description)) payload.description = mapped.description;
  return payload;
}

export const confirmAssetCategoryImport = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const rows = (req.body.rows as MappedAssetCategoryRow[]) ?? [];
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
      await assetCategoriesService.createAssetCategory(
        { name: row.mapped.name, prefix: row.mapped.prefix, ...buildPayload(row.mapped, true) },
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
      await assetCategoriesService.updateAssetCategory(row.existingId, buildPayload(row.mapped, false), organizationId);
      updated += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  const counts = { total: rows.length, added, updated, duplicates, invalid };

  await logAction({
    req,
    action: "IMPORT",
    module: "AssetCategory",
    recordLabel: `${added} added, ${updated} updated`,
    newValue: { ...counts, errors: errors.length },
  });
  await recordImportBatch({ organizationId, module: "AssetCategory", userId: req.user?.id, fileName, counts, errors });

  ok(res, { ...counts, errors }, "Import complete");
});

export const downloadAssetCategoryTemplate = asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="asset-category-import-template.csv"');
  res.send(ASSET_CATEGORY_IMPORT_TEMPLATE_COLUMNS.join(",") + "\n");
});

export const getAssetCategoryImportHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await listImportBatches({
    organizationId: req.organization!._id,
    module: "AssetCategory",
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  ok(res, result, "Import history");
});
