import { MongoClient } from "mongodb";
import { env } from "../config/env";

/** One-off, idempotent migration for the Assets module's category-based redesign, Phase 4. Same
 * raw-driver, idempotent pattern as migrateDesignations.ts/migrateAssetFieldsPhase2/3.ts - reads
 * the raw stored document (not through Mongoose, whose schema `default` would otherwise mask
 * "field never set" as "field explicitly set to the default value" and defeat every idempotency
 * check below).
 *
 * Three steps:
 *   1. Backfill `group` on every existing AssetCategory by name (the same mapping now baked into
 *      config/masterDataDefaults.ts for future new-org seeding).
 *   2. Curate `visibleCoreFields` for the categories the spec gives an explicit field list for
 *      (Mobile, TV, and the IT Infrastructure types) - Laptop/Desktop are deliberately left at the
 *      `null` default ("show every field"), matching how broad their spec field list already is.
 *      `listColumns` is intentionally NOT seeded here - it depends on the frontend's per-column key
 *      convention, which Phase 7 (dynamic list columns) introduces; seeding a guess now would just
 *      need redoing then.
 *   3. Seed one category-scoped CustomFieldDefinition per named type's spec-called-out extra field
 *      (IMEI/Mobile Number for Mobile, Screen Size/Resolution for TV, Rack/Port Count/Management IP
 *      for the infrastructure types) - skipped per-org if a definition with that label already
 *      exists for that category (re-run safe).
 *   4. Drops the old 3-field CustomFieldDefinition unique index
 *      ({organization,module,key}) now that the model declares the 4-field
 *      ({organization,module,category,key}) index instead - MongoDB never drops a superseded index
 *      on its own.
 */

const GROUP_BY_CATEGORY_NAME: Record<string, string> = {
  Laptop: "End-User Computing",
  Desktop: "End-User Computing",
  Mobile: "Mobile Devices",
  Monitor: "Display & AV",
  Projector: "Display & AV",
  TV: "Display & AV",
  Server: "IT Infrastructure",
  Firewall: "IT Infrastructure",
  Router: "IT Infrastructure",
  Switch: "IT Infrastructure",
  "Access Point": "IT Infrastructure",
  CCTV: "IT Infrastructure",
  Printer: "Peripherals & Other",
  Scanner: "Peripherals & Other",
  Tablet: "Peripherals & Other",
  "NAS/Storage": "Peripherals & Other",
  UPS: "Peripherals & Other",
  Keyboard: "Peripherals & Other",
  Mouse: "Peripherals & Other",
  Headset: "Peripherals & Other",
  Other: "Peripherals & Other",
};

const INFRA_VISIBLE_CORE_FIELDS = ["macAddress", "hostname", "domainName"];

const VISIBLE_CORE_FIELDS_BY_CATEGORY_NAME: Record<string, string[]> = {
  Mobile: ["operatingSystem", "osVersion"],
  TV: [],
  Server: INFRA_VISIBLE_CORE_FIELDS,
  Firewall: INFRA_VISIBLE_CORE_FIELDS,
  Router: INFRA_VISIBLE_CORE_FIELDS,
  Switch: INFRA_VISIBLE_CORE_FIELDS,
  "Access Point": INFRA_VISIBLE_CORE_FIELDS,
  CCTV: INFRA_VISIBLE_CORE_FIELDS,
};

const INFRA_CUSTOM_FIELDS = [
  { label: "Rack", type: "text" },
  { label: "Port Count", type: "number" },
  { label: "Management IP", type: "text" },
  { label: "Firmware Version", type: "text" },
];

const CUSTOM_FIELDS_BY_CATEGORY_NAME: Record<string, { label: string; type: string }[]> = {
  Mobile: [
    { label: "IMEI", type: "text" },
    { label: "Mobile Number", type: "text" },
  ],
  TV: [
    { label: "Screen Size", type: "text" },
    { label: "Resolution", type: "text" },
  ],
  Server: INFRA_CUSTOM_FIELDS,
  Firewall: INFRA_CUSTOM_FIELDS,
  Router: INFRA_CUSTOM_FIELDS,
  Switch: INFRA_CUSTOM_FIELDS,
  "Access Point": INFRA_CUSTOM_FIELDS,
  CCTV: INFRA_CUSTOM_FIELDS,
};

