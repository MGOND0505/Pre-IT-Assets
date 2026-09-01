import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";

/** One-off, idempotent migration: passwordChangedAt is new and null for every account that
 * predates it. Backfill each to that user's own createdDate (the best available approximation)
 * so turning on password expiry later doesn't instantly treat every existing account as already
 * expired. Safe to re-run - only touches users where the field is still null. */
async function run() {
  await mongoose.connect(env.MONGODB_URI);

  const users = await User.find({ passwordChangedAt: null }).select("_id email createdDate");
  let updated = 0;

  for (const user of users) {
    await User.updateOne({ _id: user._id }, { passwordChangedAt: user.get("createdDate") });
    updated += 1;
  }

  console.log(`Done. Backfilled passwordChangedAt for ${updated} user(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
