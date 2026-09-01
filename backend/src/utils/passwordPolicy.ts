import bcrypt from "bcryptjs";
import { ApiError } from "./ApiError";

export type PasswordPolicy = {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  historyLimit: number;
};

/** Fixed fallback used where no single organization's configurable policy applies - a
 * brand-new org (no SystemSettings row yet), a sub-super-admin (spans multiple orgs), or the
 * standalone seed/reset CLI scripts. Matches the original fixed requirements this feature
 * started from. */
export const BASELINE_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  historyLimit: 2,
};

const SPECIAL_CHAR_REGEX = /[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/;

export function validatePasswordAgainstPolicy(password: string, policy: PasswordPolicy): string[] {
  const violations: string[] = [];
  if (password.length < policy.minLength) {
    violations.push(`Password must be at least ${policy.minLength} characters.`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    violations.push("Password must include at least one uppercase letter.");
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    violations.push("Password must include at least one number.");
  }
  if (policy.requireSpecialChar && !SPECIAL_CHAR_REGEX.test(password)) {
    violations.push("Password must include at least one special character.");
  }
  return violations;
}

/** Throws if `candidate` matches the user's current password or any of their stored history
 * hashes. No-ops when `historyLimit` is 0 (reuse-check disabled). */
export async function assertPasswordNotReused(
  candidate: string,
  user: { passwordHash: string; passwordHistory: string[] },
  historyLimit: number
): Promise<void> {
  if (historyLimit === 0) return;

  if (await bcrypt.compare(candidate, user.passwordHash)) {
    throw new ApiError(400, `You cannot reuse one of your last ${historyLimit} passwords.`);
  }
  for (const oldHash of user.passwordHistory.slice(0, historyLimit)) {
    if (await bcrypt.compare(candidate, oldHash)) {
      throw new ApiError(400, `You cannot reuse one of your last ${historyLimit} passwords.`);
    }
  }
}

/** Call after successfully saving a new passwordHash - pass the hash being REPLACED. */
export function pushPasswordHistory(user: { passwordHistory: string[] }, replacedHash: string, historyLimit: number): void {
  user.passwordHistory = [replacedHash, ...user.passwordHistory].slice(0, historyLimit);
}
