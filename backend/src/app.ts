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
import { healthRouter } from "./modules/health/health.routes";
import { organizationsRouter } from "./modules/organizations/organizations.routes";
import { subSuperAdminsRouter, myOrganizationsRouter } from "./modules/subSuperAdmins/subSuperAdmins.routes";
import { accessRequestsRouter } from "./modules/accessRequests/accessRequests.routes";
import { publicSettingsRouter } from "./modules/settings/settings.public.routes";
import { authenticate } from "./middleware/authenticate";
import { requireSuperAdmin } from "./middleware/authorize";
import { resolveOrganization, resolvePublicOrganization } from "./middleware/resolveOrganization";
import { apiLimiter } from "./middleware/rateLimit";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

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

// The Super Admin panel itself - system-level, spans all organizations, so it must be
// registered here (flat, above the /api/:orgSlug catch-all below) rather than under
// routes/index.ts's orgScopedRouter, or the catch-all would swallow "organizations" as if it
// were an org slug and this would 404 instead of ever running.
app.use("/api/organizations", apiLimiter, authenticate, requireSuperAdmin, organizationsRouter);
app.use("/api/sub-super-admins", apiLimiter, authenticate, requireSuperAdmin, subSuperAdminsRouter);
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
