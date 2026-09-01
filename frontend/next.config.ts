import type { NextConfig } from "next";

// Derive the API origin (scheme+host+port) from the same env var api-client.ts reads, so the CSP's
// connect-src always matches whatever backend this build actually talks to - falls back to the
// same localhost default api-client.ts itself uses for local dev. A same-origin value (e.g. "/api",
// this repo's own docker-compose default for an nginx-proxied deploy - see api-client.ts, which
// already treats a relative baseURL as valid) has no separate origin to add: connect-src's own
// 'self' below already covers it, so this yields null instead of letting `new URL()` throw on it.
function apiOriginOf(value: string | undefined): string | null {
  try {
    return new URL(value || "http://localhost:5001/api").origin;
  } catch {
    return null;
  }
}
const apiOrigin = apiOriginOf(process.env.NEXT_PUBLIC_API_BASE_URL);

// Cloudflare Turnstile (components/auth/turnstile-widget.tsx) loads its own script and renders
// its challenge in an iframe, both from this origin - the only third-party host this app talks to.
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

// Next.js App Router ships its own hydration/streaming payloads as inline <script> tags (no nonce
// wired up in this app), so script-src needs 'unsafe-inline' or every page fails to hydrate -
// confirmed the hard way: without it, pages render statically but nothing client-side ever runs
// (no CAPTCHA, no button handlers, nothing). Dev builds additionally need 'unsafe-eval' for
// webpack/Turbopack's HMR runtime; a production build doesn't eval, so it's left out there.
const isProd = process.env.NODE_ENV === "production";

const CSP = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"} ${TURNSTILE_ORIGIN}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data:`,
  `font-src 'self' data:`,
  `connect-src ${["'self'", apiOrigin, TURNSTILE_ORIGIN].filter(Boolean).join(" ")}`,
  `frame-src ${TURNSTILE_ORIGIN}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `frame-ancestors 'none'`,
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
