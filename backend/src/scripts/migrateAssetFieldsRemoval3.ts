import { MongoClient } from "mongodb";
import { env } from "../config/env";

/** One-off, idempotent migration for two changes to the Asset Master, per an explicit user
 * request:
 *   1. `operatingSystem` becomes a fixed dropdown (Windows / macOS / Linux / Windows Server /
 *      Other) instead of free text. Real dev data has ~84 DOS-family values plus a handful of
 *      typos ("Winsows 11 Pro") and unparsed codenames ("Sonoma 14.6.1") that don't fit any of
 *      the four named options - each gets classified best-effort (confident "windows"/"mac"/
 *      "linux" substring matches map to that option; blank/"N/A" maps to unset; everything else
 *      maps to "Other") and, whenever `osVersion` is still blank, the ORIGINAL free-text value is
 *      preserved there rather than discarded - never destructive, matches
 *      migrateAssetFieldsPhase3.ts's own operatingSystem-split precedent.
 *   2. Removes `quantity`, `purchaseOrderNumber`, `currency`, `costCenter`, `budgetCode`,
 *      `depreciationStartDate` from the Purchase & Vendor tab. All are 0-populated in real data
 *      except `quantity` (3 records, all value 1 - the trivial default for a serialized single
 *      asset, no real content to preserve).
 * Same raw-driver, idempotent pattern as every prior migrateAssetFields*.ts script.
 */

const REMOVED_PURCHASE_FIELDS = ["quantity", "purchaseOrderNumber", "currency", "costCenter", "budgetCode", "depreciationStartDate"];

const VALID_OS = new Set(["Windows", "macOS", "Linux", "Windows Server", "Other", ""]);

function classifyOperatingSystem(raw: string): { operatingSystem: string; osVersion: string | null } {
  const trimmed = raw.trim();
  if (trimmed === "" || /^n\/a$/i.test(trimmed)) return { operatingSystem: "", osVersion: null };
  if (/^windows$/i.test(trimmed)) return { operatingSystem: "Windows", osVersion: null };
  if (/^macos$/i.test(trimmed)) return { operatingSystem: "macOS", osVersion: null };
  if (/win/i.test(trimmed)) return { operatingSystem: "Windows", osVersion: trimmed };
  if (/mac|sonoma|catalina|monterey|sequoia|tahoe|high sierra/i.test(trimmed)) return { operatingSystem: "macOS", osVersion: trimmed };
  if (/linux|ubuntu/i.test(trimmed)) return { operatingSystem: "Linux", osVersion: trimmed };
  return { operatingSystem: "Other", osVersion: trimmed };
}

async function run() {
  const dryRun = !process.argv.includes("--apply");
  const client = await MongoClient.connect(env.MONGODB_URI);
  const db = client.db();
  const assets = db.collection("assets");

  console.log(dryRun ? "DRY RUN (pass --apply to write changes)" : "APPLYING CHANGES");

  // Step 1: remap operatingSystem to the fixed dropdown set.
  const osCandidates = await assets
    .find({ operatingSystem: { $exists: true, $nin: [...VALID_OS] } })
    .project({ _id: 1, operatingSystem: 1, osVersion: 1 })
    .toArray();
  let osRemapped = 0;
  for (const doc of osCandidates) {
    const { operatingSystem, osVersion } = classifyOperatingSystem(String(doc.operatingSystem ?? ""));
    const update: Record<string, unknown> = { operatingSystem };
    if (osVersion && isBlank(doc.osVersion)) update.osVersion = osVersion;
    osRemapped += 1;
    if (!dryRun) await assets.updateOne({ _id: doc._id }, { $set: update });
  }
  console.log(`Step 1 (remap operatingSystem to dropdown values): ${osRemapped} asset(s) ${dryRun ? "would be" : "were"} updated.`);

  // Step 2: remove the 6 Purchase & Vendor fields.
  const count = await assets.countDocuments({ $or: REMOVED_PURCHASE_FIELDS.map((f) => ({ [f]: { $exists: true } })) });
  console.log(`Step 2 (remove Purchase & Vendor fields): ${count} asset(s) ${dryRun ? "would be" : "were"} touched.`);
  if (!dryRun && count > 0) {
    await assets.updateMany({}, { $unset: Object.fromEntries(REMOVED_PURCHASE_FIELDS.map((f) => [f, ""])) });
  }

  await client.close();
}

function isBlank(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
