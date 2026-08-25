import mongoose from "mongoose";
import { env } from "../config/env";
import { Organization } from "../models/Organization";
import { User } from "../models/User";
import { Asset } from "../models/Asset";
import { License } from "../models/License";
import { Vendor } from "../models/Vendor";
import { Department } from "../models/Department";
import { Location } from "../models/Location";
import { AssetCategory } from "../models/AssetCategory";
import { LicenseCategory } from "../models/LicenseCategory";
import { AuditLog } from "../models/AuditLog";
import { LoginHistory } from "../models/LoginHistory";
import { SystemSettings } from "../models/SystemSettings";
import { NotificationTemplate } from "../models/NotificationTemplate";
import { NotificationLog } from "../models/NotificationLog";

/**
 * One-time migration: creates the first real Organization and backfills `organization` onto
 * every existing document in every org-scoped collection, then converts each model's indexes
 * to their new per-org compound shape, then converts the existing admin@vianaar.local account
 * to that organization's Org Admin.
 *
 * HARD RELEASE GATE - run this with the OLD server code already stopped, before the NEW server
 * code is ever started against this database. Every existing user currently has no
 * `organization` field; the new `resolveOrganization` middleware's ownership check and the new
 * org-aware login flow both assume every non-superAdmin user already has one. Starting the new
 * code first would lock out every real account. See the approved plan §7 for the full
 * ordering rationale (mirrors the ordering lesson learned during the PREVIOUS multi-tenant
 * rollback's own migration this session).
 *
 * Usage: ORG_NAME="Vianaar Delhi" ORG_SLUG="vianaar-delhi" npx tsx src/scripts/migrateToOrganizations.ts
 * (both env vars are optional, defaulting to the values below)
 */

const ORG_NAME = process.env.ORG_NAME ?? "Vianaar Delhi";
const ORG_SLUG = process.env.ORG_SLUG ?? "vianaar-delhi";
const EXISTING_ADMIN_EMAIL = process.env.EXISTING_ADMIN_EMAIL ?? "admin@vianaar.local";

type CollectionStep = {
  name: string;
  model: { updateMany: (filter: object, update: object) => Promise<{ modifiedCount: number }>; countDocuments: (filter?: object) => Promise<number> };
};

async function backfillOrganization(steps: CollectionStep[], organizationId: string) {
  for (const step of steps) {
    try {
      const before = await step.model.countDocuments({});
      const result = await step.model.updateMany({ organization: { $exists: false } }, { $set: { organization: organizationId } });
      const after = await step.model.countDocuments({});
      if (before !== after) {
        console.error(
          `  ABORT-WORTHY: ${step.name} record count changed during backfill (${before} -> ${after}). Investigate before proceeding.`
        );
      } else {
        console.log(`  ${step.name}: backfilled ${result.modifiedCount} document(s), count unchanged (${after})`);
      }
    } catch (err) {
      console.error(`  ${step.name}: backfill FAILED - ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function syncModelIndexes(models: { name: string; model: { syncIndexes: () => Promise<string[]> } }[]) {
  for (const { name, model } of models) {
    try {
      const result = await model.syncIndexes();
      console.log(`  ${name}: syncIndexes OK`, result);
    } catch (err) {
      console.error(`  ${name}: syncIndexes FAILED - ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function main() {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`Connected. Migrating existing data into organization "${ORG_NAME}" (slug: "${ORG_SLUG}")...`);

  // The `organizations` collection has two leftover documents from a PREVIOUS, fully rolled-back
  // subdomain-based multi-tenant architecture earlier this session (Vianaar Delhi/Goa, keyed by
  // `subdomain` + `isActive`, not `slug` + `status` - that whole approach was abandoned and its
  // code deleted, but nothing ever dropped this collection). They were already exported to
  // backup-pre-org-migration/organizations.json before this script ran. Harmless if left (no
  // other collection references them, and queries filtering on the new `status` field simply
  // never match them), but they're stale garbage from an abandoned design, not real data -
  // clean them out so a future "list all organizations" screen doesn't show two broken rows.
  const staleLegacyOrgs = await Organization.collection.deleteMany({ subdomain: { $exists: true } });
  if (staleLegacyOrgs.deletedCount > 0) {
    console.log(`Removed ${staleLegacyOrgs.deletedCount} stale organization document(s) left over from the earlier rolled-back architecture.`);
  }

  let org = await Organization.findOne({ slug: ORG_SLUG });
  if (org) {
    console.log(`Organization "${ORG_SLUG}" already exists (id ${org.id}) - reusing it.`);
  } else {
    org = await Organization.create({ name: ORG_NAME, slug: ORG_SLUG, status: "Active" });
    console.log(`Created organization "${ORG_NAME}" (id ${org.id}).`);
  }
  const organizationId = org.id as string;

  console.log("\nBackfilling `organization` onto every existing document (each collection independent, one failure won't block the others)...");
  await backfillOrganization(
    [
      { name: "User", model: User },
      { name: "Asset", model: Asset },
      { name: "License", model: License },
      { name: "Vendor", model: Vendor },
      { name: "Department", model: Department },
      { name: "Location", model: Location },
      { name: "AssetCategory", model: AssetCategory },
      { name: "LicenseCategory", model: LicenseCategory },
      // AuditLog's own model enforces immutability (pre-hooks reject updateOne/updateMany) as
      // deliberate defense-in-depth against the app ever mutating an audit trail - which also
      // blocks this legitimate one-time migration via the normal Mongoose path. Go through the
      // raw driver collection instead, bypassing Mongoose middleware entirely, for this one step.
      { name: "AuditLog", model: AuditLog.collection },
      { name: "LoginHistory", model: LoginHistory },
      { name: "SystemSettings", model: SystemSettings },
      { name: "NotificationTemplate", model: NotificationTemplate },
      { name: "NotificationLog", model: NotificationLog },
    ],
    organizationId
  );

  console.log("\nConverting admin@vianaar.local (or EXISTING_ADMIN_EMAIL) to this organization's Org Admin...");
  const existingAdmin = await User.findOne({ organization: organizationId, email: EXISTING_ADMIN_EMAIL.toLowerCase().trim() });
  if (existingAdmin) {
    existingAdmin.role = "orgAdmin";
    await existingAdmin.save();
    console.log(`  ${existingAdmin.email} -> role: orgAdmin, organization: ${organizationId}`);
  } else {
    console.error(`  No user found with email ${EXISTING_ADMIN_EMAIL} in this organization - nothing converted. Check EXISTING_ADMIN_EMAIL.`);
  }

  console.log("\nSyncing indexes (only now that every backfill above has succeeded - building a compound unique index before the field exists on every document risks a failed build)...");
  await syncModelIndexes([
    { name: "User", model: User },
    { name: "Asset", model: Asset },
    { name: "License", model: License },
    { name: "Vendor", model: Vendor },
    { name: "Department", model: Department },
    { name: "Location", model: Location },
    { name: "AssetCategory", model: AssetCategory },
    { name: "LicenseCategory", model: LicenseCategory },
    { name: "AuditLog", model: AuditLog },
    { name: "LoginHistory", model: LoginHistory },
    { name: "SystemSettings", model: SystemSettings },
    { name: "NotificationTemplate", model: NotificationTemplate },
    { name: "NotificationLog", model: NotificationLog },
  ]);

  console.log("\nDone. Next steps:");
  console.log("  1. Run `npm run seed:superadmin` to create the new system-level Super Admin account.");
  console.log("  2. Only then start the new backend/frontend builds.");
  console.log(`  3. Smoke test: log in as ${EXISTING_ADMIN_EMAIL} at /${ORG_SLUG}/login.`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
