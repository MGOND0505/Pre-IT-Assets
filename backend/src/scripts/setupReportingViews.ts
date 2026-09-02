import mongoose from "mongoose";
import { env } from "../config/env";

/**
 * Read-only MongoDB views for Metabase (or any other BI tool) to query directly.
 * Views recompute on every read (nothing materialized), so they always reflect live
 * data with no refresh job to maintain - fine at this data volume (hundreds of assets).
 * Safe to re-run: each view is dropped and recreated.
 */

/** Wraps a field path so a genuinely missing field (common on pre-existing documents stored
 * before this field existed in the schema - Mongoose only backfills defaults on hydration,
 * not in the raw stored document) behaves like an empty string instead of "missing". This
 * matters a lot inside object literals: a $project value built entirely from missing paths
 * collapses to `{}` rather than a document of nulls, which silently drops rows downstream
 * (e.g. $objectToArray -> $unwind on an empty array removes the document entirely). */
function str(field: string) {
  return { $ifNull: [field, ""] };
}

const SOFTWARE_FIELDS: Record<string, unknown> = {
  "Microsoft Office": str("$microsoftOffice"),
  "Microsoft Project": str("$microsoftProject"),
  "Power BI": str("$powerBi"),
  AutoCAD: str("$autoCad"),
  ZWCAD: str("$zwCad"),
  Photoshop: str("$photoshop"),
  "Creative Cloud Pro": str("$creativeCloudPro"),
  Illustrator: str("$illustrator"),
  "Acrobat Pro": str("$acrobatPro"),
  "SketchUp Pro": str("$sketchUpPro"),
  "RocketReach Pro": str("$rocketReachPro"),
  "D5 Render": str("$d5Render"),
  Zoom: str("$zoomLicense"),
  Canva: str("$canvaLicense"),
};

const LOOKUPS = [
  { from: "assetcategories", localField: "category", as: "categoryDoc" },
  { from: "locations", localField: "location", as: "locationDoc" },
  { from: "departments", localField: "department", as: "departmentDoc" },
  { from: "vendors", localField: "vendor", as: "vendorDoc" },
  { from: "users", localField: "assignedUser", as: "assignedUserDoc" },
  // Powers the per-organization Metabase embedding filter (see metabase/README.md) - without
  // this, both views mix every organization's assets into one undifferentiated dataset, which
  // would leak every org's data to every org's embedded dashboard.
  { from: "organizations", localField: "organization", as: "organizationDoc" },
];

function lookupStages() {
  return LOOKUPS.flatMap((l) => [
    { $lookup: { from: l.from, localField: l.localField, foreignField: "_id", as: l.as } },
    { $unwind: { path: `$${l.as}`, preserveNullAndEmptyArrays: true } },
  ]);
}

/** "Yes" / "Licensed" / "Y" / "True" (any case) all count as a positive flag - everything else (including blank) does not. */
const TRUTHY_EXPR = (field: string) => ({
  $in: [{ $toLower: { $trim: { input: { $ifNull: [field, ""] } } } }, ["yes", "y", "licensed", "true", "1"]],
});

