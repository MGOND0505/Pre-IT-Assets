import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { Role } from "../models/Role";
import { ensureRbacDefaults } from "./seedRbacDefaults";

async function seed() {
  if (!env.SUPERADMIN_SEED_EMAIL || !env.SUPERADMIN_SEED_PASSWORD) {
    console.error("SUPERADMIN_SEED_EMAIL and SUPERADMIN_SEED_PASSWORD must be set in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);
  await ensureRbacDefaults();

  const superAdminRole = await Role.findOne({ name: "Super Admin" });
  if (!superAdminRole) {
    throw new Error('"Super Admin" role not found after seeding defaults - this should not happen');
  }

  const existing = await User.findOne({ email: env.SUPERADMIN_SEED_EMAIL.toLowerCase().trim() });

  if (existing) {
    console.log(`SuperAdmin already exists: ${existing.email} (skipping)`);
  } else {
    const passwordHash = await bcrypt.hash(env.SUPERADMIN_SEED_PASSWORD, env.BCRYPT_SALT_ROUNDS);

    const admin = await User.create({
      name: env.SUPERADMIN_SEED_NAME ?? "Super Admin",
      email: env.SUPERADMIN_SEED_EMAIL,
      roles: [superAdminRole.id],
      passwordHash,
      status: "Active",
      mustChangePassword: false,
    });

    console.log(`SuperAdmin created: ${admin.email}`);
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