function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function run() {
  const dryRun = !process.argv.includes("--apply");
  const client = await MongoClient.connect(env.MONGODB_URI);
  const db = client.db();
  const categories = db.collection("assetcategories");
  const customFieldDefinitions = db.collection("customfielddefinitions");

  console.log(dryRun ? "DRY RUN (pass --apply to write changes)" : "APPLYING CHANGES");

  // Step 1: backfill group.
  const allCategories = await categories.find({}).project({ name: 1, group: 1 }).toArray();
  let groupsBackfilled = 0;
  for (const doc of allCategories) {
    if (doc.group !== undefined) continue; // already migrated
    const group = GROUP_BY_CATEGORY_NAME[doc.name] ?? "Peripherals & Other";
    groupsBackfilled += 1;
    if (!dryRun) await categories.updateOne({ _id: doc._id }, { $set: { group } });
  }
  console.log(`Step 1 (backfill group): ${groupsBackfilled} of ${allCategories.length} categor(y/ies) ${dryRun ? "would be" : "were"} updated.`);

  // Step 2: curate visibleCoreFields for the named types the spec gives an explicit field list for.
  let visibleFieldsCurated = 0;
  for (const doc of allCategories) {
    const fields = VISIBLE_CORE_FIELDS_BY_CATEGORY_NAME[doc.name];
    if (!fields) continue;
    const fresh = await categories.findOne({ _id: doc._id }, { projection: { visibleCoreFields: 1 } });
    if (fresh && fresh.visibleCoreFields !== undefined && fresh.visibleCoreFields !== null) continue; // already curated
    visibleFieldsCurated += 1;
    if (!dryRun) await categories.updateOne({ _id: doc._id }, { $set: { visibleCoreFields: fields } });
  }
  console.log(`Step 2 (curate visibleCoreFields): ${visibleFieldsCurated} categor(y/ies) ${dryRun ? "would be" : "were"} curated.`);

  // Step 3: drop the superseded 3-field unique index FIRST - seeding multiple category-scoped
  // definitions that share a key within one org (e.g. "rack" on both Server and Switch) would
  // otherwise collide against the old {organization,module,key} index, which doesn't know about
  // `category` at all.
  const existingIndexes = await customFieldDefinitions.indexes();
  const oldIndex = existingIndexes.find(
    (idx) => idx.key && Object.keys(idx.key).join(",") === "organization,module,key"
  );
  if (oldIndex?.name) {
    console.log(`Step 3 (drop superseded index): "${oldIndex.name}" ${dryRun ? "would be" : "was"} dropped.`);
    if (!dryRun) await customFieldDefinitions.dropIndex(oldIndex.name);
  } else {
    console.log("Step 3 (drop superseded index): already gone, nothing to do.");
  }

  // Step 4: seed category-scoped custom fields.
  let customFieldsSeeded = 0;
  for (const doc of allCategories) {
    const defs = CUSTOM_FIELDS_BY_CATEGORY_NAME[doc.name];
    if (!defs) continue;
    for (const def of defs) {
      const key = slugify(def.label);
      const existing = await customFieldDefinitions.findOne({
        organization: doc.organization,
        module: "assets",
        category: doc._id,
        key,
        isDeleted: false,
      });
      if (existing) continue;
      customFieldsSeeded += 1;
      if (!dryRun) {
        const now = new Date();
        await customFieldDefinitions.insertOne({
          organization: doc.organization,
          module: "assets",
          category: doc._id,
          label: def.label,
          key,
          type: def.type,
          options: [],
          required: false,
          order: 0,
          status: "Active",
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          createdDate: now,
          updatedDate: now,
        });
      }
    }
  }
  console.log(`Step 4 (seed scoped custom fields): ${customFieldsSeeded} definition(s) ${dryRun ? "would be" : "were"} created.`);

  await client.close();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
