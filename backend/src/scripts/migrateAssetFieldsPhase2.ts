import { MongoClient, ObjectId } from "mongodb";
import { env } from "../config/env";

/** One-off, idempotent migration for the Enterprise ITAM Asset Master consolidation, Phase 2
 * (Assignment / Location / Procurement & Financial / Warranty & Contract).
 *
 * Uses the raw MongoDB driver throughout (same pattern as migrateDesignations.ts), deliberately
 * NOT the Mongoose Asset model - this must work correctly regardless of whether it runs before or
 * after Asset.ts's schema change has been deployed (a field the new schema no longer declares
 * would just be silently dropped by Mongoose on save, never actually migrated).
 *
 * Three idempotent steps, in order:
 *   1. Merge any non-blank companyName/conditionNotes/approvalStatus/notes/employeeId/
 *      employeeName/email/designation/currentOwner content into `description` (one labeled line
 *      each) - these fields no longer exist on the Asset Master, employeeId/employeeName/email/
 *      designation/currentOwner are derived live from `assignedUser` instead, but a handful of
 *      real dev-data records have this content with NO assignedUser set at all, so deriving would
 *      otherwise silently lose it.
 *   2. $rename poNumber->purchaseOrderNumber, warrantyStart->warrantyStartDate,
 *      warrantyEnd->warrantyEndDate, amcStart->contractStartDate, amcEnd->contractEndDate.
 *   3. Seed one "Assigned" AssetHistory entry for every asset that currently has assignedUser set
 *      and has no existing Assigned/Reassigned history row yet - without this, currentOwner's
 *      newly-derived-from-AssetHistory value would show "no history" for already-assigned assets
 *      immediately after this migration runs.
 *
 * Step 4 ($unset the now-migrated fields) is intentionally a separate, later run of this same
 * script (pass --unset) so the merge/rename/seed steps can be verified against real data first.
 */

const MERGE_FIELDS: { field: string; label: string }[] = [
  { field: "companyName", label: "Company name" },
  { field: "conditionNotes", label: "Condition notes" },
  { field: "approvalStatus", label: "Approval status" },
  { field: "notes", label: "Notes" },
  { field: "userAccessLevel", label: "User access level" },
  { field: "employeeId", label: "Employee ID (imported)" },
  { field: "employeeName", label: "Employee name (imported)" },
  { field: "email", label: "Email (imported)" },
  { field: "designation", label: "Designation (imported)" },
  { field: "currentOwner", label: "Current owner (imported)" },
];

const RENAMES: { from: string; to: string }[] = [
  { from: "poNumber", to: "purchaseOrderNumber" },
  { from: "warrantyStart", to: "warrantyStartDate" },
  { from: "warrantyEnd", to: "warrantyEndDate" },
  { from: "amcStart", to: "contractStartDate" },
  { from: "amcEnd", to: "contractEndDate" },
];

const UNSET_FIELDS = [
  "currentOwner",
  "previousOwner",
  "userAccessLevel",
  "employeeId",
  "employeeName",
  "email",
  "designation",
  "companyName",
  "conditionNotes",
  "approvalStatus",
  "notes",
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
  const assetHistories = db.collection("assethistories");

  console.log(dryRun ? "DRY RUN (pass --apply to write changes)" : "APPLYING CHANGES");

  // Step 1: merge homeless legacy fields into description.
  const mergeCandidates = await assets
    .find({ $or: MERGE_FIELDS.map(({ field }) => ({ [field]: { $exists: true, $ne: "" } })) })
    .project({ _id: 1, description: 1, ...Object.fromEntries(MERGE_FIELDS.map(({ field }) => [field, 1])) })
    .toArray();

  let merged = 0;
  for (const doc of mergeCandidates) {
    const base = typeof doc.description === "string" ? doc.description : "";
    // Idempotency guard: a re-run before Step 4's $unset would otherwise see the same
    // still-populated legacy fields and append duplicate lines - skip any line already present.
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
  console.log(`Step 1 (merge into description): ${merged} asset(s) ${dryRun ? "would be" : "were"} updated.`);

  // Step 2: rename procurement/warranty fields.
  for (const { from, to } of RENAMES) {
    const count = await assets.countDocuments({ [from]: { $exists: true } });
    console.log(`Step 2 (rename ${from} -> ${to}): ${count} asset(s) ${dryRun ? "would be" : "were"} renamed.`);
    if (!dryRun && count > 0) {
      await assets.updateMany({ [from]: { $exists: true } }, { $rename: { [from]: to } });
    }
  }

  // Step 3: seed one "Assigned" AssetHistory entry for already-assigned assets with no history yet.
  const assignedAssets = await assets
    .find({ assignedUser: { $ne: null, $exists: true } })
    .project({ _id: 1, assignedUser: 1 })
    .toArray();
  let seeded = 0;
  for (const doc of assignedAssets) {
    const hasAssignmentHistory = await assetHistories.countDocuments({
      asset: doc._id,
      action: { $in: ["Assigned", "Reassigned"] },
    });
    if (hasAssignmentHistory > 0) continue;
    seeded += 1;
    if (!dryRun) {
      await assetHistories.insertOne({
        asset: doc._id,
        action: "Assigned",
        user: null,
        previousValue: null,
        newValue: doc.assignedUser instanceof ObjectId ? String(doc.assignedUser) : doc.assignedUser,
        remarks: "Backfilled by migrateAssetFieldsPhase2 - asset was already assigned before assignment history tracking began.",
        createdAt: new Date(),
      });
    }
  }
  console.log(`Step 3 (seed Assigned history): ${seeded} asset(s) ${dryRun ? "would get" : "got"} a backfilled entry.`);

  // Step 4 ($unset) only runs when explicitly requested, after steps 1-3 have been verified.
  if (doUnset) {
    const count = await assets.countDocuments({ $or: UNSET_FIELDS.map((f) => ({ [f]: { $exists: true } })) });
    console.log(`Step 4 (unset legacy fields): ${count} asset(s) ${dryRun ? "would be" : "were"} touched.`);
    if (!dryRun && count > 0) {
      await assets.updateMany({}, { $unset: Object.fromEntries(UNSET_FIELDS.map((f) => [f, ""])) });
    }
  } else {
    console.log("Step 4 (unset legacy fields): skipped - pass --unset once steps 1-3 are verified.");
  }

  await client.close();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
