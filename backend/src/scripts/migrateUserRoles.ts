import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { Role } from "../models/Role";
import { ensureRbacDefaults } from "./seedRbacDefaults";
import { LEGACY_ROLE_MIGRATION } from "../config/permissionCatalog";

/**
 * One-time migration: Phase-1 users had a single `role` string field
 * (SuperAdmin/ITManager/ITExecutive/Viewer). This converts them to the new
 * `roles: ObjectId[]` field per LEGACY_ROLE_MIGRATION, then drops the old field.
 * Safe to re-run: users that already have `roles` set and no `role` field are skipped.
 */
async function migrate() {
  await mongoose.connect(env.MONGODB_URI);
  await ensureRbacDefaults();

  const roleDocs = await Role.find();
  // Use the real ObjectId (`_id`), not the `.id` string virtual - this is written via the
  // raw driver below (bypassing Mongoose's schema casting), so it must already be a true ObjectId.
  const roleIdByName = new Map(roleDocs.map((r) => [r.name, r._id]));

  const legacyUsers = await mongoose.connection
    .collection("users")
    .find({ role: { $exists: true } })
    .toArray();

  if (legacyUsers.length === 0) {
    console.log("No users with a legacy `role` field found - nothing to migrate.");
  }

  for (const doc of legacyUsers) {
    const legacyRole = doc.role as string;
    const newRoleName = LEGACY_ROLE_MIGRATION[legacyRole];
    const newRoleId = newRoleName ? roleIdByName.get(newRoleName) : undefined;

    if (!newRoleId) {
      console.warn(`Skipping user ${doc.email}: no mapping for legacy role "${legacyRole}"`);
      continue;
    }

    await mongoose.connection.collection("users").updateOne(
      { _id: doc._id },
      { $set: { roles: [newRoleId] }, $unset: { role: "" } }
    );
    console.log(`Migrated ${doc.email}: ${legacyRole} -> ${newRoleName}`);
  }

  const remaining = await User.countDocuments({ roles: { $exists: false } });
  if (remaining > 0) {
    console.warn(`${remaining} user(s) still have no roles assigned - check manually.`);
  }

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
