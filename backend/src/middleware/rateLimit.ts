import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { fail } from "../utils/response";

export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // This exists to throttle brute-force guessing, not to cap how often someone can
  // successfully log in - without this, a handful of legitimate logins (or, in a shared-IP
  // dev environment, someone else's) eats the same budget as failed password guesses and
  // locks everyone out for real use.
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    fail(res, "Too many attempts, please try again later", 429);
  },
});

export const apiLimiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  limit: env.API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    fail(res, "Too many requests, please slow down", 429);
  },
});
