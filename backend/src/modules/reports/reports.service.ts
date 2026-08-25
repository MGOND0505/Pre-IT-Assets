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
  ids?: string[];
};

export async function getAssetReportRows(filters: AssetReportFilters = {}, organizationId: string) {
  const query: Record<string, unknown> = { organization: organizationId, isDeleted: false };
  if (filters.status) query.status = filters.status;
  if (filters.category) query.category = filters.category;
  if (filters.location) query.location = filters.location;
  if (filters.department) query.department = filters.department;
  if (filters.ids && filters.ids.length > 0) query._id = { $in: filters.ids };

  const assets = await Asset.find(query).populate(ASSET_POPULATE).sort({ createdDate: -1 });

  return assets.map((a) => {
    const assignedUser = a.assignedUser as unknown as { name?: string; email?: string; employeeId?: string } | null;

    return {
      assetId: a.assetId,
      location: (a.location as unknown as { name: string } | null)?.name ?? "",
      subLocation: a.subLocation,
      status: a.status,
      userAccessLevel: a.userAccessLevel,
      employeeId: a.employeeId || assignedUser?.employeeId || "",
      employeeName: a.employeeName || assignedUser?.name || "",
      department: (a.department as unknown as { name: string } | null)?.name ?? "",
      designation: a.designation,
      email: a.email || assignedUser?.email || "",
      emailLicense: a.emailLicense,
      deviceType: a.deviceType,
      assetType: a.assetType,
      category: a.category && "name" in a.category ? (a.category as unknown as { name: string }).name : "",
      manufacturer: a.manufacturer,
      model: a.model,
      serialNumber: a.serialNumber,
      imei: a.imei,
      processor: a.processor,
      laptopGeneration: a.laptopGeneration,
      graphicsCard: a.graphicsCard,
      ram: a.ram,
      storage: a.storage,
      macAddress: a.macAddress,
      adapterSerialNumber: a.adapterSerialNumber,
      miscAccessories: a.miscAccessories,
      operatingSystem: a.operatingSystem,
      operatingSystemLicense: a.operatingSystemLicense,
      canvaLicense: a.canvaLicense,
      hostname: a.hostname,
      adMember: a.adMember,
      antivirusInstalled: a.antivirusInstalled,
      remoteSoftware: a.remoteSoftware,
      microsoftOffice: a.microsoftOffice,
      microsoftProject: a.microsoftProject,
      powerBi: a.powerBi,
      autoCad: a.autoCad,
      zwCad: a.zwCad,
      photoshop: a.photoshop,
      creativeCloudPro: a.creativeCloudPro,
      illustrator: a.illustrator,
      acrobatPro: a.acrobatPro,
      sketchUpPro: a.sketchUpPro,
      rocketReachPro: a.rocketReachPro,
      d5Render: a.d5Render,
      zoomLicense: a.zoomLicense,
      sharedFolderAccess: a.sharedFolderAccess,
      purchaseDate: a.purchaseDate ? a.purchaseDate.toISOString().slice(0, 10) : "",
      warrantyEnd: a.warrantyEnd ? a.warrantyEnd.toISOString().slice(0, 10) : "",
      vendor: (a.vendor as unknown as { name: string } | null)?.name ?? "",
      companyName: a.companyName,
      purchaseCost: a.purchaseCost ?? "",
      quantity: a.quantity ?? "",
      invoiceNumber: a.invoiceNumber,
      color: a.color,
      condition: a.condition,
      currentOwner: a.currentOwner,
      previousOwner: a.previousOwner,
      conditionNotes: a.conditionNotes,
      approvalStatus: a.approvalStatus,
      repairHistory: a.repairHistory,
      notes: a.notes,
    };
  });
}

export type LicenseReportFilters = {
  status?: string;
  category?: string;
  vendor?: string;
};

export async function getLicenseReportRows(filters: LicenseReportFilters = {}, organizationId: string) {
  const query: Record<string, unknown> = { organization: organizationId, isDeleted: false };
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
