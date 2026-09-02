import { Asset } from "../../models/Asset";
import { License } from "../../models/License";

const ASSET_POPULATE = [
  { path: "category", select: "name" },
  { path: "vendor", select: "name" },
  { path: "location", select: "name" },
  { path: "department", select: "name" },
  {
    path: "assignedUser",
    select: "name email employeeId designation",
    populate: { path: "designation", select: "name" },
  },
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
    // assignedToEmployeeId/Name/email/designation are no longer stored on Asset - derived here
    // from the populated assignedUser reference, per the enterprise-ITAM consolidation (never a
    // separately-maintained, driftable snapshot - see models/Asset.ts's own comment).
    const assignedUser = a.assignedUser as unknown as {
      name?: string;
      email?: string;
      employeeId?: string;
      designation?: { name?: string } | null;
    } | null;

    return {
      assetId: a.assetId,
      location: (a.location as unknown as { name: string } | null)?.name ?? "",
      building: a.building,
      floor: a.floor,
      room: a.room,
      subLocation: a.subLocation,
      status: a.status,
      assignedToEmployeeId: assignedUser?.employeeId || "",
      assignedToEmployeeName: assignedUser?.name || "",
      department: (a.department as unknown as { name: string } | null)?.name ?? "",
      designation: assignedUser?.designation?.name || "",
      email: assignedUser?.email || "",
      assignmentStatus: a.assignmentStatus,
      assignmentDate: a.assignmentDate ? a.assignmentDate.toISOString().slice(0, 10) : "",
      returnDate: a.returnDate ? a.returnDate.toISOString().slice(0, 10) : "",
      emailLicense: a.emailLicense,
      assetType: a.assetType,
      category: a.category && "name" in a.category ? (a.category as unknown as { name: string }).name : "",
      manufacturer: a.manufacturer,
      model: a.model,
      serialNumber: a.serialNumber,
      CPU: a.CPU,
      GPU: a.GPU,
      ram: a.ram,
      storage: a.storage,
      display: a.display,
      biosUefiVersion: a.biosUefiVersion,
      deviceUUID: a.deviceUUID,
      macAddress: a.macAddress,
      adapterSerialNumber: a.adapterSerialNumber,
      operatingSystem: a.operatingSystem,
      osVersion: a.osVersion,
      operatingSystemLicense: a.operatingSystemLicense,
      canvaLicense: a.canvaLicense,
      hostname: a.hostname,
      directoryMembership: a.directoryMembership,
      domainName: a.domainName,
      encryptionStatus: a.encryptionStatus,
      securityAgentStatus: a.securityAgentStatus,
      antivirusStatus: a.antivirusStatus,
      patchStatus: a.patchStatus,
      complianceStatus: a.complianceStatus,
      lastSecurityCheck: a.lastSecurityCheck ? a.lastSecurityCheck.toISOString().slice(0, 10) : "",
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
      warrantyStartDate: a.warrantyStartDate ? a.warrantyStartDate.toISOString().slice(0, 10) : "",
      warrantyEndDate: a.warrantyEndDate ? a.warrantyEndDate.toISOString().slice(0, 10) : "",
      warrantyProvider: a.warrantyProvider,
      supportContract: a.supportContract,
      contractStartDate: a.contractStartDate ? a.contractStartDate.toISOString().slice(0, 10) : "",
      contractEndDate: a.contractEndDate ? a.contractEndDate.toISOString().slice(0, 10) : "",
      contractNumber: a.contractNumber,
      vendor: (a.vendor as unknown as { name: string } | null)?.name ?? "",
      purchaseOrderNumber: a.purchaseOrderNumber,
      currency: a.currency,
      costCenter: a.costCenter,
      budgetCode: a.budgetCode,
      depreciationMethod: a.depreciationMethod,
      depreciationStartDate: a.depreciationStartDate ? a.depreciationStartDate.toISOString().slice(0, 10) : "",
      purchaseCost: a.purchaseCost ?? "",
      quantity: a.quantity ?? "",
      invoiceNumber: a.invoiceNumber,
      condition: a.condition,
      // currentOwner/previousOwner are derived, not stored - see models/Asset.ts's own comment.
      // A flat report row skips the AssetHistory lookup previousOwner needs (real per-row N+1
      // cost for a bulk export); currentOwner is cheap (already-populated assignedUser).
      currentOwner: assignedUser?.name || "",
      repairHistory: a.repairHistory,
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
