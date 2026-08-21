import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { fail } from "../utils/response";

export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
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
