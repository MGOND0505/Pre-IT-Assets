import { z } from "zod";

// Every numeric field: null explicitly reverts to the env.* default (see the model's own
// comment on why null, not the env default value itself, is the "unset" sentinel); omitted
// leaves the stored value untouched (Object.assign in the service only overwrites keys actually
// present in the body).
const nullableInt = z.coerce.number().int().positive().nullable().optional();

export const updatePlatformSettingsSchema = z.object({
  authRateLimitWindowMs: nullableInt,
  authRateLimitMax: nullableInt,
  apiRateLimitWindowMs: nullableInt,
  apiRateLimitMax: nullableInt,
  loginLockoutThreshold: nullableInt,
  loginLockoutDurationMinutes: nullableInt,
  turnstileSiteKey: z.string().optional(),
  turnstileSecretKey: z.string().optional(),
});
