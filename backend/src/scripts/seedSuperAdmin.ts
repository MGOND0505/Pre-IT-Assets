import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { emptyPermissions } from "../config/permissions";

async function seed() {
  if (!env.SUPERADMIN_SEED_EMAIL || !env.SUPERADMIN_SEED_PASSWORD) {
    console.error("SUPERADMIN_SEED_EMAIL and SUPERADMIN_SEED_PASSWORD must be set in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);

  const existing = await User.findOne({ email: env.SUPERADMIN_SEED_EMAIL.toLowerCase().trim() });

  if (existing) {
    console.log(`Admin already exists: ${existing.email} (skipping)`);
  } else {
    const passwordHash = await bcrypt.hash(env.SUPERADMIN_SEED_PASSWORD, env.BCRYPT_SALT_ROUNDS);

    const admin = await User.create({
      name: env.SUPERADMIN_SEED_NAME ?? "Admin",
      email: env.SUPERADMIN_SEED_EMAIL,
      passwordHash,
      isAdmin: true,
      permissions: emptyPermissions(),
      status: "Active",
      mustChangePassword: false,
    });

    console.log(`Admin created: ${admin.email}`);
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
