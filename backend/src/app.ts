import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { orgScopedRouter } from "./routes/index";
import { authRouter } from "./modules/auth/auth.routes";
import { publicCaptchaRouter } from "./modules/auth/publicCaptcha.routes";
import { healthRouter } from "./modules/health/health.routes";
import { organizationsRouter } from "./modules/organizations/organizations.routes";
import { subSuperAdminsRouter, myOrganizationsRouter } from "./modules/subSuperAdmins/subSuperAdmins.routes";
import { globalUsersRouter } from "./modules/users/globalUsers.routes";
import { platformSettingsRouter } from "./modules/platformSettings/platformSettings.routes";
import { systemStatusRouter } from "./modules/systemStatus/systemStatus.routes";
import { globalAuditRouter } from "./modules/globalAudit/globalAudit.routes";
import { accessRequestsRouter } from "./modules/accessRequests/accessRequests.routes";
import { publicSettingsRouter } from "./modules/settings/settings.public.routes";
import { authenticate } from "./middleware/authenticate";
import { requireSuperAdmin } from "./middleware/authorize";
import { resolveOrganization, resolvePublicOrganization } from "./middleware/resolveOrganization";
import { apiLimiter } from "./middleware/rateLimit";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

// This app always sits behind exactly one reverse proxy (nginx in production, per
// docker-compose.yml) - without this, Express falls back to the immediate socket peer for
// req.ip, which behind a proxy is the proxy's own address for EVERY request. express-rate-limit
// (and anything else keyed on req.ip - LoginHistory, audit logs) then can't tell users apart at
// all: every visitor shares one single rate-limit bucket, and legitimate traffic gets 429'd once
// the SHARED quota (not each user's own) is exhausted. Trusting exactly 1 hop makes Express read
// the real client IP from X-Forwarded-For's first entry, which nginx sets correctly.
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
// The default 100kb limit is too small for the bulk import confirm step, which resends
// the full previewed row set (mirrors the 10MB upload limit in utils/upload.ts).
app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());
app.use(mongoSanitize());

if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Org-agnostic mounts - identify a user (auth) or need no org context at all (health).
app.use("/api/health", healthRouter);
app.use("/api/auth", apiLimiter, authRouter);
app.use("/api/public", apiLimiter, publicCaptchaRouter);

// The Super Admin panel itself - system-level, spans all organizations, so it must be
// registered here (flat, above the /api/:orgSlug catch-all below) rather than under
// routes/index.ts's orgScopedRouter, or the catch-all would swallow "organizations" as if it
// were an org slug and this would 404 instead of ever running.
app.use("/api/organizations", apiLimiter, authenticate, requireSuperAdmin, organizationsRouter);
app.use("/api/sub-super-admins", apiLimiter, authenticate, requireSuperAdmin, subSuperAdminsRouter);
// Read-only, cross-organization user directory (Phase 8) - same flat-mount reasoning as
// /api/organizations above; must sit above the /api/:orgSlug catch-all or "users" would be
// swallowed as an org slug instead of ever reaching this router.
app.use("/api/users", apiLimiter, authenticate, requireSuperAdmin, globalUsersRouter);
// Phase 9's "Global / Security Settings" - a true global singleton, same flat-mount reasoning as
// /api/organizations and /api/users above.
app.use("/api/platform-settings", apiLimiter, authenticate, requireSuperAdmin, platformSettingsRouter);
// Phase 10's "System Monitoring" - scheduler last-run status, rate-limit reject counts, and login
// activity, same flat-mount reasoning as /api/organizations, /api/users, and /api/platform-settings
// above.
app.use("/api/system-status", apiLimiter, authenticate, requireSuperAdmin, systemStatusRouter);
// Flat, cross-organization activity/login-history viewer - same flat-mount reasoning as
// /api/organizations, /api/users, /api/platform-settings, and /api/system-status above.
app.use("/api/audit-logs", apiLimiter, authenticate, requireSuperAdmin, globalAuditRouter);
// Deliberately NOT requireSuperAdmin-gated - a Sub-Super Admin's own landing page needs this
// to see just the organizations THEY were granted (see subSuperAdmins.routes.ts's comment).
app.use("/api/my-organizations", apiLimiter, authenticate, myOrganizationsRouter);
app.use("/api/access-requests", apiLimiter, authenticate, accessRequestsRouter);

// Public, pre-login, per-org endpoints (branding/logo for a login page to render itself) -
// resolves the org from the slug alone, no authenticated user involved.
app.use("/api/:orgSlug/public", apiLimiter, resolvePublicOrganization, publicSettingsRouter);

// Everything else: authenticate the user, then confirm they may access :orgSlug.
app.use("/api/:orgSlug", apiLimiter, authenticate, resolveOrganization, orgScopedRouter);

app.use(notFound);
app.use(errorHandler);