const ASSET_REPORT_PIPELINE = [
  { $match: { isDeleted: false } },
  ...lookupStages(),
  {
    $addFields: {
      warrantyDaysRemaining: {
        $cond: [
          { $ifNull: ["$warrantyEndDate", false] },
          { $divide: [{ $subtract: ["$warrantyEndDate", "$$NOW"] }, 1000 * 60 * 60 * 24] },
          null,
        ],
      },
    },
  },
  {
    $addFields: {
      warrantyStatus: {
        $switch: {
          branches: [
            { case: { $eq: ["$warrantyDaysRemaining", null] }, then: "No Warranty Date" },
            { case: { $lt: ["$warrantyDaysRemaining", 0] }, then: "Expired" },
            { case: { $lte: ["$warrantyDaysRemaining", 30] }, then: "Expiring in 30 Days" },
            { case: { $lte: ["$warrantyDaysRemaining", 60] }, then: "Expiring in 60 Days" },
            { case: { $lte: ["$warrantyDaysRemaining", 90] }, then: "Expiring in 90 Days" },
          ],
          default: "Active",
        },
      },
      purchaseYear: { $cond: [{ $ifNull: ["$purchaseDate", false] }, { $year: "$purchaseDate" }, null] },
      ageYears: {
        $cond: [
          { $ifNull: ["$purchaseDate", false] },
          { $divide: [{ $subtract: ["$$NOW", "$purchaseDate"] }, 1000 * 60 * 60 * 24 * 365.25] },
          null,
        ],
      },
      hasRepairHistory: {
        $and: [
          { $ne: [{ $trim: { input: { $ifNull: ["$repairHistory", ""] } } }, ""] },
          { $not: { $in: [{ $toLower: { $trim: { input: { $ifNull: ["$repairHistory", ""] } } } }, ["none", "n/a", "na"]] } },
        ],
      },
      // adMember/antivirusInstalled (free text) were replaced by directoryMembership (free text -
      // any non-blank value means domain-joined) and antivirusStatus (enum) per the Phase 3
      // Hardware/Security consolidation - same 3-signal compliance heuristic, new source fields.
      isDomainJoined: {
        $ne: [{ $trim: { input: { $ifNull: ["$directoryMembership", ""] } } }, ""],
      },
      hasAntivirus: { $eq: ["$antivirusStatus", "Installed"] },
      isOsLicensed: TRUTHY_EXPR("$operatingSystemLicense"),
    },
  },
  {
    $addFields: {
      // Simple heuristic: share of the 3 core security signals present, 0-100. Documented in the dashboard, adjustable later.
      complianceScore: {
        $round: [
          {
            $multiply: [
              {
                $divide: [
                  { $sum: [{ $toInt: "$isDomainJoined" }, { $toInt: "$hasAntivirus" }, { $toInt: "$isOsLicensed" }] },
                  3,
                ],
              },
              100,
            ],
          },
          0,
        ],
      },
      needsHardwareReview: {
        $and: [{ $ifNull: ["$ageYears", false] }, { $gte: ["$ageYears", 4] }],
      },
    },
  },
  {
    $project: {
      _id: 1,
      organization: { $toString: "$organization" },
      organizationName: str("$organizationDoc.name"),
      assetId: str("$assetId"),
      name: str("$name"),
      category: str("$categoryDoc.name"),
      assetType: str("$assetType"),
      manufacturer: str("$manufacturer"),
      model: str("$model"),
      serialNumber: str("$serialNumber"),
      CPU: str("$CPU"),
      GPU: str("$GPU"),
      ram: str("$ram"),
      storage: str("$storage"),
      display: str("$display"),
      biosUefiVersion: str("$biosUefiVersion"),
      deviceUUID: str("$deviceUUID"),
      hostname: str("$hostname"),
      ipAddress: str("$ipAddress"),
      macAddress: str("$macAddress"),
      adapterSerialNumber: str("$adapterSerialNumber"),
      operatingSystem: str("$operatingSystem"),
      osVersion: str("$osVersion"),
      operatingSystemLicense: str("$operatingSystemLicense"),
      isOsLicensed: 1,
      directoryMembership: str("$directoryMembership"),
      domainName: str("$domainName"),
      isDomainJoined: 1,
      encryptionStatus: str("$encryptionStatus"),
      securityAgentStatus: str("$securityAgentStatus"),
      antivirusStatus: str("$antivirusStatus"),
      hasAntivirus: 1,
      patchStatus: str("$patchStatus"),
      complianceStatus: str("$complianceStatus"),
      lastSecurityCheck: 1,
      emailLicense: str("$emailLicense"),
      canvaLicense: str("$canvaLicense"),
      microsoftOffice: str("$microsoftOffice"),
      microsoftProject: str("$microsoftProject"),
      powerBi: str("$powerBi"),
      autoCad: str("$autoCad"),
      zwCad: str("$zwCad"),
      photoshop: str("$photoshop"),
      creativeCloudPro: str("$creativeCloudPro"),
      illustrator: str("$illustrator"),
      acrobatPro: str("$acrobatPro"),
      sketchUpPro: str("$sketchUpPro"),
      rocketReachPro: str("$rocketReachPro"),
      d5Render: str("$d5Render"),
      zoomLicense: str("$zoomLicense"),
      sharedFolderAccess: str("$sharedFolderAccess"),
      status: str("$status"),
      condition: str("$condition"),
      repairHistory: str("$repairHistory"),
      hasRepairHistory: 1,
      purchaseDate: 1,
      purchaseYear: 1,
      ageYears: 1,
      needsHardwareReview: 1,
      purchaseCost: { $ifNull: ["$purchaseCost", null] },
      quantity: { $ifNull: ["$quantity", null] },
      vendor: str("$vendorDoc.name"),
      purchaseOrderNumber: str("$purchaseOrderNumber"),
      invoiceNumber: str("$invoiceNumber"),
      currency: str("$currency"),
      contractNumber: str("$contractNumber"),
      costCenter: str("$costCenter"),
      budgetCode: str("$budgetCode"),
      depreciationMethod: str("$depreciationMethod"),
      depreciationStartDate: 1,
      warrantyStartDate: 1,
      warrantyEndDate: 1,
      warrantyDaysRemaining: 1,
      warrantyStatus: 1,
      warrantyProvider: str("$warrantyProvider"),
      supportContract: str("$supportContract"),
      contractStartDate: 1,
      contractEndDate: 1,
      location: str("$locationDoc.name"),
      building: str("$building"),
      floor: str("$floor"),
      room: str("$room"),
      subLocation: str("$subLocation"),
      department: str("$departmentDoc.name"),
      // assignedUserName/Email/EmployeeId are derived from the assignedUser lookup, never stored
      // on Asset - previousOwner is intentionally not reconstructed here (would need a per-row
      // AssetHistory lookup, same cost/benefit tradeoff as reports.service.ts's flat export).
      assignedUserName: str("$assignedUserDoc.name"),
      assignedUserEmail: str("$assignedUserDoc.email"),
      assignedUserEmployeeId: str("$assignedUserDoc.employeeId"),
      assignmentStatus: str("$assignmentStatus"),
      assignmentDate: 1,
      returnDate: 1,
      complianceScore: 1,
      createdDate: 1,
    },
  },
];

