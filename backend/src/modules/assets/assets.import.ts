import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { parseSpreadsheet, findColumn } from "../../utils/spreadsheet";
import {
  Asset,
  ASSET_STATUSES,
  ASSET_OWNERSHIP_TYPES,
  ASSET_CRITICALITY_LEVELS,
  type AssetStatus,
  type AssetOwnershipType,
  type AssetCriticality,
  type IAsset,
} from "../../models/Asset";
import { AssetCategory } from "../../models/AssetCategory";
import { Location } from "../../models/Location";
import { Department } from "../../models/Department";
import { Vendor } from "../../models/Vendor";
import { User } from "../../models/User";
import { logAction } from "../audit/audit.service";
import { recordImportBatch, listImportBatches } from "../importHistory/importHistory.service";
import { notifyAssetImportBatch } from "../../services/alerts/assetChangeAlerts";
import * as assetsService from "./assets.service";

/** Canonical column headers - what "Download template" hands back, and what "Download current data" exports. */
export const ASSET_IMPORT_TEMPLATE_COLUMNS = [
  "Asset ID",
  "Asset Tag",
  "Asset Sub-Type",
  "Criticality (Low / Medium / High / Critical)",
  "Company Entity",
  "Description",
  "Location",
  "Sub-Location",
  "Status",
  "User Access (Admin / Standard User)",
  "Employee ID",
  "Employee Name",
  "Department",
  "Designation",
  "Email ID",
  "Email License",
  "Device Type (Laptop / Desktop)",
  "Asset Type",
  "Ownership Type (Own / Rental)",
  "Make",
  "Model",
  "Serial Number",
  "IMEI",
  "Processor",
  "Laptop Generation",
  "Graphics Card",
  "RAM",
  "Storage (SSD / HDD)",
  "MAC Address",
  "Laptop Adapter Serial Number",
  "Miscellaneous Accessories",
  "Operating System",
  "Operating System License",
  "Canva License",
  "System Hostname",
  "AD Member (Yes / No)",
  "Antivirus Installed",
  "Remote Software",
  "Microsoft Office",
  "Microsoft Project",
  "Power BI",
  "AutoCAD",
  "ZWCAD",
  "Photoshop",
  "Creative Cloud Pro",
  "Illustrator",
  "Acrobat Pro",
  "SketchUp Pro",
  "RocketReach Pro",
  "D5 Render",
  "Zoom License",
  "Shared Folder Access",
  "Purchase Date",
  "Warranty End Date",
  "Vendor Name",
  "Company Name",
  "Purchase Price",
  "Quantity",
  "Invoice Number",
  "Color",
  "Laptop Condition",
  "Current Owner",
  "Previous Owner",
  "Condition Notes",
  "Approval Status",
  "Repair History (If Any)",
  "Notes",
];

type MappedFields = {
  assetIdRaw: string;
  assetTag: string;
  name: string;
  assetType: string;
  assetSubType: string;
  ownershipType: string;
  criticality: string;
  companyEntity: string;
  description: string;
  deviceType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  imei: string;
  color: string;
  processor: string;
  laptopGeneration: string;
  graphicsCard: string;
  ram: string;
  storage: string;
  macAddress: string;
  adapterSerialNumber: string;
  miscAccessories: string;
  operatingSystem: string;
  operatingSystemLicense: string;
  canvaLicense: string;
  hostname: string;
  adMember: string;
  antivirusInstalled: string;
  remoteSoftware: string;
  emailLicense: string;
  microsoftOffice: string;
  microsoftProject: string;
  powerBi: string;
  autoCad: string;
  zwCad: string;
  photoshop: string;
  creativeCloudPro: string;
  illustrator: string;
  acrobatPro: string;
  sketchUpPro: string;
  rocketReachPro: string;
  d5Render: string;
  zoomLicense: string;
  sharedFolderAccess: string;
  status: string;
  condition: string;
  conditionNotes: string;
  approvalStatus: string;
  repairHistory: string;
  purchaseDate: string;
  purchaseCost: string;
  quantity: string;
  warrantyEnd: string;
  invoiceNumber: string;
  companyName: string;
  notes: string;
  categoryName: string;
  locationName: string;
  subLocation: string;
  departmentName: string;
  vendorName: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  email: string;
  userAccessLevel: string;
  currentOwner: string;
  previousOwner: string;
};

export type MappedAssetRow = {
  rowIndex: number;
  mapped: MappedFields;
  classification: "new" | "updated" | "duplicate" | "invalid";
  reason?: string;
  existingId?: string;
  existingAssetId?: string;
  changedFields?: string[];
};

