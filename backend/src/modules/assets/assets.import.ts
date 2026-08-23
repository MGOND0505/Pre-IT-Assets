import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { parseSpreadsheet, findColumn } from "../../utils/spreadsheet";
import { Asset, ASSET_STATUSES, type AssetStatus } from "../../models/Asset";
import { AssetCategory } from "../../models/AssetCategory";
import { Location } from "../../models/Location";
import { Department } from "../../models/Department";
import { Vendor } from "../../models/Vendor";
import { User } from "../../models/User";
import { logAction } from "../audit/audit.service";
import * as assetsService from "./assets.service";

type MappedFields = {
  name: string;
  assetType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  imei: string;
  macAddress: string;
  operatingSystem: string;
  status: string;
  condition: string;
  purchaseDate: string;
  purchaseCost: string;
  warrantyEnd: string;
  invoiceNumber: string;
  notes: string;
  categoryName: string;
  locationName: string;
  departmentName: string;
  vendorName: string;
  employeeName: string;
  employeeId: string;
};

export type MappedAssetRow = {
  rowIndex: number;
  mapped: MappedFields;
  classification: "new" | "duplicate" | "invalid";
  reason?: string;
  duplicateAssetId?: string;
};

const STATUS_KEYWORDS: [RegExp, AssetStatus][] = [
  [/dead/i, "Retired"],
  [/retir/i, "Retired"],
  [/dispos/i, "Disposed"],
  [/issued|assign/i, "Assigned"],
  [/repair/i, "Under Repair"],
  [/maintenance/i, "Under Maintenance"],
  [/damag/i, "Damaged"],
  [/lost/i, "Lost"],
  [/stolen/i, "Stolen"],
  [/reserv/i, "Reserved"],
  [/available/i, "Available"],
  [/stock/i, "In Stock"],
];

function mapStatus(raw: string): AssetStatus {
  for (const [pattern, status] of STATUS_KEYWORDS) {
    if (pattern.test(raw)) return status;
  }
  return (ASSET_STATUSES as readonly string[]).includes(raw) ? (raw as AssetStatus) : "In Stock";
}

function mapRow(row: Record<string, string>): MappedFields {
  const manufacturer = findColumn(row, ["Make", "Manufacturer", "Brand"]);
  const model = findColumn(row, ["Model"]);
  const assetType = findColumn(row, ["Asset type", "Device Type", "Category"]);
  const name = [manufacturer, model].filter(Boolean).join(" ") || assetType || "Unnamed asset";

  const notesParts = [
    findColumn(row, ["Condition notes"]),
    findColumn(row, ["Repair History ( If Any )", "Repair History"]),
    findColumn(row, ["Miscellaneous Accessories"]),
  ].filter((v) => v && v !== "N/A" && v !== "0");

  return {
    name,
    assetType,
    manufacturer,
    model,
    serialNumber: findColumn(row, ["Serial number", "Serial Number", "Serial No"]),
    imei: findColumn(row, ["IMEI", "IMEI Number"]),
    macAddress: findColumn(row, ["MAC Address", "MAC"]),
    operatingSystem: findColumn(row, ["Operating System"]),
    status: findColumn(row, ["Status"]),
    condition: findColumn(row, ["Laptop ( Condition )", "Condition"]),
    purchaseDate: findColumn(row, ["Purchase date", "Purchase Date"]),
    purchaseCost: findColumn(row, ["Purchase price", "Purchase Price", "Purchase Cost"]),
    warrantyEnd: findColumn(row, ["Warranty End Date", "Warranty End"]),
    invoiceNumber: findColumn(row, ["Invoice Number", "Invoice No"]),
    notes: notesParts.join(" | "),
    categoryName: assetType,
    locationName: findColumn(row, ["Location"]),
    departmentName: findColumn(row, ["Department"]),
    vendorName: findColumn(row, ["Vendor Name", "Vendor"]),
    employeeName: findColumn(row, ["Employee Name", "Current owner"]),
    employeeId: findColumn(row, ["Emp ID", "Employee ID"]),
  };
}

function isBlank(value: string): boolean {
  return !value || value.trim() === "" || value.trim().toUpperCase() === "N/A" || value.trim() === "N.A";
}

