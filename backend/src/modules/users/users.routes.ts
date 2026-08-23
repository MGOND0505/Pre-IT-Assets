import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as usersController from "./users.controller";
import { listLoginHistoryForUser } from "./loginHistory.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { User } from "../../models/User";
import {
  adminResetPasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  updateUserPermissionsSchema,
  updateUserSchema,
  userIdParamsSchema,
} from "./users.validation";

export const usersRouter = Router();

usersRouter.use(authenticate);

// Minimal people-picker for the assignee field on assets/licenses - deliberately
// not Admin-gated (any authenticated user may need to pick an assignee), and only
// ever exposes name/email/employeeId, never anything sensitive.
usersRouter.get(
  "/lookup",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const filter: Record<string, unknown> = { status: "Active" };
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

// User management is Admin-only, per the simple permission model - not part of
// the per-area Assets/Licenses/Reports matrix.
usersRouter.use(requireAdmin);

usersRouter.get("/", validate({ query: listUsersQuerySchema }), usersController.listUsers);
usersRouter.post("/", validate({ body: createUserSchema }), usersController.createUser);

usersRouter.get("/:id", validate({ params: userIdParamsSchema }), usersController.getUser);
usersRouter.put(
  "/:id",
  validate({ params: userIdParamsSchema, body: updateUserSchema }),
  usersController.updateUser
);
usersRouter.put(
  "/:id/permissions",
  validate({ params: userIdParamsSchema, body: updateUserPermissionsSchema }),
  usersController.updateUserPermissions
);
usersRouter.patch(
  "/:id/activate",
  validate({ params: userIdParamsSchema }),
  usersController.activateUser
);
usersRouter.patch(
  "/:id/deactivate",
  validate({ params: userIdParamsSchema }),
  usersController.deactivateUser
);
usersRouter.patch(
  "/:id/reset-password",
  validate({ params: userIdParamsSchema, body: adminResetPasswordSchema }),
  usersController.adminResetPassword
);
usersRouter.delete("/:id", validate({ params: userIdParamsSchema }), usersController.deleteUser);
usersRouter.get(
  "/:id/login-history",
  validate({ params: userIdParamsSchema }),
  asyncHandler(async (req, res) => {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await listLoginHistoryForUser(req.params.id, page, limit);
    ok(res, result, "Login history");
  })
);
