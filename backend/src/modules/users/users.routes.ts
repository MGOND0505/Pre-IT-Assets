import { Router } from "express";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as usersController from "./users.controller";
import { previewUserImport, confirmUserImport, downloadUserTemplate, getUserImportHistory } from "./users.import";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { User } from "../../models/User";
import { escapeRegex } from "../../utils/regex";
import {
  adminResetPasswordSchema,
  bulkApplyDefaultPermissionsSchema,
  confirmUserImportSchema,
  createUserSchema,
  listUsersQuerySchema,
  lookupUsersQuerySchema,
  setLeaveStatusSchema,
  updateUserPermissionsSchema,
  updateUserSchema,
  userIdParamsSchema,
} from "./users.validation";
import { listImportHistoryQuerySchema } from "../importHistory/importHistory.validation";

export const usersRouter = Router();

// Minimal people-picker for the assignee field on assets/licenses - deliberately
// not Admin-gated (any authenticated user may need to pick an assignee), and only
// ever exposes name/email/employeeId, never anything sensitive. Org-scoped like
// everything else - otherwise any user could pick another organization's user as an
// assignee just by guessing/brute-forcing an id.
usersRouter.get(
  "/lookup",
  validate({ query: lookupUsersQuerySchema }),
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const filter: Record<string, unknown> = { status: "Active", isDeleted: false, organization: req.organization!._id };
    if (search) {
      const escaped = escapeRegex(search);
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { employeeId: { $regex: escaped, $options: "i" } },
      ];
    }
    const users = await User.find(filter).select("name email employeeId").limit(50).sort({ name: 1 });
    ok(res, users, "Users");
  })
);

usersRouter.get(
  "/",
  authorize("users", "view"),
  validate({ query: listUsersQuerySchema }),
  usersController.listUsers
);
// Stays Admin-only, not part of the granular matrix: createUserSchema accepts `isAdmin` and
// `permissions` directly, so a Team Member granted only users:create could otherwise mint a
// brand-new Admin account in one call - a privilege-escalation vector, not a scope decision.
usersRouter.post("/", requireAdmin, validate({ body: createUserSchema }), usersController.createUser);

// Unlike POST / above, bulk import never accepts role/permissions from the file - every imported
// row always lands on the org's default employee template (see users.service.ts#createUser), so
// the privilege-escalation risk that keeps manual creation Admin-only doesn't apply here. Gated by
// the granular "users:create" action instead, which authorize() already grants unconditionally to
// orgAdmin/superAdmin (isAdmin bypass) and, for a subSuperAdmin, to whatever their per-org grant
// says - the only way for Sub-Super Admin (named explicitly in the bulk-update request) to reach
// this, since requireAdmin structurally excludes them (isAdmin is never true for that role).
// Mounted ahead of the generic "/:id" routes below, same ordering assets.routes.ts uses for its
// own "/import/*" routes, so Express never mistakes "import" for an :id value.
usersRouter.post("/import/preview", authorize("users", "create"), uploadSpreadsheet.single("file"), previewUserImport);
usersRouter.post(
  "/import/confirm",
  authorize("users", "create"),
  validate({ body: confirmUserImportSchema }),
  confirmUserImport
);
usersRouter.get("/import/template", authorize("users", "create"), downloadUserTemplate);
usersRouter.get(
  "/import/history",
  authorize("users", "create"),
  validate({ query: listImportHistoryQuerySchema }),
  getUserImportHistory
);

// Same Admin-only treatment as the single-user permission editor (updateUserPermissions below) -
// this is the exact same capability, just applied to several accounts at once.
usersRouter.post(
  "/bulk-apply-default-permissions",
  requireAdmin,
  validate({ body: bulkApplyDefaultPermissionsSchema }),
  usersController.bulkApplyDefaultPermissions
);

usersRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listUsersQuerySchema }),
  usersController.listDeletedUsers
);

usersRouter.get(
  "/:id",
  authorize("users", "view"),
  validate({ params: userIdParamsSchema }),
  usersController.getUser
);
usersRouter.put(
  "/:id",
  authorize("users", "update"),
  validate({ params: userIdParamsSchema, body: updateUserSchema }),
  usersController.updateUser
);
// Everything below changes account privilege/state rather than basic profile fields, so it
// stays Admin-only regardless of what the granular `users` module grants - see the note above.
usersRouter.put(
  "/:id/permissions",
  requireAdmin,
  validate({ params: userIdParamsSchema, body: updateUserPermissionsSchema }),
  usersController.updateUserPermissions
);
usersRouter.patch(
  "/:id/activate",
  requireAdmin,
  validate({ params: userIdParamsSchema }),
  usersController.activateUser
);
usersRouter.patch(
  "/:id/deactivate",
  requireAdmin,
  validate({ params: userIdParamsSchema }),
  usersController.deactivateUser
);
usersRouter.patch(
  "/:id/leave",
  requireAdmin,
  validate({ params: userIdParamsSchema, body: setLeaveStatusSchema }),
  usersController.setLeaveStatus
);
usersRouter.patch(
  "/:id/reset-password",
  requireAdmin,
  validate({ params: userIdParamsSchema, body: adminResetPasswordSchema }),
  usersController.adminResetPassword
);
usersRouter.delete(
  "/:id",
  authorize("users", "delete"),
  validate({ params: userIdParamsSchema }),
  usersController.deleteUser
);
usersRouter.post(
  "/:id/restore",
  requireAdmin,
  validate({ params: userIdParamsSchema }),
  usersController.restoreUser
);
usersRouter.get(
  "/:id/login-history",
  requireAdmin,
  validate({ params: userIdParamsSchema }),
  usersController.getUserLoginHistory
);