const LICENSE_USAGE_PIPELINE = [
  { $match: { isDeleted: false } },
  ...lookupStages(),
  {
    $project: {
      _id: 1,
      organization: { $toString: "$organization" },
      organizationName: str("$organizationDoc.name"),
      assetId: str("$assetId"),
      status: str("$status"),
      location: str("$locationDoc.name"),
      department: str("$departmentDoc.name"),
      assignedUserName: str("$assignedUserDoc.name"),
      assignedUserEmployeeId: str("$assignedUserDoc.employeeId"),
      software: SOFTWARE_FIELDS,
    },
  },
  {
    $project: {
      organization: 1,
      organizationName: 1,
      assetId: 1,
      status: 1,
      location: 1,
      department: 1,
      assignedUserName: 1,
      assignedUserEmployeeId: 1,
      software: { $objectToArray: "$software" },
    },
  },
  { $unwind: "$software" },
  {
    $project: {
      organization: 1,
      organizationName: 1,
      assetId: 1,
      status: 1,
      location: 1,
      department: 1,
      assignedUserName: 1,
      assignedUserEmployeeId: 1,
      softwareName: "$software.k",
      hasLicense: TRUTHY_EXPR("$software.v"),
    },
  },
];

async function createView(db: mongoose.mongo.Db, name: string, viewOn: string, pipeline: unknown[]) {
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length > 0) {
    await db.dropCollection(name);
    console.log(`Dropped existing "${name}"`);
  }
  await db.createCollection(name, { viewOn, pipeline: pipeline as never[] });
  console.log(`Created view "${name}" (on "${viewOn}")`);
}

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db!;

  await createView(db, "v_asset_report", "assets", ASSET_REPORT_PIPELINE);
  await createView(db, "v_license_usage", "assets", LICENSE_USAGE_PIPELINE);

  const assetCount = await db.collection("v_asset_report").countDocuments();
  const licenseRowCount = await db.collection("v_license_usage").countDocuments();
  console.log(`v_asset_report: ${assetCount} rows`);
  console.log(`v_license_usage: ${licenseRowCount} rows`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Failed to set up reporting views:", err);
  process.exit(1);
});
