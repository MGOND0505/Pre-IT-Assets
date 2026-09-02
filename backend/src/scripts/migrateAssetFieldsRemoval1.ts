import { MongoClient } from "mongodb";
import { env } from "../config/env";

/** One-off, idempotent migration: removes 12 fields from the Asset Master per an explicit user
 * request (building, room, GPU, biosUefiVersion, deviceUUID, ipAddress, directoryMembership,
 * encryptionStatus, securityAgentStatus, patchStatus, complianceStatus, lastSecurityCheck). Same
 * raw-driver, idempotent pattern as migrateAssetFieldsPhase2/3.ts.
 *
 * Only `GPU` has any real dev-data content (3 records, carried over from the Phase 3 processor/
 * graphicsCard->CPU/GPU rename) - merged into `description` before being unset, same as every
 * other homeless-field removal this session. The other 11 fields are 0-populated in real data and
 * are dropped outright.
 */

const MERGE_FIELDS: { field: string; label: string }[] = [{ field: "GPU", label: "GPU" }];

const UNSET_FIELDS = [
  "building",
  "room",
  "GPU",
  "biosUefiVersion",
  "deviceUUID",
  "ipAddress",
  "directoryMembership",
  "encryptionStatus",
  "securityAgentStatus",
  "patchStatus",
  "complianceStatus",
  "lastSecurityCheck",
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
    .find({ $or: MERGE_FIELDS.map(({ field }) => ({ [field]: { $exists: true, $ne: "" } })) })
    .project({ _id: 1, description: 1, ...Object.fromEntries(MERGE_FIELDS.map(({ field }) => [field, 1])) })
    .toArray();

  let merged = 0;
  for (const doc of mergeCandidates) {
    const base = typeof doc.description === "string" ? doc.description : "";
    const lines = MERGE_FIELDS.filter(({ field }) => !isBlank(doc[field]))
      .map(({ field, label }) => `[${label}] ${String(doc[field]).trim()}`)
      .filter((line) => !base.includes(line));
    if (lines.length === 0) continue;
    const nextDescription = [base, ...lines].filter(Boolean).join("\n\n");
    merged += 1;
    if (!dryRun) {
      await assets.updateOne({ _id: doc._id }, { $set: { description: nextDescription } });
    }
  }
  console.log(`Step 1 (merge GPU into description): ${merged} asset(s) ${dryRun ? "would be" : "were"} updated.`);

  if (doUnset) {
    const count = await assets.countDocuments({ $or: UNSET_FIELDS.map((f) => ({ [f]: { $exists: true } })) });
    console.log(`Step 2 (unset removed fields): ${count} asset(s) ${dryRun ? "would be" : "were"} touched.`);
    if (!dryRun && count > 0) {
      await assets.updateMany({}, { $unset: Object.fromEntries(UNSET_FIELDS.map((f) => [f, ""])) });
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
