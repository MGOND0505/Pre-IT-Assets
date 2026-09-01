import { Router } from "express";
import { validate } from "../../middleware/validate";
import * as globalUsersController from "./globalUsers.controller";
import { listGlobalUsersQuerySchema } from "./users.validation";

/** Mounted flat at /api/users, behind authenticate + requireSuperAdmin (see app.ts) - the Super
 * Admin panel's read-only, cross-organization user directory (Phase 8). Mirrors
 * organizations.routes.ts's flat-router pattern (no per-route authorize() calls needed, the whole
 * router is already requireSuperAdmin-gated at the app.ts mount point). Deliberately thin: this is
 * a search/list/link layer only - every mutating user action (edit permissions, activate/
 * deactivate, reset password, delete, ...) still lives at the org-scoped /{orgSlug}/users
 * (users.routes.ts), untouched by this module. */
export const globalUsersRouter = Router();

globalUsersRouter.get("/", validate({ query: listGlobalUsersQuerySchema }), globalUsersController.listGlobalUsers);
