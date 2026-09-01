import { getEffectiveTurnstileKeys } from "../modules/platformSettings/platformSettings.service";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyResponse = { success: boolean };

/** Verifies a Cloudflare Turnstile token server-side. Returns false (never throws) if the
 * secret key isn't configured or Cloudflare's endpoint is unreachable - callers treat that the
 * same as a failed challenge, since CAPTCHA can only be enabled per-org once the key is set
 * (see settings.service.ts#updateSettings), so an unset key here would indicate a genuine
 * misconfiguration, not a legitimate "not required" case. The key itself may come from a Super
 * Admin's Global/Security Settings override or from env.TURNSTILE_SECRET_KEY - see
 * platformSettings.service.ts#getEffectiveTurnstileKeys. */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const { secretKey } = await getEffectiveTurnstileKeys();
  if (!secretKey) return false;

  try {
    const body = new URLSearchParams({ secret: secretKey, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;

    const data = (await res.json()) as SiteverifyResponse;
    return data.success === true;
  } catch {
    return false;
  }
}
