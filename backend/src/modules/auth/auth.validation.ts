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
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  orgSlug: z.string().min(1).optional(),
  captchaToken: z.string().optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  captchaToken: z.string().optional(),
});

export const resetPasswordParamsSchema = z.object({
  token: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});
