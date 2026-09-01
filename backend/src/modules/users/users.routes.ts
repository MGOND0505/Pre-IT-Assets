import { Router } from "express";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as usersController from "./users.controller";
import { previewUserImport, confirmUserImport, downloadUserTemplate } from "./users.import";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { User } from "../../models/User";
import {
  adminResetPasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  setLeaveStatusSchema,
  updateUserPermissionsSchema,
  updateUserSchema,
  userIdParamsSchema,
} from "./users.validation";

export const usersRouter = Router();

// Minimal people-picker for the assignee field on assets/licenses - deliberately
// not Admin-gated (any authenticated user may need to pick an assignee), and only
// ever exposes name/email/employeeId, never anything sensitive. Org-scoped like
// everything else - otherwise any user could pick another organization's user as an
// assignee just by guessing/brute-forcing an id.
usersRouter.get(
  "/lookup",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const filter: Record<string, unknown> = { status: "Active", isDeleted: false, organization: req.organization!._id };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
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

// Bulk import is creation-at-scale, so it gets the exact same Admin-only treatment as the single
// POST / above, rather than a new `users:import` permission action - a granular import permission
// would reopen the same privilege-escalation door that comment explains, just via a spreadsheet
// instead of a single request body. Mounted ahead of the generic "/:id" routes below, same
// ordering assets.routes.ts uses for its own "/import/*" routes, so Express never mistakes
// "import" for an :id value.
usersRouter.post("/import/preview", requireAdmin, uploadSpreadsheet.single("file"), previewUserImport);
usersRouter.post("/import/confirm", requireAdmin, confirmUserImport);
usersRouter.get("/import/template", requireAdmin, downloadUserTemplate);

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
