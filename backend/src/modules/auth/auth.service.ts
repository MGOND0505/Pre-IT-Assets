import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { env } from "../../config/env";
import { User } from "../../models/User";
import { LoginHistory } from "../../models/LoginHistory";
import { ApiError } from "../../utils/ApiError";
import { signToken } from "../../utils/jwt";
import { emailProvider } from "../../services/email";
import { logAction } from "../audit/audit.service";
import * as organizationsService from "../organizations/organizations.service";

function requestMeta(req: Request) {
  return { ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

/** Resolves an optional org slug to an id. Email is unique PER organization (except the
 * null-org superAdmin/subSuperAdmin accounts, sharing that same global-uniqueness pool), so a
 * slug-less login can only ever reach one of those two system-level roles - it must never
 * silently fall through to matching some org-scoped user instead. */
async function resolveLoginOrganizationId(orgSlug?: string): Promise<string | null> {
  if (!orgSlug) return null;
  const org = await organizationsService.findBySlug(orgSlug);
  if (!org || organizationsService.getSubscriptionState(org) === "Suspended") {
    throw new ApiError(404, "Organization not found");
  }
  return String(org._id);
}

export async function login(req: Request, email: string, password: string, orgSlug?: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const organizationId = await resolveLoginOrganizationId(orgSlug);
  const user = await User.findOne({ organization: organizationId, email: normalizedEmail, isDeleted: false }).select(
    "+passwordHash"
  );

  if (!user) {
    await LoginHistory.create({
      organization: organizationId,
      emailAttempted: normalizedEmail,
      action: "login_failed",
      reason: "not_found",
      ...requestMeta(req),
    });
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.status !== "Active") {
    await LoginHistory.create({
      organization: organizationId,
      user: user.id,
      emailAttempted: normalizedEmail,
      action: "login_failed",
      reason: "account_inactive",
      ...requestMeta(req),
    });
    throw new ApiError(401, "This account has been deactivated");
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await LoginHistory.create({
      organization: organizationId,
      user: user.id,
      emailAttempted: normalizedEmail,
      action: "login_failed",
      reason: "account_locked",
      ...requestMeta(req),
    });
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new ApiError(423, `Account temporarily locked due to repeated failed attempts. Try again in ${minutesLeft} minute(s).`);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    user.failedLoginAttempts += 1;

    let justLocked = false;
    if (user.failedLoginAttempts >= env.LOGIN_LOCKOUT_THRESHOLD) {
      user.lockedUntil = new Date(Date.now() + env.LOGIN_LOCKOUT_DURATION_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
      justLocked = true;
    }
    await user.save();

    await LoginHistory.create({
      organization: organizationId,
      user: user.id,
      emailAttempted: normalizedEmail,
      action: "login_failed",
      reason: "invalid_password",
      ...requestMeta(req),
    });

    if (justLocked) {
      await logAction({
        req,
        action: "ACCOUNT_LOCKED",
        module: "User",
        recordId: user.id,
        recordLabel: user.email,
      });
    }

    throw new ApiError(401, "Invalid email or password");
  }

  user.lastLoginAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  await LoginHistory.create({
    organization: organizationId,
    user: user.id,
    emailAttempted: normalizedEmail,
    action: "login_success",
    ...requestMeta(req),
  });

  const token = signToken({ sub: user.id, tokenVersion: user.tokenVersion });

  return { token, user };
}

export async function recordLogout(req: Request, userId: string, email: string, organizationId: string | null) {
  await LoginHistory.create({
    organization: organizationId,
    user: userId,
    emailAttempted: email,
    action: "logout",
    ...requestMeta(req),
  });
}

export async function forgotPassword(email: string, orgSlug?: string) {
  const normalizedEmail = email.toLowerCase().trim();

  // Always behave the same way whether or not the account/org exists, to avoid leaking
  // which emails (or organizations) are registered - an unknown/inactive orgSlug is treated
  // as "no such user" (silent no-op), not surfaced as a 404 the way login's does.
  let organizationId: string | null = null;
  if (orgSlug) {
    const org = await organizationsService.findBySlug(orgSlug);
    if (!org || organizationsService.getSubscriptionState(org) === "Suspended") return;
    organizationId = String(org._id);
  }

  const user = await User.findOne({ organization: organizationId, email: normalizedEmail, isDeleted: false });
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
  await user.save();

  const resetLink = `${env.FRONTEND_URL}/reset-password/${rawToken}`;

  await emailProvider.send(
    {
      to: user.email,
      subject: "Reset your password",
      html: `<p>Click the link below to reset your password. This link expires in ${env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES} minutes.</p><p><a href="${resetLink}">${resetLink}</a></p>`,
    },
    organizationId
  );
}

export async function resetPassword(rawToken: string, newPassword: string) {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpires");

  if (!user) {
    throw new ApiError(400, "Reset link is invalid or has expired");
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.mustChangePassword = false;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.tokenVersion += 1;
  await user.save();
}

export async function changePassword(req: Request, userId: string, currentPassword: string, newPassword: string) {
  const user = await User.findById(userId).select("+passwordHash");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(400, "Current password is incorrect");
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  user.mustChangePassword = false;
  user.tokenVersion += 1;
  await user.save();

  await logAction({
    req,
    action: "CHANGE_PASSWORD",
    module: "User",
    recordId: user.id,
    recordLabel: user.email,
  });
}
