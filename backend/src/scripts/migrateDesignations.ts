import { MongoClient, ObjectId } from "mongodb";
import { env } from "../config/env";

/** One-off, idempotent migration: User.designation changed from a free-text string to an
 * ObjectId ref (models/Designation.ts). Converts every organization's existing distinct
 * designation strings into managed Designation records, then repoints each affected user's
 * `designation` field at the matching record's _id.
 *
 * Uses the raw MongoDB driver throughout, deliberately NOT the Mongoose User/Designation models -
 * this must work correctly regardless of whether it runs before or after User.ts's schema change
 * has been deployed (an old string value would fail to cast under the new ObjectId schema if read
 * through Mongoose). Safe to re-run: only touches users whose `designation` field is still a
 * string (an already-migrated ObjectId is skipped, so a second run is a no-op). */
async function run() {
  const client = await MongoClient.connect(env.MONGODB_URI);
  const db = client.db();
  const users = db.collection("users");
  const designations = db.collection("designations");

  // Deliberately NOT filtering by isDeleted - a soft-deleted user's designation field would still
  // fail to cast the moment anything reads it through the new schema (e.g. the Users Recycle Bin
  // view), so every user needs converting regardless of deletion state.
  const candidates = await users
    .find({ designation: { $type: "string" } })
    .project({ _id: 1, organization: 1, designation: 1 })
    .toArray();

  let designationsCreated = 0;
  let usersUpdated = 0;
  // organizationId -> (lowercased name -> designation _id), so repeated names within one org
  // reuse the same record instead of racing duplicate creates.
  const cache = new Map<string, Map<string, ObjectId>>();

  for (const user of candidates) {
    const rawName = typeof user.designation === "string" ? user.designation.trim() : "";
    if (!rawName) {
      // Blank/whitespace-only string - just null it out, nothing to create a record for.
      await users.updateOne({ _id: user._id }, { $set: { designation: null } });
      usersUpdated += 1;
      continue;
    }

    const orgKey = String(user.organization);
    const nameKey = rawName.toLowerCase();
    if (!cache.has(orgKey)) cache.set(orgKey, new Map());
    const orgCache = cache.get(orgKey)!;

    let designationId = orgCache.get(nameKey);
    if (!designationId) {
      const existing = await designations.findOne({
        organization: user.organization,
        name: new RegExp(`^${rawName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      });
      if (existing) {
        designationId = existing._id;
      } else {
        const now = new Date();
        const inserted = await designations.insertOne({
          organization: user.organization,
          name: rawName,
          description: "",
          status: "Active",
          isDeleted: false,
          deletedAt: null,
          deletedBy: null,
          createdDate: now,
          updatedDate: now,
        });
        designationId = inserted.insertedId;
        designationsCreated += 1;
      }
      orgCache.set(nameKey, designationId);
    }

    await users.updateOne({ _id: user._id }, { $set: { designation: designationId } });
    usersUpdated += 1;
  }

  console.log(
    `Done. ${candidates.length} user(s) had a string designation - created ${designationsCreated} Designation record(s), updated ${usersUpdated} user(s).`
  );
  await client.close();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
