import mongoose from "mongoose";
import { env } from "../config/env";

/**
 * One-off migration: `fileUpload` is a brand-new ENTITLEMENT_MODULES entry gating the Asset
 * Documents tab, Ticket attachments, and Task attachments. Organization.enabledModules only gets
 * every-module-on as a schema DEFAULT at document creation - a pre-existing org's stored array
 * simply doesn't mention "fileUpload" at all, so requireModuleEnabled would treat every existing
 * org as having file attachments freshly disabled the moment this deploys, breaking a
 * previously-working feature for every org that was already using it.
 *
 * Run this exactly once, right after this code ships. It is NOT safe to re-run later once a
 * Super Admin has deliberately turned fileUpload off for some org - "never had it" and
 * "explicitly disabled" both look identical (absent from the array), so a later re-run would
 * silently re-enable an org someone turned it off for.
 */
async function run() {
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db!;
  const organizations = db.collection("organizations");

  const result = await organizations.updateMany(
    { enabledModules: { $ne: "fileUpload" } },
    { $addToSet: { enabledModules: "fileUpload" } }
  );

  console.log(`Done. Backfilled fileUpload into ${result.modifiedCount} organization(s)' enabledModules.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
