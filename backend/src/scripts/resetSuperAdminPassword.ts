import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";

/** One-off helper to reset an existing user's password by email (originally just for the
 * system-level Super Admin seed account, generalized after discovering a second, actually-used
 * superadmin@vianaar.local account with real browser login history - seedSuperAdmin.ts only
 * ever touches the seed-config email, so it can't reach this one). Reads the target email from
 * RESET_TARGET_EMAIL and the new password from SUPERADMIN_SEED_PASSWORD in backend/.env. Also
 * clears any lockout/failed-attempt state so a fresh password can't be blocked by leftover
 * lockout data from earlier failed tries. */
async function run() {
  const targetEmail = process.env.RESET_TARGET_EMAIL || env.SUPERADMIN_SEED_EMAIL;
  if (!targetEmail || !env.SUPERADMIN_SEED_PASSWORD) {
    console.error("RESET_TARGET_EMAIL (or SUPERADMIN_SEED_EMAIL) and SUPERADMIN_SEED_PASSWORD must be set");
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);

  const user = await User.findOne({ email: targetEmail.toLowerCase().trim() });
  if (!user) {
    console.error(`No user found with email ${targetEmail}.`);
    process.exit(1);
  }

  user.passwordHash = await bcrypt.hash(env.SUPERADMIN_SEED_PASSWORD, env.BCRYPT_SALT_ROUNDS);
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  console.log(`Password reset for ${user.email}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