async function classifyRows(rawRows: Record<string, string>[]): Promise<MappedAssetRow[]> {
  const categories = await AssetCategory.find().select("name");
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  const existingSerials = await Asset.find({ serialNumber: { $ne: "" }, isDeleted: false }).select("assetId serialNumber");
  const serialToAssetId = new Map(existingSerials.map((a) => [a.serialNumber.toLowerCase(), a.assetId]));

  const existingImeis = await Asset.find({ imei: { $ne: "" }, isDeleted: false }).select("assetId imei");
  const imeiToAssetId = new Map(existingImeis.map((a) => [a.imei.toLowerCase(), a.assetId]));

  const seenSerials = new Set<string>();
  const seenImeis = new Set<string>();

  return rawRows.map((row, rowIndex) => {
    const mapped = mapRow(row);
    const serial = mapped.serialNumber.toLowerCase();
    const imei = mapped.imei.toLowerCase();

    let classification: MappedAssetRow["classification"] = "new";
    let reason: string | undefined;
    let duplicateAssetId: string | undefined;

    if (!isBlank(serial) && (serialToAssetId.has(serial) || seenSerials.has(serial))) {
      classification = "duplicate";
      duplicateAssetId = serialToAssetId.get(serial);
      reason = "Serial number already exists";
    } else if (!isBlank(imei) && (imeiToAssetId.has(imei) || seenImeis.has(imei))) {
      classification = "duplicate";
      duplicateAssetId = imeiToAssetId.get(imei);
      reason = "IMEI already exists";
    } else if (!categoryByName.has(mapped.categoryName.toLowerCase())) {
      classification = "invalid";
      reason = mapped.categoryName
        ? `Unknown category "${mapped.categoryName}" - create it under Assets > Categories first`
        : "No category / device type column found for this row";
    }

    if (!isBlank(serial)) seenSerials.add(serial);
    if (!isBlank(imei)) seenImeis.add(imei);

    return { rowIndex, mapped, classification, reason, duplicateAssetId };
  });
}

export const previewAssetImport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const rawRows = parseSpreadsheet(req.file.buffer);
  if (rawRows.length === 0) throw new ApiError(400, "The file has no data rows");

  const rows = await classifyRows(rawRows);
  const counts = {
    total: rows.length,
    new: rows.filter((r) => r.classification === "new").length,
    duplicate: rows.filter((r) => r.classification === "duplicate").length,
    invalid: rows.filter((r) => r.classification === "invalid").length,
  };

  ok(res, { counts, rows }, "Import preview");
});

async function findOrCreateLocation(name: string) {
  if (isBlank(name)) return null;
  const existing = await Location.findOne({ name: new RegExp(`^${escapeRegExp(name.trim())}$`, "i") });
  if (existing) return existing;
  return Location.create({ name: name.trim() });
}

async function findOrCreateDepartment(name: string) {
  if (isBlank(name)) return null;
  const existing = await Department.findOne({ name: new RegExp(`^${escapeRegExp(name.trim())}$`, "i") });
  if (existing) return existing;
  return Department.create({ name: name.trim() });
}

async function findOrCreateVendor(name: string) {
  if (isBlank(name)) return null;
  const existing = await Vendor.findOne({ name: new RegExp(`^${escapeRegExp(name.trim())}$`, "i") });
  if (existing) return existing;
  return Vendor.create({ name: name.trim() });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDateOrUndefined(value: string): Date | undefined {
  if (isBlank(value)) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export const confirmAssetImport = asyncHandler(async (req: Request, res: Response) => {
  const rows = (req.body.rows as MappedAssetRow[]) ?? [];
  const toImport = rows.filter((r) => r.classification === "new");

  const categories = await AssetCategory.find().select("name");
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  let created = 0;
  const errors: string[] = [];

  for (const row of toImport) {
    try {
      const category = categoryByName.get(row.mapped.categoryName.toLowerCase());
      if (!category) {
        errors.push(`Row ${row.rowIndex + 1}: unknown category`);
        continue;
      }

      const [location, department, vendor] = await Promise.all([
        findOrCreateLocation(row.mapped.locationName),
        findOrCreateDepartment(row.mapped.departmentName),
        findOrCreateVendor(row.mapped.vendorName),
      ]);

      let assignedUser = null;
      if (!isBlank(row.mapped.employeeId)) {
        assignedUser = await User.findOne({ employeeId: new RegExp(`^${escapeRegExp(row.mapped.employeeId)}$`, "i") });
      }
      if (!assignedUser && !isBlank(row.mapped.employeeName)) {
        assignedUser = await User.findOne({ name: new RegExp(`^${escapeRegExp(row.mapped.employeeName)}$`, "i") });
      }

      await assetsService.createAsset(
        {
          name: row.mapped.name,
          category: String(category._id),
          assetType: row.mapped.assetType,
          manufacturer: row.mapped.manufacturer,
          model: row.mapped.model,
          serialNumber: row.mapped.serialNumber,
          imei: row.mapped.imei,
          macAddress: row.mapped.macAddress,
          operatingSystem: row.mapped.operatingSystem,
          status: mapStatus(row.mapped.status),
          condition: row.mapped.condition,
          purchaseDate: parseDateOrUndefined(row.mapped.purchaseDate) ?? null,
          purchaseCost: row.mapped.purchaseCost ? Number(row.mapped.purchaseCost.replace(/[^0-9.]/g, "")) || null : null,
          warrantyEnd: parseDateOrUndefined(row.mapped.warrantyEnd) ?? null,
          invoiceNumber: row.mapped.invoiceNumber,
          notes: row.mapped.notes,
          location: location ? String(location._id) : null,
          department: department ? String(department._id) : null,
          vendor: vendor ? String(vendor._id) : null,
          assignedUser: assignedUser ? String(assignedUser._id) : null,
        } as never,
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
    module: "Asset",
    recordLabel: `${created} asset(s) imported`,
    newValue: { created, skipped: rows.length - toImport.length, errors: errors.length },
  });

  ok(res, { created, skipped: rows.length - toImport.length, errors }, "Import complete");
});
