import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ok } from "../../utils/response";
import { BRANDING_DIR } from "../../utils/upload";
import { getAssetReportRows, getLicenseReportRows, type AssetReportFilters } from "./reports.service";
import { getSettings } from "../settings/settings.service";
import { rowsToCsv, rowsToExcelBuffer, rowsToPdfBuffer, findEmbeddableLogoPath } from "./reports.export";

function parseIds(value: unknown): string[] | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value.split(",").map((id) => id.trim()).filter(Boolean);
}

export const getAssetReport = asyncHandler(async (req: Request, res: Response) => {
  const rows = await getAssetReportRows(
    { ...(req.query as unknown as AssetReportFilters), ids: parseIds(req.query.ids) },
    req.organization!._id
  );
  ok(res, rows, "Asset report");
});

export const getLicenseReport = asyncHandler(async (req: Request, res: Response) => {
  const rows = await getLicenseReportRows(req.query as never, req.organization!._id);
  ok(res, rows, "License report");
});

async function exportRows(
  res: Response,
  rows: Record<string, unknown>[],
  baseName: string,
  format: unknown,
  organizationId: string
) {
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.csv"`);
    res.send(rowsToCsv(rows));
    return;
  }
  if (format === "excel") {
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.xlsx"`);
    res.send(rowsToExcelBuffer(rows, baseName));
    return;
  }
  if (format === "pdf") {
    const settings = await getSettings(organizationId);
    const logoPath = findEmbeddableLogoPath(BRANDING_DIR, settings.logoFileName);
    const buffer = await rowsToPdfBuffer(rows, baseName, logoPath, settings.teamName);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.pdf"`);
    res.send(buffer);
    return;
  }
  throw new ApiError(400, "format must be csv, excel, or pdf");
}

export const exportAssetReport = asyncHandler(async (req: Request, res: Response) => {
  const rows = await getAssetReportRows(
    { ...(req.query as unknown as AssetReportFilters), ids: parseIds(req.query.ids) },
    req.organization!._id
  );
  await exportRows(res, rows, "asset-report", req.query.format, req.organization!._id);
});

export const exportLicenseReport = asyncHandler(async (req: Request, res: Response) => {
  const rows = await getLicenseReportRows(req.query as never, req.organization!._id);
  await exportRows(res, rows, "license-report", req.query.format, req.organization!._id);
});
