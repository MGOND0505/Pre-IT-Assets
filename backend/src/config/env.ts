import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5001),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be set to a long random value (at least 32 characters)"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  JWT_COOKIE_NAME: z.string().default("itam_token"),
  // z.coerce.boolean() is the wrong tool here: it just runs JS's Boolean(value), and
  // Boolean("false") is true (any non-empty string is truthy) - so a literal "false" in .env
  // was silently being read as true. Parse the actual string instead.
  COOKIE_SECURE: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v.trim().toLowerCase() === "true"),

  FRONTEND_URL: z.string().url(),

  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: z.coerce.number().int().positive().default(30),

  LOGIN_LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(5),
  LOGIN_LOCKOUT_DURATION_MINUTES: z.coerce.number().int().positive().default(15),

  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).default("info"),

  MAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),

  SUPERADMIN_SEED_NAME: z.string().optional(),
  SUPERADMIN_SEED_EMAIL: z.string().email().optional(),
  SUPERADMIN_SEED_PASSWORD: z.string().min(8).optional(),

  // Optional: only set once the Metabase analytics embed is provisioned (see
  // metabase/README.md). Absent in dev environments that haven't set it up - the analytics
  // endpoint below returns a clear 501 rather than crashing at boot when these are missing.
  METABASE_URL: z.string().url().optional(),
  METABASE_EMBEDDING_SECRET_KEY: z.string().min(16).optional(),
  METABASE_DASHBOARD_ID: z.coerce.number().int().positive().optional(),

  // CAPTCHA (Cloudflare Turnstile) - one global site/secret key pair for the whole deployment
  // (every org shares one domain via path-based routing, and Turnstile registers keys per-domain,
  // not per-tenant); each org's own SystemSettings.captchaEnabled toggle just decides whether
  // that org's users must solve it. Both optional - CAPTCHA simply can't be enabled if unset.
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // The AI Assistant's local inference engine - defaults to the same address a locally-run
  // Ollama binary listens on outside Docker (local dev); docker-compose.yml overrides this to
  // the ollama service's internal-network address (http://ollama:11434) in every deployed
  // environment - never reachable from outside that compose network.
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  // The model name Ollama is asked for on every chat request - must already be pulled into the
  // Ollama container/binary (`ollama pull <model>`) before the AI Assistant will actually get
  // responses; this app never auto-pulls a model itself, that's an operational/deploy-time step.
  OLLAMA_MODEL: z.string().default("llama3.1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
