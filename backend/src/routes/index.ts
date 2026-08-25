import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { requireModuleEnabled } from "../middleware/authorize";
import { usersRouter } from "../modules/users/users.routes";
import { auditRouter, loginHistoryRouter } from "../modules/audit/audit.routes";
import { departmentsRouter } from "../modules/departments/departments.routes";
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
import { supportTeamsRouter } from "../modules/supportTeams/supportTeams.routes";
import { tasksRouter } from "../modules/tasks/tasks.routes";
import { searchRouter } from "../modules/search/search.routes";

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
orgScopedRouter.use("/audit-logs", auditRouter);
orgScopedRouter.use("/login-history", loginHistoryRouter);
orgScopedRouter.use("/departments", requireModuleEnabled("departments"), departmentsRouter);
orgScopedRouter.use("/locations", requireModuleEnabled("locations"), locationsRouter);
orgScopedRouter.use("/vendors", requireModuleEnabled("vendors"), vendorsRouter);
orgScopedRouter.use("/asset-categories", requireModuleEnabled("assets"), assetCategoriesRouter);
orgScopedRouter.use("/license-categories", requireModuleEnabled("licenses"), licenseCategoriesRouter);
orgScopedRouter.use("/settings", settingsRouter);
orgScopedRouter.use("/assets", requireModuleEnabled("assets"), assetsRouter);
orgScopedRouter.use("/licenses", requireModuleEnabled("licenses"), licensesRouter);
orgScopedRouter.use("/reports", requireModuleEnabled("reports"), reportsRouter);
orgScopedRouter.use("/helpdesk", requireModuleEnabled("helpdesk"), helpdeskRouter);
orgScopedRouter.use("/helpdesk-categories", requireModuleEnabled("helpdesk"), helpdeskCategoriesRouter);
orgScopedRouter.use("/helpdesk-priorities", requireModuleEnabled("helpdesk"), helpdeskPrioritiesRouter);
orgScopedRouter.use("/support-teams", requireModuleEnabled("helpdesk"), supportTeamsRouter);
orgScopedRouter.use("/tasks", requireModuleEnabled("tasks"), tasksRouter);
orgScopedRouter.use("/search", searchRouter);
