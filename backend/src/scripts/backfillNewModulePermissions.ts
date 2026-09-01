import { MongoClient } from "mongodb";
import { env } from "../config/env";

/**
 * One-off, idempotent migration: `knowledgeBase` and `aiAssistant` are brand-new
 * PERMISSION_MODULES entries whose `view` action is meant to be on by default for every user
 * (basicUserDefaultPermissions()/subAdminDefaultPermissions()) - but that default only applies to
 * users CREATED after this deploy. A user document that predates these modules simply has no
 * `permissions.aiAssistant`/`permissions.knowledgeBase` key at all; Mongoose's schema default
 * (`false`) only fills that gap in memory when the document is hydrated, it never touches what's
 * actually stored - so every pre-existing user would silently see the AI Assistant/Knowledge Base
 * as unavailable, contradicting the "on for all users by default" requirement.
 *
 * Deliberately uses the raw MongoDB driver, not the Mongoose User model - Mongoose would apply
 * the `false` default the moment a matching document is read, making an already-migrated (or
 * never-migrated) user indistinguishable from one an admin has since deliberately toggled off.
 * Safe to re-run: only touches documents where the raw stored field is still absent, so an
 * admin's later explicit "off" choice (which leaves the field present, just `false`) is never
 * overwritten by a second run.
 */
async function run() {
  const client = await MongoClient.connect(env.MONGODB_URI);
  const db = client.db();
  const users = db.collection("users");

  const topLevelResult = await users.updateMany(
    { "permissions.aiAssistant": { $exists: false } },
    { $set: { "permissions.aiAssistant.view": true, "permissions.knowledgeBase.view": true } }
  );

  // orgAccess entries (subSuperAdmin's per-org grants) hit the exact same gap independently -
  // each array element is its own full PermissionsShape, predating these modules just the same.
  const orgAccessResult = await users.updateMany(
    { "orgAccess.0": { $exists: true }, "orgAccess.permissions.aiAssistant": { $exists: false } },
    {
      $set: {
        "orgAccess.$[].permissions.aiAssistant.view": true,
        "orgAccess.$[].permissions.knowledgeBase.view": true,
      },
    }
  );

  console.log(
    `Done. Backfilled ${topLevelResult.modifiedCount} user(s)' top-level permissions and ` +
      `${orgAccessResult.modifiedCount} user(s)' orgAccess grants.`
  );
  await client.close();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
