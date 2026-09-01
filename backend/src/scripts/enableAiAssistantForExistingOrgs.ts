import mongoose from "mongoose";
import { env } from "../config/env";
import { Organization } from "../models/Organization";

/** One-off, idempotent migration: "aiAssistant" was just added to ENTITLEMENT_MODULES, and new
 * orgs default to every entitlement module enabled - but that default only ever applies at
 * creation time, so every org created before this change has an enabledModules array that's
 * missing the new entry. Safe to re-run; an org that already has it is left untouched. */
async function run() {
  await mongoose.connect(env.MONGODB_URI);

  const orgs = await Organization.find({ enabledModules: { $ne: "aiAssistant" } }).select("_id name enabledModules");
  let updated = 0;

  for (const org of orgs) {
    org.enabledModules.push("aiAssistant");
    await org.save();
    console.log(`Enabled aiAssistant for: ${org.name}`);
    updated += 1;
  }

  console.log(`\nDone. Updated ${updated} organization(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
