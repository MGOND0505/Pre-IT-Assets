import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { ok } from "../../utils/response";
import { getAssetReportRows, getLicenseReportRows } from "./reports.service";
import { rowsToCsv, rowsToExcelBuffer, rowsToPdfBuffer } from "./reports.export";

export const getAssetReport = asyncHandler(async (req: Request, res: Response) => {
  const rows = await getAssetReportRows(req.query as never);
  ok(res, rows, "Asset report");
});

export const getLicenseReport = asyncHandler(async (req: Request, res: Response) => {
  const rows = await getLicenseReportRows(req.query as never);
  ok(res, rows, "License report");
});

async function exportRows(res: Response, rows: Record<string, unknown>[], baseName: string, format: unknown) {
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
    const buffer = await rowsToPdfBuffer(rows, baseName);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.pdf"`);
    res.send(buffer);
    return;
  }
  throw new ApiError(400, "format must be csv, excel, or pdf");
}

export const exportAssetReport = asyncHandler(async (req: Request, res: Response) => {
  const rows = await getAssetReportRows(req.query as never);
  await exportRows(res, rows, "asset-report", req.query.format);
});

export const exportLicenseReport = asyncHandler(async (req: Request, res: Response) => {
  const rows = await getLicenseReportRows(req.query as never);
  await exportRows(res, rows, "license-report", req.query.format);
});
