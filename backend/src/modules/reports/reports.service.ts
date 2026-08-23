import { Asset } from "../../models/Asset";
import { License } from "../../models/License";

const ASSET_POPULATE = [
  { path: "category", select: "name" },
  { path: "vendor", select: "name" },
  { path: "location", select: "name" },
  { path: "department", select: "name" },
  { path: "assignedUser", select: "name email employeeId" },
];

const LICENSE_POPULATE = [
  { path: "category", select: "name" },
  { path: "vendor", select: "name" },
  { path: "department", select: "name" },
  { path: "assignedUsers", select: "name email" },
];

export type AssetReportFilters = {
  status?: string;
  category?: string;
  location?: string;
  department?: string;
};

export async function getAssetReportRows(filters: AssetReportFilters = {}) {
  const query: Record<string, unknown> = { isDeleted: false };
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;
  if (filters.location) query.location = filters.location;
  if (filters.department) query.department = filters.department;

  const assets = await Asset.find(query).populate(ASSET_POPULATE).sort({ createdDate: -1 });

  return assets.map((a) => ({
    assetId: a.assetId,
    name: a.name,
    category: a.category && "name" in a.category ? (a.category as unknown as { name: string }).name : "",
    manufacturer: a.manufacturer,
    model: a.model,
    serialNumber: a.serialNumber,
    imei: a.imei,
    status: a.status,
    condition: a.condition,
    location: (a.location as unknown as { name: string } | null)?.name ?? "",
    department: (a.department as unknown as { name: string } | null)?.name ?? "",
    vendor: (a.vendor as unknown as { name: string } | null)?.name ?? "",
    employeeName: (a.assignedUser as unknown as { name: string } | null)?.name ?? "",
    employeeEmail: (a.assignedUser as unknown as { email: string } | null)?.email ?? "",
    employeeId: (a.assignedUser as unknown as { employeeId: string } | null)?.employeeId ?? "",
    purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString().slice(0, 10) : "",
    purchaseCost: a.purchaseCost ?? "",
    warrantyEnd: a.warrantyEnd ? a.warrantyEnd.toISOString().slice(0, 10) : "",
    amcEnd: a.amcEnd ? a.amcEnd.toISOString().slice(0, 10) : "",
    invoiceNumber: a.invoiceNumber,
    notes: a.notes,
  }));
}

export type LicenseReportFilters = {
  status?: string;
  category?: string;
  vendor?: string;
};

export async function getLicenseReportRows(filters: LicenseReportFilters = {}) {
  const query: Record<string, unknown> = { isDeleted: false };
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;
  if (filters.vendor) query.vendor = filters.vendor;

  const licenses = await License.find(query).populate(LICENSE_POPULATE).sort({ expiryDate: 1 });

  const now = new Date();

  return licenses.map((l) => {
    const daysRemaining = l.expiryDate
      ? Math.round((l.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      licenseId: l.licenseId,
      softwareName: l.softwareName,
      publisher: l.publisher,
      category: (l.category as unknown as { name: string } | null)?.name ?? "",
      licenseType: l.licenseType,
      vendor: (l.vendor as unknown as { name: string } | null)?.name ?? "",
      department: (l.department as unknown as { name: string } | null)?.name ?? "",
      totalLicenses: l.totalLicenses,
      usedLicenses: l.assignedUsers.length,
      availableLicenses: l.totalLicenses - l.assignedUsers.length,
      status: l.status,
      purchaseDate: l.purchaseDate ? l.purchaseDate.toISOString().slice(0, 10) : "",
      expiryDate: l.expiryDate ? l.expiryDate.toISOString().slice(0, 10) : "",
      daysRemaining: daysRemaining ?? "",
      costPerLicense: l.costPerLicense ?? "",
      totalCost: l.totalCost ?? "",
      invoiceNumber: l.invoiceNumber,
      notes: l.notes,
    };
  });
}
