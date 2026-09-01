import { env } from "../config/env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type SiteverifyResponse = { success: boolean };

/** Verifies a Cloudflare Turnstile token server-side. Returns false (never throws) if the
 * secret key isn't configured or Cloudflare's endpoint is unreachable - callers treat that the
 * same as a failed challenge, since CAPTCHA can only be enabled per-org once the key is set
 * (see settings.service.ts#updateSettings), so an unset key here would indicate a genuine
 * misconfiguration, not a legitimate "not required" case. */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return false;

  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
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
