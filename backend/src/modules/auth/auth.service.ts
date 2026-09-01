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
import { getPasswordPolicy, getSettings } from "../settings/settings.service";
import { BASELINE_POLICY, validatePasswordAgainstPolicy, assertPasswordNotReused, pushPasswordHistory } from "../../utils/passwordPolicy";
import { verifyTurnstileToken } from "../../utils/turnstile";
import { getEffectiveLoginLockout, getEffectiveTurnstileKeys } from "../platformSettings/platformSettings.service";

/** Throws if CAPTCHA is required and the token is missing/invalid. Used by forgotPassword/
 * resetPassword, which don't write to LoginHistory at all - login() uses resolveCaptchaStatus
 * below instead, since a failed CAPTCHA there still needs its own LoginHistory entry before the
 * request is rejected. */
async function assertCaptchaSolved(organizationId: string | null, captchaToken: string | undefined, remoteIp?: string) {
  const verified = await resolveCaptchaStatus(organizationId, captchaToken, remoteIp);
  if (verified === false) {
    throw new ApiError(400, "Please complete the CAPTCHA challenge.");
  }
}

/** null = CAPTCHA not required for this attempt. true/false = required, and whether the
 * supplied token actually verified. Applies to every role with no exception: org-scoped
 * accounts (orgAdmin/teamMember) follow their own org's configurable captchaEnabled toggle;
 * the org-agnostic flat login (superAdmin/subSuperAdmin - no org to hold a toggle) requires it
 * unconditionally whenever the server has Turnstile configured at all. */
async function resolveCaptchaStatus(
  organizationId: string | null,
  captchaToken: string | undefined,
  remoteIp?: string
): Promise<boolean | null> {
  if (!organizationId) {
    const { secretKey } = await getEffectiveTurnstileKeys();
    if (!secretKey) return null;
    return Boolean(captchaToken) && (await verifyTurnstileToken(captchaToken!, remoteIp));
  }
  const settings = await getSettings(organizationId);
  if (!settings.captchaEnabled) return null;
  return Boolean(captchaToken) && (await verifyTurnstileToken(captchaToken!, remoteIp));
}

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

export async function login(
  req: Request,
  email: string,
  password: string,
  orgSlug?: string,
  captchaToken?: string,
  portal?: "employee"
) {
  const normalizedEmail = email.toLowerCase().trim();
  const organizationId = await resolveLoginOrganizationId(orgSlug);
  const captchaVerified = await resolveCaptchaStatus(organizationId, captchaToken, req.ip);

  if (captchaVerified === false) {
    await LoginHistory.create({
      organization: organizationId,
      emailAttempted: normalizedEmail,
      action: "login_failed",
      reason: "captcha_failed",
      captchaVerified: false,
      ...requestMeta(req),
    });
    throw new ApiError(400, "Please complete the CAPTCHA challenge.");
  }

  const user = await User.findOne({ organization: organizationId, email: normalizedEmail, isDeleted: false }).select(
    "+passwordHash"
  );

  if (!user) {
    await LoginHistory.create({
      organization: organizationId,
      emailAttempted: normalizedEmail,
      action: "login_failed",
      reason: "not_found",
      captchaVerified,
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
      captchaVerified,
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
      captchaVerified,
      ...requestMeta(req),
    });
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw new ApiError(423, `Account temporarily locked due to repeated failed attempts. Try again in ${minutesLeft} minute(s).`);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    user.failedLoginAttempts += 1;

    const { threshold, durationMinutes } = await getEffectiveLoginLockout();
    let justLocked = false;
    if (user.failedLoginAttempts >= threshold) {
      user.lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
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
      captchaVerified,
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

  // Checked only AFTER the password is confirmed correct, same as every other post-password
  // rejection above - checking it earlier would let a wrong-portal error leak "this email
  // belongs to a non-Employee account" to someone who doesn't even know the real password yet.
  // Does not touch failedLoginAttempts/lastLoginAt - this isn't a credential failure, so it
  // shouldn't count toward lockout or look like one in the account's own login history.
  if (portal === "employee" && !(user.role === "teamMember" && user.employeeTier === "employee")) {
    await LoginHistory.create({
      organization: organizationId,
      user: user.id,
      emailAttempted: normalizedEmail,
      action: "login_failed",
      reason: "wrong_portal",
      captchaVerified,
      ...requestMeta(req),
    });
    throw new ApiError(403, "This login page is for Employee accounts only. Please use the standard login page.");
  }

  user.lastLoginAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;

  // Password expiration - org-configurable, 0 days means "never expires". Forcing the change
  // itself just sets the same mustChangePassword flag admin-forced resets already use;
  // authenticate.ts is what actually blocks the rest of the app until it's cleared.
  let passwordExpiryWarning: { daysRemaining: number } | null = null;
  if (organizationId && user.passwordChangedAt) {
    const settings = await getSettings(organizationId);
    if (settings.passwordExpiryDays > 0) {
      const ageDays = (Date.now() - user.passwordChangedAt.getTime()) / (24 * 60 * 60 * 1000);
      const daysRemaining = Math.ceil(settings.passwordExpiryDays - ageDays);
      if (daysRemaining <= 0) {
        user.mustChangePassword = true;
      } else if (daysRemaining <= settings.passwordExpiryWarningDays) {
        passwordExpiryWarning = { daysRemaining };
      }
    }
  }

  await user.save();

  await LoginHistory.create({
    organization: organizationId,
    user: user.id,
    emailAttempted: normalizedEmail,
    action: "login_success",
    captchaVerified,
    ...requestMeta(req),
  });

  const token = signToken({ sub: user.id, tokenVersion: user.tokenVersion, lastActivity: Date.now() });

  return { token, user, passwordExpiryWarning };
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

export async function forgotPassword(email: string, orgSlug?: string, captchaToken?: string, remoteIp?: string) {
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

  await assertCaptchaSolved(organizationId, captchaToken, remoteIp);

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

export async function resetPassword(rawToken: string, newPassword: string, captchaToken?: string, remoteIp?: string) {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpires +passwordHash +passwordHistory");

  if (!user) {
    throw new ApiError(400, "Reset link is invalid or has expired");
  }

  await assertCaptchaSolved(user.organization ? String(user.organization) : null, captchaToken, remoteIp);

  const policy = user.organization ? await getPasswordPolicy(String(user.organization)) : BASELINE_POLICY;
  const violations = validatePasswordAgainstPolicy(newPassword, policy);
  if (violations.length > 0) throw new ApiError(400, violations.join(" "));
  await assertPasswordNotReused(newPassword, user, policy.historyLimit);

  const oldHash = user.passwordHash;
  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  pushPasswordHistory(user, oldHash, policy.historyLimit);
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.mustChangePassword = false;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.tokenVersion += 1;
  await user.save();
}

export async function changePassword(req: Request, userId: string, currentPassword: string, newPassword: string) {
  const user = await User.findById(userId).select("+passwordHash +passwordHistory");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(400, "Current password is incorrect");
  }

  const policy = user.organization ? await getPasswordPolicy(String(user.organization)) : BASELINE_POLICY;
  const violations = validatePasswordAgainstPolicy(newPassword, policy);
  if (violations.length > 0) throw new ApiError(400, violations.join(" "));
  await assertPasswordNotReused(newPassword, user, policy.historyLimit);

  const oldHash = user.passwordHash;
  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  pushPasswordHistory(user, oldHash, policy.historyLimit);
  user.passwordChangedAt = new Date();
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
