import { MongoClient } from "mongodb";
import { env } from "../config/env";

/** One-off, idempotent migration: removes the 17 per-product software/license fields from the
 * Asset Master per an explicit user request (operatingSystemLicense, emailLicense, canvaLicense,
 * microsoftOffice, microsoftProject, powerBi, autoCad, zwCad, photoshop, creativeCloudPro,
 * illustrator, acrobatPro, sketchUpPro, rocketReachPro, d5Render, zoomLicense,
 * sharedFolderAccess). Same raw-driver, idempotent pattern as migrateAssetFieldsRemoval1.ts.
 *
 * Every one of these 17 fields has the same 3 populated records in real dev data (the same legacy
 * test rows seen throughout this whole ITAM consolidation) - merged into `description` before
 * being unset, so nothing is silently lost. There is no replacement field/collection for any of
 * these yet (a dedicated AssetSoftware entity remains a possible future phase) - this migration
 * just removes them.
 */

const REMOVED_FIELDS = [
  { field: "operatingSystemLicense", label: "OS license" },
  { field: "emailLicense", label: "Email license" },
  { field: "canvaLicense", label: "Canva license" },
  { field: "microsoftOffice", label: "Microsoft Office" },
  { field: "microsoftProject", label: "Microsoft Project" },
  { field: "powerBi", label: "Power BI" },
  { field: "autoCad", label: "AutoCAD" },
  { field: "zwCad", label: "ZWCAD" },
  { field: "photoshop", label: "Photoshop" },
  { field: "creativeCloudPro", label: "Creative Cloud Pro" },
  { field: "illustrator", label: "Illustrator" },
  { field: "acrobatPro", label: "Acrobat Pro" },
  { field: "sketchUpPro", label: "SketchUp Pro" },
  { field: "rocketReachPro", label: "RocketReach Pro" },
  { field: "d5Render", label: "D5 Render" },
  { field: "zoomLicense", label: "Zoom license" },
  { field: "sharedFolderAccess", label: "Shared folder access" },
];

function isBlank(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

async function run() {
  const dryRun = !process.argv.includes("--apply");
  const doUnset = process.argv.includes("--unset");
  const client = await MongoClient.connect(env.MONGODB_URI);
  const db = client.db();
  const assets = db.collection("assets");

  console.log(dryRun ? "DRY RUN (pass --apply to write changes)" : "APPLYING CHANGES");

  const mergeCandidates = await assets
    .find({ $or: REMOVED_FIELDS.map(({ field }) => ({ [field]: { $exists: true, $ne: "" } })) })
    .project({ _id: 1, description: 1, ...Object.fromEntries(REMOVED_FIELDS.map(({ field }) => [field, 1])) })
    .toArray();

  let merged = 0;
  for (const doc of mergeCandidates) {
    const base = typeof doc.description === "string" ? doc.description : "";
    const lines = REMOVED_FIELDS.filter(({ field }) => !isBlank(doc[field]))
      .map(({ field, label }) => `[${label}] ${String(doc[field]).trim()}`)
      .filter((line) => !base.includes(line));
    if (lines.length === 0) continue;
    const nextDescription = [base, ...lines].filter(Boolean).join("\n\n");
    merged += 1;
    if (!dryRun) {
      await assets.updateOne({ _id: doc._id }, { $set: { description: nextDescription } });
    }
  }
  console.log(`Step 1 (merge into description): ${merged} asset(s) ${dryRun ? "would be" : "were"} updated.`);

  if (doUnset) {
    const fieldNames = REMOVED_FIELDS.map((f) => f.field);
    const count = await assets.countDocuments({ $or: fieldNames.map((f) => ({ [f]: { $exists: true } })) });
    console.log(`Step 2 (unset removed fields): ${count} asset(s) ${dryRun ? "would be" : "were"} touched.`);
    if (!dryRun && count > 0) {
      await assets.updateMany({}, { $unset: Object.fromEntries(fieldNames.map((f) => [f, ""])) });
    }
  } else {
    console.log("Step 2 (unset removed fields): skipped - pass --unset once Step 1 is verified.");
  }

  await client.close();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
