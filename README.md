IT Asset & License Management System — Architecture Overview
Type: Multi-tenant (multi-organization) IT asset/license/helpdesk management platform, path-scoped by org (/api/:orgSlug/...).

Frontend
Next.js 16 (App Router, React 19, TypeScript), served on port 3001
Base UI (@base-ui/react) primitives + Tailwind v4 for styling, shadcn conventions
@tanstack/react-table (data tables), recharts (dashboard charts), react-hook-form + zod (forms/validation), axios (API client), sonner (toasts), next-themes (dark mode)
Routes are org-scoped via a [org] dynamic segment; RBAC-gated nav (lib/permissions.ts) mirrors the backend's permission shape
Backend
Express + TypeScript, served on port 5001, entry backend/src/app.ts → server.ts
Mongoose ODM over MongoDB
Middleware chain: helmet → cors (credentialed, locked to FRONTEND_URL) → JSON body parsing → cookie-parser → express-mongo-sanitize → morgan logging → Swagger UI (swagger-jsdoc/swagger-ui-express at /api/docs)
Auth: JWT in an HttpOnly cookie (itam_token), bcryptjs password hashing, login lockout via express-rate-limit
Routing split: org-agnostic routes mounted flat (/api/auth, /api/health, /api/organizations, /api/sub-super-admins), everything else behind authenticate → resolveOrganization → a catch-all /api/:orgSlug → orgScopedRouter, which fans out per module
Modules (feature-per-folder, each with .routes/.controller/.service/.validation): assets, licenses, departments, locations, vendors, asset/license/helpdesk categories, helpdesk (tickets), tasks, access requests, sub-super-admins, organizations, users, audit, analytics, reports, search, settings, health
Cross-cutting: authorize(module, action) RBAC middleware (roles: superAdmin/subSuperAdmin/orgAdmin/teamMember), logAction() audit trail, AssetHistory per-asset timeline, node-cron scheduled jobs, nodemailer (console provider locally), pdfkit/xlsx for exports/bulk import, winston logging
Database
MongoDB (Mongoose models: Asset, License, Ticket, Task, Department, Location, Vendor, Organization, User, AuditLog, AssetHistory, LoginHistory, etc.)
Soft-delete convention (isDeleted/deletedAt/deletedBy) instead of hard deletes
Local dev: MongoDB on 27017; in Docker Compose it's a mongo:7 container on 27018:27017 with a named volume
Analytics
Metabase (separate app under /metabase, provisioned via provision.mjs/setup_admin.mjs/setup_embedding.mjs) embedded into the dashboard via a signed-URL/embedding-secret pattern (METABASE_URL, METABASE_EMBEDDING_SECRET_KEY, METABASE_DASHBOARD_ID in backend/.env) — a self-hosted BI tool, not a custom charting backend
Docker / Deployment
docker-compose.yml defines three services: mongo (7), backend (built from ./backend), frontend (built from ./frontend), wired by env vars (MONGODB_URI pointing at the mongo service hostname, NEXT_PUBLIC_API_BASE_URL pointing at the backend)
Two GitHub remotes: origin (Pre-IT-Assets, dev) and live (Live-IT-Assets, production — deployed via git pull + docker compose up -d --build on the VPS at workspace.avyntor.com)
How components communicate

Browser
  │  HTTPS (cookie: itam_token)
  ▼
Next.js frontend (3001) ──axios──▶ Express backend (5001)
                                       │
                                       ├─▶ MongoDB (27017/27018) — Mongoose
                                       └─▶ Metabase (3000) — signed embed URLs for dashboards
All frontend↔backend traffic goes through /api/..., authenticated by the JWT cookie and scoped per-request to an organization by :orgSlug; Metabase is backend-mediated, not called directly from the browser.
