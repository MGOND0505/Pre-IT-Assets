import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { env } from "../../config/env";
import { User } from "../../models/User";
import { LoginHistory } from "../../models/LoginHistory";
import { ApiError } from "../../utils/ApiError";
import { signToken } from "../../utils/jwt";
import { emailProvider } from "../../services/email";
import { createNotification } from "../notifications/notifications.service";
import { logAction } from "../audit/audit.service";

function requestMeta(req: Request) {
  return { ipAddress: req.ip ?? null, userAgent: req.get("user-agent") ?? null };
}

export async function login(req: Request, email: string, password: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail }).select("+passwordHash");

  if (!user) {
    await LoginHistory.create({
      emailAttempted: normalizedEmail,
      action: "login_failed",
      reason: "not_found",
      ...requestMeta(req),
    });
    throw new ApiError(401, "Invalid email or password");
  }

  if (user.status !== "Active") {
    await LoginHistory.create({
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
      await createNotification({
        recipients: [user.id],
        type: "ACCOUNT",
        title: "Account temporarily locked",
        message: `Too many failed login attempts. Your account is locked for ${env.LOGIN_LOCKOUT_DURATION_MINUTES} minutes.`,
      });
    }

    throw new ApiError(401, "Invalid email or password");
  }

  user.lastLoginAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  await LoginHistory.create({
    user: user.id,
    emailAttempted: normalizedEmail,
    action: "login_success",
    ...requestMeta(req),
  });

  const token = signToken({ sub: user.id, tokenVersion: user.tokenVersion });

  return { token, user };
}

export async function recordLogout(req: Request, userId: string, email: string) {
  await LoginHistory.create({
    user: userId,
    emailAttempted: email,
    action: "logout",
    ...requestMeta(req),
  });
}

export async function forgotPassword(email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });

  // Always behave the same way whether or not the account exists, to avoid leaking which emails are registered.
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpires = new Date(Date.now() + env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);
  await user.save();

  const resetLink = `${env.FRONTEND_URL}/reset-password/${rawToken}`;

  await emailProvider.send({
    to: user.email,
    subject: "Reset your password",
    html: `<p>Click the link below to reset your password. This link expires in ${env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES} minutes.</p><p><a href="${resetLink}">${resetLink}</a></p>`,
  });
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

  await createNotification({
    recipients: [user.id],
    type: "ACCOUNT",
    title: "Password reset",
    message: "Your password was just reset. If this wasn't you, contact your administrator immediately.",
  });
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
