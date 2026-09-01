// Client-side mirror of backend/src/utils/passwordPolicy.ts - kept manually in sync, same
// convention already established for lib/permissions.ts.

export type PasswordPolicy = {
  minLength: number
  requireUppercase: boolean
  requireNumber: boolean
  requireSpecialChar: boolean
  historyLimit: number
}

/** Fixed fallback for contexts with no org yet (org creation) or that span orgs
 * (sub-super-admin creation) - matches the backend's BASELINE_POLICY. */
export const BASELINE_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  historyLimit: 2,
}

const SPECIAL_CHAR_REGEX = /[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/

export type PasswordRequirement = { key: string; label: string; met: boolean }

/** Returns one row per active rule, each already evaluated against `password` - drives the
 * live checklist UI (password-requirements-hint.tsx). */
export function checkPasswordRequirements(password: string, policy: PasswordPolicy): PasswordRequirement[] {
  const requirements: PasswordRequirement[] = [
    { key: "length", label: `At least ${policy.minLength} characters`, met: password.length >= policy.minLength },
  ]
  if (policy.requireUppercase) {
    requirements.push({ key: "uppercase", label: "One uppercase letter", met: /[A-Z]/.test(password) })
  }
  if (policy.requireNumber) {
    requirements.push({ key: "number", label: "One number", met: /[0-9]/.test(password) })
  }
  if (policy.requireSpecialChar) {
    requirements.push({ key: "special", label: "One special character", met: SPECIAL_CHAR_REGEX.test(password) })
  }
  return requirements
}

export function isPasswordValid(password: string, policy: PasswordPolicy): boolean {
  return checkPasswordRequirements(password, policy).every((r) => r.met)
}
