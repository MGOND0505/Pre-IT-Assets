import type { NextConfig } from "next";

// Derive the API origin (scheme+host+port) from the same env var api-client.ts reads, so the CSP's
// connect-src always matches whatever backend this build actually talks to - falls back to the
// same localhost default api-client.ts itself uses for local dev.
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001/api").origin;

// Cloudflare Turnstile (components/auth/turnstile-widget.tsx) loads its own script and renders
// its challenge in an iframe, both from this origin - the only third-party host this app talks to.
const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

const CSP = [
  `default-src 'self'`,
  `script-src 'self' ${TURNSTILE_ORIGIN}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data:`,
  `font-src 'self' data:`,
  `connect-src 'self' ${apiOrigin} ${TURNSTILE_ORIGIN}`,
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
