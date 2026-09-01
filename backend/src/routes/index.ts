import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { requireModuleEnabled } from "../middleware/authorize";
import { usersRouter } from "../modules/users/users.routes";
import { auditRouter, loginHistoryRouter } from "../modules/audit/audit.routes";
import { departmentsRouter } from "../modules/departments/departments.routes";
import { designationsRouter } from "../modules/designations/designations.routes";
import { customFieldDefinitionsRouter } from "../modules/customFieldDefinitions/customFieldDefinitions.routes";
import { rolesRouter } from "../modules/roles/roles.routes";
import { knowledgeBaseRouter } from "../modules/knowledgeBase/knowledgeBase.routes";
import { locationsRouter } from "../modules/locations/locations.routes";
import { vendorsRouter } from "../modules/vendors/vendors.routes";
import { assetCategoriesRouter } from "../modules/assetCategories/assetCategories.routes";
import { licenseCategoriesRouter } from "../modules/licenseCategories/licenseCategories.routes";
import { settingsRouter } from "../modules/settings/settings.routes";
import { assetsRouter } from "../modules/assets/assets.routes";
import { licensesRouter } from "../modules/licenses/licenses.routes";
import { reportsRouter } from "../modules/reports/reports.routes";
import { helpdeskRouter } from "../modules/helpdesk/helpdesk.routes";
import { helpdeskCategoriesRouter } from "../modules/helpdeskCategories/helpdeskCategories.routes";
import { helpdeskPrioritiesRouter } from "../modules/helpdeskPriorities/helpdeskPriorities.routes";
import { tasksRouter } from "../modules/tasks/tasks.routes";
import { searchRouter } from "../modules/search/search.routes";
import { analyticsRouter } from "../modules/analytics/analytics.routes";
import { notificationsRouter } from "../modules/notifications/notifications.routes";
import { aiAssistantRouter } from "../modules/ai-assistant/ai-assistant.routes";

/** Mounted under /api/:orgSlug - authenticate + resolveOrganization already ran by the time
 * any of these routers see the request (see app.ts), so none of them need their own
 * `.use(authenticate)` any more. */
export const orgScopedRouter = Router();

// By the time this runs, resolveOrganization has already done the real ownership/active-status/
// grant check and already overwritten req.user.permissions for a subSuperAdmin to reflect THIS
// org - this just exposes that already-computed state, so the frontend can show a subSuperAdmin
// their effective access for whichever org they're currently viewing. Every role can call it;
// for superAdmin/orgAdmin/teamMember it's just their existing fixed permissions.
orgScopedRouter.get(
  "/my-access",
  asyncHandler(async (req, res) => {
    ok(res, { organization: req.organization, permissions: req.user!.permissions }, "My access");
  })
);

orgScopedRouter.use("/users", usersRouter);
orgScopedRouter.use("/audit-logs", requireModuleEnabled("auditLogs"), auditRouter);
// Login History shares the same "track logins" accountability surface as Audit Logs (both are
// reached via the exact same `{ area: "auditLogs", action: "view" }` permission in nav-config.ts),
// so it's gated by the same entitlement rather than inventing a separate one.
orgScopedRouter.use("/login-history", requireModuleEnabled("auditLogs"), loginHistoryRouter);
orgScopedRouter.use("/departments", requireModuleEnabled("departments"), departmentsRouter);
// Not requireModuleEnabled-gated - see permissions.ts's ENTITLEMENT_MODULES comment for why
// designations is treated as always-on core admin surface, same as users/settings (auditLogs
// used to be part of this always-on group too, but is now its own gated entitlement above).
orgScopedRouter.use("/designations", designationsRouter);
orgScopedRouter.use(
  "/custom-field-definitions",
  requireModuleEnabled("customFields"),
  customFieldDefinitionsRouter
);
// Not requireModuleEnabled-gated either - same always-on admin config surface reasoning (see
// permissions.ts's ENTITLEMENT_MODULES comment).
orgScopedRouter.use("/roles", rolesRouter);
// Not requireModuleEnabled-gated either - same always-on admin config surface reasoning (see
// permissions.ts's ENTITLEMENT_MODULES comment) - knowledgeBase.view is also granted to every
// user by default there, which only makes sense if the module itself is always reachable.
orgScopedRouter.use("/knowledge-base", knowledgeBaseRouter);
orgScopedRouter.use("/locations", requireModuleEnabled("locations"), locationsRouter);
orgScopedRouter.use("/vendors", requireModuleEnabled("vendors"), vendorsRouter);
orgScopedRouter.use("/asset-categories", requireModuleEnabled("assets"), assetCategoriesRouter);
orgScopedRouter.use("/license-categories", requireModuleEnabled("licenses"), licenseCategoriesRouter);
orgScopedRouter.use("/settings", settingsRouter);
orgScopedRouter.use("/assets", requireModuleEnabled("assets"), assetsRouter);
orgScopedRouter.use("/licenses", requireModuleEnabled("licenses"), licensesRouter);
orgScopedRouter.use("/reports", requireModuleEnabled("reports"), reportsRouter);
orgScopedRouter.use("/analytics", requireModuleEnabled("reports"), analyticsRouter);
orgScopedRouter.use("/helpdesk", requireModuleEnabled("helpdesk"), helpdeskRouter);
orgScopedRouter.use("/helpdesk-categories", requireModuleEnabled("helpdesk"), helpdeskCategoriesRouter);
orgScopedRouter.use("/helpdesk-priorities", requireModuleEnabled("helpdesk"), helpdeskPrioritiesRouter);
orgScopedRouter.use("/tasks", requireModuleEnabled("tasks"), tasksRouter);
orgScopedRouter.use("/search", searchRouter);
orgScopedRouter.use("/notifications", notificationsRouter);
// Not requireModuleEnabled-gated - per this feature's explicit requirement, aiAssistant.view is
// granted to every user by default (see permissions.ts) and must never be Super-Admin-toggleable
// per org; the authorize("aiAssistant", "view") check on the routes themselves is the real gate.
orgScopedRouter.use("/ai-assistant", aiAssistantRouter);
