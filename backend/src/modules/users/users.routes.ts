import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { PERM } from "../../config/permissionCatalog";
import * as usersController from "./users.controller";
import { listLoginHistoryForUser } from "./loginHistory.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { User } from "../../models/User";
import {
  adminResetPasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  updateUserRolesSchema,
  updateUserSchema,
  userIdParamsSchema,
} from "./users.validation";

export const usersRouter = Router();

usersRouter.use(authenticate);

/**
 * @openapi
 * /users:
 *   get:
 *     summary: List users (paginated, filterable by role/status/search)
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Paginated list of users }
 *   post:
 *     summary: Create a user
 *     tags: [Users]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, roleIds, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               roleIds: { type: array, items: { type: string } }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       201: { description: User created }
 *       409: { description: Email already in use }
 */
usersRouter.get("/", authorize(PERM.USERS_READ), validate({ query: listUsersQuerySchema }), usersController.listUsers);
usersRouter.post(
  "/",
  authorize(PERM.USERS_CREATE),
  validate({ body: createUserSchema }),
  usersController.createUser
);
// Minimal people-picker for assign/transfer flows - deliberately not gated by
// users:read (any authenticated user may need to pick an assignee), and only
// ever exposes name/email, never anything sensitive.
usersRouter.get(
  "/lookup",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const filter: Record<string, unknown> = { status: "Active" };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    const users = await User.find(filter).select("name email").limit(50).sort({ name: 1 });
    ok(res, users, "Users");
  })
);

usersRouter.get(
  "/:id",
  authorize(PERM.USERS_READ),
  validate({ params: userIdParamsSchema }),
  usersController.getUser
);
usersRouter.put(
  "/:id",
  authorize(PERM.USERS_WRITE),
  validate({ params: userIdParamsSchema, body: updateUserSchema }),
  usersController.updateUser
);
usersRouter.put(
  "/:id/roles",
  authorize(PERM.USERS_WRITE, PERM.USERS_MANAGE_USERS),
  validate({ params: userIdParamsSchema, body: updateUserRolesSchema }),
  usersController.updateUserRoles
);
usersRouter.patch(
  "/:id/activate",
  authorize(PERM.USERS_WRITE),
  validate({ params: userIdParamsSchema }),
  usersController.activateUser
);
usersRouter.patch(
  "/:id/deactivate",
  authorize(PERM.USERS_WRITE),
  validate({ params: userIdParamsSchema }),
  usersController.deactivateUser
);
usersRouter.patch(
  "/:id/reset-password",
  authorize(PERM.USERS_WRITE),
  validate({ params: userIdParamsSchema, body: adminResetPasswordSchema }),
  usersController.adminResetPassword
);
usersRouter.delete(
  "/:id",
  authorize(PERM.USERS_DELETE),
  validate({ params: userIdParamsSchema }),
  usersController.deleteUser
);
usersRouter.get(
  "/:id/login-history",
  authorize(PERM.AUDIT_READ),
  validate({ params: userIdParamsSchema }),
  asyncHandler(async (req, res) => {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await listLoginHistoryForUser(req.params.id, page, limit);
    ok(res, result, "Login history");
  })
);
