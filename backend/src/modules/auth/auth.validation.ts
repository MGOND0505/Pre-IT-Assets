import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // Absent = superAdmin's own flat-login flow (looked up among null-organization accounts
  // only). Present = which organization's login page this attempt came from.
  orgSlug: z.string().min(1).optional(),
  // Required only when the target org has captchaEnabled - enforced in auth.service.ts, not
  // here, since that's a runtime per-org setting a static schema can't express.
  captchaToken: z.string().optional(),
  // Absent = the regular org login page. "employee" = the org's dedicated Employee Portal login
  // page (/{orgSlug}/employee-login) - enforced in auth.service.ts#login, which rejects any
  // account that isn't Employee-tier even with a correct password.
  portal: z.literal("employee").optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  orgSlug: z.string().min(1).optional(),
  captchaToken: z.string().optional(),
});

// token lives in the body, not a URL path/:param - a token in the URL ends up in the server's
// own HTTP access log (Morgan's "combined" format logs the full request line) for the whole
// PASSWORD_RESET_TOKEN_EXPIRY_MINUTES validity window, letting anyone with log read access
// replay a still-valid reset token. The email link itself still embeds the token in its URL
// (unavoidable for a clickable link), but the actual API call that spends it no longer does.
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  captchaToken: z.string().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});
