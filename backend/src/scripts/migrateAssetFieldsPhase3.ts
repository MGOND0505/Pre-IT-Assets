import { MongoClient } from "mongodb";
import { env } from "../config/env";

/** One-off, idempotent migration for the Enterprise ITAM Asset Master consolidation, Phase 3
 * (Hardware / Security). Same raw-driver, idempotent pattern as migrateAssetFieldsPhase2.ts.
 *
 * Steps, in order:
 *   1. Merge any non-blank deviceType/imei/color/laptopGeneration/miscAccessories/adMember/
 *      remoteSoftware/antivirusInstalled content into `description` - these fields no longer
 *      exist on the Asset Master (deviceType/imei/color/laptopGeneration/miscAccessories have no
 *      replacement; adMember/remoteSoftware/antivirusInstalled are superseded by
 *      directoryMembership/securityAgentStatus/antivirusStatus, but not auto-mapped into them -
 *      those need a human to pick the right enum/value, so the old free text is preserved in
 *      description instead of silently discarded or guessed into the new fields).
 *   2. $rename processor->CPU, graphicsCard->GPU.
 *   3. Best-effort, non-destructive split of `operatingSystem` into `operatingSystem` + `osVersion`
 *      for the two patterns real dev data actually contains cleanly ("Windows <version...>",
 *      "Mac OS <version...>"/"macOS <version...>") - anything that doesn't match one of those
 *      prefixes (typos, "N/A", DOS variants, bare codenames like "Sonoma 14.6.1") is left
 *      completely untouched rather than guessed at.
 * Step 4 ($unset the now-migrated fields, and dropping their now-orphaned indexes) is a separate,
 * later run (pass --unset) so steps 1-3 can be verified against real data first.
 */

const MERGE_FIELDS: { field: string; label: string }[] = [
  { field: "deviceType", label: "Device type" },
  { field: "imei", label: "IMEI" },
  { field: "color", label: "Color" },
  { field: "laptopGeneration", label: "Laptop generation" },
  { field: "miscAccessories", label: "Miscellaneous accessories" },
  { field: "adMember", label: "AD member (imported)" },
  { field: "remoteSoftware", label: "Remote software (imported)" },
  { field: "antivirusInstalled", label: "Antivirus installed (imported)" },
];

const RENAMES: { from: string; to: string }[] = [
  { from: "processor", to: "CPU" },
  { from: "graphicsCard", to: "GPU" },
];

const UNSET_FIELDS = [
  "deviceType",
  "configuration",
  "laptopGeneration",
  "miscAccessories",
  "color",
  "imei",
  "serviceTag",
  "adMember",
  "remoteSoftware",
  "antivirusInstalled",
];

// Indexes declared against fields being removed in this phase (see Asset.ts before this
// migration) - Mongoose stops declaring them once the schema changes, but MongoDB never drops an
// existing index on its own, so a stale one would just sit there indexing an unset field forever.
const ORPHANED_INDEX_FIELDS = ["serviceTag", "imei"];

function isBlank(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

/** Splits a legacy free-text OS string into { operatingSystem, osVersion } only when it starts
 * with a confidently-recognized prefix - "Windows ..." or "Mac OS.../macOS...". Anything else
 * (typos like "Winsows", bare codenames, "N/A", DOS variants) is returned unchanged with a blank
 * osVersion, per the plan's explicit "never guess" requirement. */
function parseOperatingSystem(raw: string): { operatingSystem: string; osVersion: string } | null {
  const trimmed = raw.trim();
  const windowsMatch = trimmed.match(/^windows\s*(\d+.*)$/i);
  if (windowsMatch) {
    return { operatingSystem: "Windows", osVersion: windowsMatch[1].trim() };
  }
  const macMatch = trimmed.match(/^mac\s*os\s*(.*)$/i);
  if (macMatch) {
    return { operatingSystem: "macOS", osVersion: macMatch[1].trim() };
  }
  return null;
}

async function run() {
  const dryRun = !process.argv.includes("--apply");
  const doUnset = process.argv.includes("--unset");
  const client = await MongoClient.connect(env.MONGODB_URI);
  const db = client.db();
  const assets = db.collection("assets");

  console.log(dryRun ? "DRY RUN (pass --apply to write changes)" : "APPLYING CHANGES");

  // Step 1: merge homeless legacy fields into description.
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
  console.log(`Step 1 (merge into description): ${merged} asset(s) ${dryRun ? "would be" : "were"} updated.`);

  // Step 2: rename hardware fields.
  for (const { from, to } of RENAMES) {
    const count = await assets.countDocuments({ [from]: { $exists: true } });
    console.log(`Step 2 (rename ${from} -> ${to}): ${count} asset(s) ${dryRun ? "would be" : "were"} renamed.`);
    if (!dryRun && count > 0) {
      await assets.updateMany({ [from]: { $exists: true } }, { $rename: { [from]: to } });
    }
  }

  // Step 3: best-effort operatingSystem -> operatingSystem + osVersion split.
  const osCandidates = await assets
    .find({ operatingSystem: { $exists: true, $ne: "" }, $or: [{ osVersion: { $exists: false } }, { osVersion: "" }] })
    .project({ _id: 1, operatingSystem: 1, osVersion: 1 })
    .toArray();
  let osSplit = 0;
  for (const doc of osCandidates) {
    const parsed = parseOperatingSystem(String(doc.operatingSystem));
    if (!parsed) continue;
    // A parse that only confirms the doc is already in its final state (e.g. "MacOS" -> macOS/"" -
    // no codename to extract) must not count as a change, or a doc with a blank osVersion would
    // stay a "candidate" and get needlessly rewritten (with identical values) on every re-run.
    const alreadyCorrect = doc.operatingSystem === parsed.operatingSystem && (doc.osVersion ?? "") === parsed.osVersion;
    if (alreadyCorrect) continue;
    osSplit += 1;
    if (!dryRun) {
      await assets.updateOne(
        { _id: doc._id },
        { $set: { operatingSystem: parsed.operatingSystem, osVersion: parsed.osVersion } }
      );
    }
  }
  console.log(
    `Step 3 (split operatingSystem -> operatingSystem + osVersion): ${osSplit} of ${osCandidates.length} candidate asset(s) ${dryRun ? "would be" : "were"} split (the rest didn't match a recognized prefix and were left untouched).`
  );

  // Step 4 ($unset + orphaned index cleanup) only runs when explicitly requested.
  if (doUnset) {
    const count = await assets.countDocuments({ $or: UNSET_FIELDS.map((f) => ({ [f]: { $exists: true } })) });
    console.log(`Step 4 (unset legacy fields): ${count} asset(s) ${dryRun ? "would be" : "were"} touched.`);
    if (!dryRun && count > 0) {
      await assets.updateMany({}, { $unset: Object.fromEntries(UNSET_FIELDS.map((f) => [f, ""])) });
    }

    const existingIndexes = await assets.indexes();
    for (const field of ORPHANED_INDEX_FIELDS) {
      const orphaned = existingIndexes.find((idx) => idx.key && Object.keys(idx.key).includes(field));
      if (!orphaned?.name) continue;
      console.log(`Step 4 (drop orphaned index): "${orphaned.name}" (on "${field}") ${dryRun ? "would be" : "was"} dropped.`);
      if (!dryRun) await assets.dropIndex(orphaned.name);
    }
  } else {
    console.log("Step 4 (unset legacy fields + drop orphaned indexes): skipped - pass --unset once steps 1-3 are verified.");
  }

  await client.close();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
