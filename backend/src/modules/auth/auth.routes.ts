import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { authLimiter } from "../../middleware/rateLimit";
import * as authController from "./auth.controller";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordParamsSchema,
  resetPasswordSchema,
} from "./auth.validation";

export const authRouter = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200: { description: Logged in, sets an httpOnly session cookie }
 *       401: { description: Invalid credentials or inactive account }
 *       429: { description: Too many attempts }
 */
authRouter.post("/login", authLimiter, validate({ body: loginSchema }), authController.login);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Log out and clear the session cookie
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Logged out }
 */
authRouter.post("/logout", authenticate, authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Current user }
 *       401: { description: Not authenticated }
 */
authRouter.get("/me", authenticate, authController.me);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset link
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Generic success message regardless of whether the email exists }
 */
authRouter.post(
  "/forgot-password",
  authLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);

/**
 * @openapi
 * /auth/reset-password/{token}:
 *   post:
 *     summary: Reset password using a token from the forgot-password email
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password reset }
 *       400: { description: Token invalid or expired }
 */
authRouter.post(
  "/reset-password/:token",
  authLimiter,
  validate({ params: resetPasswordParamsSchema, body: resetPasswordSchema }),
  authController.resetPassword
);

/**
 * @openapi
 * /auth/change-password:
 *   patch:
 *     summary: Change the current user's own password
 *     tags: [Auth]
 *     security: [{ cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password changed, all sessions invalidated }
 *       400: { description: Current password incorrect }
 */
authRouter.patch(
  "/change-password",
  authLimiter,
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);