const STATUS_KEYWORDS: [RegExp, AssetStatus][] = [
  [/dead/i, "Retired"],
  [/retir/i, "Retired"],
  [/dispos/i, "Disposed"],
  [/issued|assign|in.?use/i, "Assigned"],
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

function mapOwnershipType(raw: string): AssetOwnershipType {
  if (/lease/i.test(raw)) return "Lease";
  if (/rent/i.test(raw)) return "Rental";
  return (ASSET_OWNERSHIP_TYPES as readonly string[]).includes(raw) ? (raw as AssetOwnershipType) : "Own";
}

function mapCriticality(raw: string): AssetCriticality {
  if (/crit/i.test(raw)) return "Critical";
  if (/high/i.test(raw)) return "High";
  if (/low/i.test(raw)) return "Low";
  if (/med/i.test(raw)) return "Medium";
  return (ASSET_CRITICALITY_LEVELS as readonly string[]).includes(raw) ? (raw as AssetCriticality) : "Medium";
}

function mapRow(row: Record<string, string>): MappedFields {
  const manufacturer = findColumn(row, ["Make", "Manufacturer", "Brand"]);
  const model = findColumn(row, ["Model"]);
  const assetType = findColumn(row, ["Asset type", "Asset Type", "Category"]);
  const deviceType = findColumn(row, ["Device Type", "Device Type ( Laptop or Desktop )", "Device Type (Laptop / Desktop)"]);
  const name = findColumn(row, ["Name", "Asset Name"]) || [manufacturer, model].filter(Boolean).join(" ") || assetType || deviceType || "Unnamed asset";

  return {
    assetIdRaw: findColumn(row, ["Asset ID", "AssetId"]),
    assetTag: findColumn(row, ["Asset Tag", "Asset Barcode", "Barcode"]),
    name,
    assetType,
    assetSubType: findColumn(row, ["Asset Sub-Type", "Asset Sub Type", "Sub-Type"]),
    ownershipType: findColumn(row, ["Ownership Type", "Ownership", "Own/Rental", "Own / Rental"]),
    criticality: findColumn(row, ["Criticality"]),
    companyEntity: findColumn(row, ["Company Entity", "Entity", "Legal Entity"]),
    description: findColumn(row, ["Description"]),
    deviceType,
    manufacturer,
    model,
    serialNumber: findColumn(row, ["Serial number", "Serial Number", "Serial No"]),
    imei: findColumn(row, ["IMEI", "IMEI Number"]),
    color: findColumn(row, ["Color"]),
    processor: findColumn(row, ["Processors", "Processor"]),
    laptopGeneration: findColumn(row, ["Laptop Generation"]),
    graphicsCard: findColumn(row, ["Graphic Card", "Graphics Card"]),
    ram: findColumn(row, ["RAM"]),
    storage: findColumn(row, ["Storage(SSD)/HDD", "Storage (SSD/HDD)", "Storage (SSD / HDD)", "Storage"]),
    macAddress: findColumn(row, ["MAC Address", "MAC"]),
    adapterSerialNumber: findColumn(row, ["Laptop's Adapter Serial Number", "Laptop Adapter Serial Number"]),
    miscAccessories: findColumn(row, ["Miscellaneous Accessories"]),
    operatingSystem: findColumn(row, ["Operating System"]),
    operatingSystemLicense: findColumn(row, ["Operating System License"]),
    canvaLicense: findColumn(row, ["Canva", "Canva License"]),
    hostname: findColumn(row, ["System Hostname", "Hostname"]),
    adMember: findColumn(row, ["AD Member ( Yes or No )", "AD Member (Yes/No)", "AD Member (Yes / No)"]),
    antivirusInstalled: findColumn(row, ["Antivirus Installed"]),
    remoteSoftware: findColumn(row, ["Remote Software"]),
    emailLicense: findColumn(row, ["Email license", "Email License"]),
    microsoftOffice: findColumn(row, ["Microsoft Office"]),
    microsoftProject: findColumn(row, ["Microsoft Project"]),
    powerBi: findColumn(row, ["Power Bi", "Power BI"]),
    autoCad: findColumn(row, ["AutoCad", "AutoCAD"]),
    zwCad: findColumn(row, ["ZwCad", "ZWCAD"]),
    photoshop: findColumn(row, ["Photoshop"]),
    creativeCloudPro: findColumn(row, ["Creative Cloud Pro"]),
    illustrator: findColumn(row, ["Illustrator"]),
    acrobatPro: findColumn(row, ["Acrobat Pro"]),
    sketchUpPro: findColumn(row, ["SketchUp Pro"]),
    rocketReachPro: findColumn(row, ["RocketReach Pro"]),
    d5Render: findColumn(row, ["D5 Render"]),
    zoomLicense: findColumn(row, ["Zoom licence", "Zoom License"]),
    sharedFolderAccess: findColumn(row, ["Shared Folder Access"]),
    status: findColumn(row, ["Status"]),
    condition: findColumn(row, ["Laptop ( Condition )", "Laptop Condition", "Condition"]),
    conditionNotes: findColumn(row, ["Condition notes", "Condition Notes"]),
    approvalStatus: findColumn(row, ["Approval status", "Approval Status"]),
    repairHistory: findColumn(row, ["Repair History ( If Any )", "Repair History (If Any)", "Repair History"]),
    purchaseDate: findColumn(row, ["Purchase date", "Purchase Date"]),
    purchaseCost: findColumn(row, ["Purchase price", "Purchase Price", "Purchase Cost"]),
    quantity: findColumn(row, ["Qty", "Quantity"]),
    warrantyEnd: findColumn(row, ["Warranty End Date", "Warranty End"]),
    invoiceNumber: findColumn(row, ["Invoice Number", "Invoice No"]),
    companyName: findColumn(row, ["Company Name"]),
    notes: findColumn(row, ["Notes", "Remarks"]),
    categoryName: assetType || deviceType,
    locationName: findColumn(row, ["Location"]),
    subLocation: findColumn(row, ["Sub Location", "Sub-Location"]),
    departmentName: findColumn(row, ["Department"]),
    vendorName: findColumn(row, ["Vendor Name", "Vendor"]),
    employeeName: findColumn(row, ["Employee Name", "Current owner"]),
    employeeId: findColumn(row, ["Emp ID", "Employee ID"]),
    designation: findColumn(row, ["Designation"]),
    email: findColumn(row, ["Email Id", "Email ID"]),
    userAccessLevel: findColumn(row, ["User Access ( Admin or Not )", "User Access (Admin / Standard User)", "User Access"]),
    currentOwner: findColumn(row, ["Current owner", "Current Owner"]),
    previousOwner: findColumn(row, ["Previous owner", "Previous Owner"]),
  };
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim() === "" || value.trim().toUpperCase() === "N/A" || value.trim() === "N.A";
}

function normalize(value: string | null | undefined): string {
  return isBlank(value) ? "" : value!.trim().toLowerCase();
}

function dateToDayString(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function parseDateOrUndefined(value: string): Date | undefined {
  if (isBlank(value)) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseNumberOrNull(value: string): number | null {
  if (isBlank(value)) return null;
  const num = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) && value.replace(/[^0-9.]/g, "") !== "" ? num : null;
}

type ExistingAsset = IAsset & {
  _id: unknown;
  category?: { name?: string } | null;
  location?: { name?: string } | null;
  department?: { name?: string } | null;
  vendor?: { name?: string } | null;
  assignedUser?: { name?: string; email?: string; employeeId?: string } | null;
};

/** Plain string fields compared 1:1 between the mapped row and the existing document. */
const STRING_DIFF_FIELDS: (keyof MappedFields & keyof IAsset)[] = [
  "name",
  "assetTag",
  "assetType",
  "assetSubType",
  "companyEntity",
  "description",
  "deviceType",
  "manufacturer",
  "model",
  "serialNumber",
  "imei",
  "color",
  "processor",
  "laptopGeneration",
  "graphicsCard",
  "ram",
  "storage",
  "macAddress",
  "adapterSerialNumber",
  "miscAccessories",
  "operatingSystem",
  "operatingSystemLicense",
  "canvaLicense",
  "hostname",
  "adMember",
  "antivirusInstalled",
  "remoteSoftware",
  "emailLicense",
  "microsoftOffice",
  "microsoftProject",
  "powerBi",
  "autoCad",
  "zwCad",
  "photoshop",
  "creativeCloudPro",
  "illustrator",
  "acrobatPro",
  "sketchUpPro",
  "rocketReachPro",
  "d5Render",
  "zoomLicense",
  "sharedFolderAccess",
  "condition",
  "conditionNotes",
  "approvalStatus",
  "repairHistory",
  "invoiceNumber",
  "companyName",
  "notes",
  "subLocation",
  "userAccessLevel",
  "employeeId",
  "employeeName",
  "designation",
  "email",
  "currentOwner",
  "previousOwner",
];

/** Only compares fields the row actually provides - a blank cell means "leave unchanged", not "clear this field". */
function diffAgainstExisting(mapped: MappedFields, existing: ExistingAsset): string[] {
  const changed: string[] = [];

  for (const field of STRING_DIFF_FIELDS) {
    const incoming = mapped[field] as string;
    const current = existing[field] as string;
    if (!isBlank(incoming) && normalize(incoming) !== normalize(current)) changed.push(field);
  }

  if (!isBlank(mapped.locationName) && normalize(mapped.locationName) !== normalize(existing.location?.name)) changed.push("location");
  if (!isBlank(mapped.departmentName) && normalize(mapped.departmentName) !== normalize(existing.department?.name)) changed.push("department");
  if (!isBlank(mapped.vendorName) && normalize(mapped.vendorName) !== normalize(existing.vendor?.name)) changed.push("vendor");

  if (!isBlank(mapped.status) && mapStatus(mapped.status) !== existing.status) changed.push("status");
  if (!isBlank(mapped.criticality) && mapCriticality(mapped.criticality) !== existing.criticality) {
    changed.push("criticality");
  }
  if (!isBlank(mapped.ownershipType) && mapOwnershipType(mapped.ownershipType) !== existing.ownershipType) {
    changed.push("ownershipType");
  }
  if (!isBlank(mapped.purchaseDate) && dateToDayString(parseDateOrUndefined(mapped.purchaseDate) ?? null) !== dateToDayString(existing.purchaseDate)) {
    changed.push("purchaseDate");
  }
  if (!isBlank(mapped.warrantyEnd) && dateToDayString(parseDateOrUndefined(mapped.warrantyEnd) ?? null) !== dateToDayString(existing.warrantyEnd)) {
    changed.push("warrantyEnd");
  }
  if (!isBlank(mapped.purchaseCost) && parseNumberOrNull(mapped.purchaseCost) !== existing.purchaseCost) changed.push("purchaseCost");
  if (!isBlank(mapped.quantity) && parseNumberOrNull(mapped.quantity) !== existing.quantity) changed.push("quantity");

  const employeeMatch =
    (!isBlank(mapped.employeeId) && normalize(mapped.employeeId) === normalize(existing.assignedUser?.employeeId)) ||
    (!isBlank(mapped.employeeName) && normalize(mapped.employeeName) === normalize(existing.assignedUser?.name));
  const employeeProvided = !isBlank(mapped.employeeId) || !isBlank(mapped.employeeName);
  if (employeeProvided && !employeeMatch) changed.push("assignedUser");

  return changed;
}

function hasAnyRecognizableColumn(rawRows: Record<string, string>[]): boolean {
  return rawRows.some((row) => {
    const mapped = mapRow(row);
    return (
      !isBlank(mapped.name) ||
      !isBlank(mapped.categoryName) ||
      !isBlank(mapped.serialNumber) ||
      !isBlank(mapped.imei) ||
      !isBlank(mapped.assetIdRaw)
    );
  });
}

async function classifyRows(rawRows: Record<string, string>[], organizationId: string): Promise<MappedAssetRow[]> {
  const categories = await AssetCategory.find({ organization: organizationId }).select("name");
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  const existingAssets = (await Asset.find({ organization: organizationId, isDeleted: false }).populate([
    { path: "location", select: "name" },
    { path: "department", select: "name" },
    { path: "vendor", select: "name" },
    { path: "assignedUser", select: "name email employeeId" },
  ])) as unknown as ExistingAsset[];

  const byAssetId = new Map(existingAssets.map((a) => [a.assetId.toLowerCase(), a]));
  const bySerial = new Map(existingAssets.filter((a) => !isBlank(a.serialNumber)).map((a) => [a.serialNumber.toLowerCase(), a]));
  const byImei = new Map(existingAssets.filter((a) => !isBlank(a.imei)).map((a) => [a.imei.toLowerCase(), a]));

  const seenInFile = new Set<string>();

  return rawRows.map((row, rowIndex) => {
    const mapped = mapRow(row);
    const assetIdKey = normalize(mapped.assetIdRaw);
    const serialKey = normalize(mapped.serialNumber);
    const imeiKey = normalize(mapped.imei);

    const existing = (assetIdKey && byAssetId.get(assetIdKey)) || (serialKey && bySerial.get(serialKey)) || (imeiKey && byImei.get(imeiKey));

    const fileKey = assetIdKey || serialKey || imeiKey;

    let classification: MappedAssetRow["classification"];
    let reason: string | undefined;
    let existingId: string | undefined;
    let existingAssetId: string | undefined;
    let changedFields: string[] | undefined;

    if (existing) {
      existingId = String(existing._id);
      existingAssetId = existing.assetId;
      changedFields = diffAgainstExisting(mapped, existing);

      if (fileKey && seenInFile.has(fileKey)) {
        classification = "duplicate";
        reason = "This asset appears more than once in this file";
      } else if (changedFields.length > 0) {
        classification = "updated";
        reason = `${changedFields.length} field(s) will change: ${changedFields.join(", ")}`;
      } else {
        classification = "duplicate";
        reason = "No changes from the existing record";
      }
    } else if (!categoryByName.has(mapped.categoryName.toLowerCase())) {
      classification = "invalid";
      reason = mapped.categoryName
        ? `Unknown category "${mapped.categoryName}" - create it under Assets > Categories first`
        : "No category / device type column found for this row";
    } else {
      classification = "new";
    }

    if (fileKey) seenInFile.add(fileKey);

    return { rowIndex, mapped, classification, reason, existingId, existingAssetId, changedFields };
  });
}

export const previewAssetImport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const rawRows = parseSpreadsheet(req.file.buffer);
  if (rawRows.length === 0) throw new ApiError(400, "The file has no data rows");
  if (!hasAnyRecognizableColumn(rawRows)) {
    throw new ApiError(
      400,
      "This file doesn't look like an asset CSV - no recognizable columns (Name, Category, Serial Number, IMEI, or Asset ID) were found. Try the template."
    );
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

async function findOrCreateLocation(name: string, organizationId: string) {
  if (isBlank(name)) return null;
  const existing = await Location.findOne({
    organization: organizationId,
    name: new RegExp(`^${escapeRegExp(name.trim())}$`, "i"),
  });
  if (existing) return existing;
  return Location.create({ organization: organizationId, name: name.trim() });
}

async function findOrCreateDepartment(name: string, organizationId: string) {
  if (isBlank(name)) return null;
  const existing = await Department.findOne({
    organization: organizationId,
    name: new RegExp(`^${escapeRegExp(name.trim())}$`, "i"),
  });
  if (existing) return existing;
  return Department.create({ organization: organizationId, name: name.trim() });
}

async function findOrCreateVendor(name: string, organizationId: string) {
  if (isBlank(name)) return null;
  const existing = await Vendor.findOne({
    organization: organizationId,
    name: new RegExp(`^${escapeRegExp(name.trim())}$`, "i"),
  });
  if (existing) return existing;
  return Vendor.create({ organization: organizationId, name: name.trim() });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveAssignedUser(mapped: MappedFields, organizationId: string) {
  if (!isBlank(mapped.employeeId)) {
    const byId = await User.findOne({
      organization: organizationId,
      employeeId: new RegExp(`^${escapeRegExp(mapped.employeeId)}$`, "i"),
    });
    if (byId) return byId;
  }
  if (!isBlank(mapped.employeeName)) {
    return User.findOne({
      organization: organizationId,
      name: new RegExp(`^${escapeRegExp(mapped.employeeName)}$`, "i"),
    });
  }
  return null;
}

/** Every plain-string field, always applied verbatim from the row (used for create - a fresh row has no "leave unchanged" ambiguity). */
function plainFieldsFromMapped(mapped: MappedFields) {
  const fields: Partial<Record<(typeof STRING_DIFF_FIELDS)[number], string>> = {};
  for (const field of STRING_DIFF_FIELDS) {
    fields[field] = mapped[field] as string;
  }
  return fields;
}

/** Builds an update payload containing only the fields the row actually provides (blank = leave unchanged). */
async function buildPartialPayload(mapped: MappedFields, organizationId: string) {
  const payload: Record<string, unknown> = {};

  for (const field of STRING_DIFF_FIELDS) {
    const value = mapped[field] as string;
    if (!isBlank(value)) payload[field] = value;
  }

  if (!isBlank(mapped.status)) payload.status = mapStatus(mapped.status);
  if (!isBlank(mapped.ownershipType)) payload.ownershipType = mapOwnershipType(mapped.ownershipType);
  if (!isBlank(mapped.criticality)) payload.criticality = mapCriticality(mapped.criticality);
  if (!isBlank(mapped.purchaseDate)) payload.purchaseDate = parseDateOrUndefined(mapped.purchaseDate) ?? null;
  if (!isBlank(mapped.purchaseCost)) payload.purchaseCost = parseNumberOrNull(mapped.purchaseCost);
  if (!isBlank(mapped.quantity)) payload.quantity = parseNumberOrNull(mapped.quantity);
  if (!isBlank(mapped.warrantyEnd)) payload.warrantyEnd = parseDateOrUndefined(mapped.warrantyEnd) ?? null;

  if (!isBlank(mapped.locationName)) {
    const location = await findOrCreateLocation(mapped.locationName, organizationId);
    payload.location = location ? String(location._id) : null;
  }
  if (!isBlank(mapped.departmentName)) {
    const department = await findOrCreateDepartment(mapped.departmentName, organizationId);
    payload.department = department ? String(department._id) : null;
  }
  if (!isBlank(mapped.vendorName)) {
    const vendor = await findOrCreateVendor(mapped.vendorName, organizationId);
    payload.vendor = vendor ? String(vendor._id) : null;
  }
  if (!isBlank(mapped.employeeId) || !isBlank(mapped.employeeName)) {
    const assignedUser = await resolveAssignedUser(mapped, organizationId);
    payload.assignedUser = assignedUser ? String(assignedUser._id) : null;
  }

  return payload;
}

export const confirmAssetImport = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const rows = (req.body.rows as MappedAssetRow[]) ?? [];
  const newRows = rows.filter((r) => r.classification === "new");
  const updatedRows = rows.filter((r) => r.classification === "updated");
  const duplicates = rows.filter((r) => r.classification === "duplicate").length;
  const invalid = rows.filter((r) => r.classification === "invalid").length;

  const categories = await AssetCategory.find({ organization: organizationId }).select("name");
  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

  let added = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of newRows) {
    try {
      const category = categoryByName.get(row.mapped.categoryName.toLowerCase());
      if (!category) {
        errors.push(`Row ${row.rowIndex + 1}: unknown category`);
        continue;
      }

      const [location, department, vendor, assignedUser] = await Promise.all([
        findOrCreateLocation(row.mapped.locationName, organizationId),
        findOrCreateDepartment(row.mapped.departmentName, organizationId),
        findOrCreateVendor(row.mapped.vendorName, organizationId),
        resolveAssignedUser(row.mapped, organizationId),
      ]);

      await assetsService.createAsset(
        {
          ...plainFieldsFromMapped(row.mapped),
          category: String(category._id),
          status: mapStatus(row.mapped.status),
          ownershipType: mapOwnershipType(row.mapped.ownershipType),
          criticality: mapCriticality(row.mapped.criticality),
          purchaseDate: parseDateOrUndefined(row.mapped.purchaseDate) ?? null,
          purchaseCost: parseNumberOrNull(row.mapped.purchaseCost),
          quantity: parseNumberOrNull(row.mapped.quantity),
          warrantyEnd: parseDateOrUndefined(row.mapped.warrantyEnd) ?? null,
          location: location ? String(location._id) : null,
          department: department ? String(department._id) : null,
          vendor: vendor ? String(vendor._id) : null,
          assignedUser: assignedUser ? String(assignedUser._id) : null,
        } as never,
        req.user!.id,
        organizationId,
        { notify: false }
      );
      added += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  for (const row of updatedRows) {
    try {
      if (!row.existingId) throw new Error("missing existing record reference");
      const payload = await buildPartialPayload(row.mapped, organizationId);
      await assetsService.updateAsset(row.existingId, payload as never, organizationId, { notify: false });
      updated += 1;
    } catch (err) {
      errors.push(`Row ${row.rowIndex + 1}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  const counts = { total: rows.length, added, updated, duplicates, invalid };

  await logAction({
    req,
    action: "IMPORT",
    module: "Asset",
    recordLabel: `${added} added, ${updated} updated`,
    newValue: { ...counts, errors: errors.length },
  });
  await recordImportBatch({ organizationId, module: "Asset", userId: req.user?.id, fileName: null, counts, errors });

  notifyAssetImportBatch(organizationId, { added, updated });

  ok(res, { ...counts, errors }, "Import complete");
});

export const downloadAssetTemplate = asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="asset-import-template.csv"');
  res.send(ASSET_IMPORT_TEMPLATE_COLUMNS.join(",") + "\n");
});

export const getAssetImportHistory = asyncHandler(async (req: Request, res: Response) => {
  const result = await listImportBatches({
    organizationId: req.organization!._id,
    module: "Asset",
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  ok(res, result, "Import history");
});
