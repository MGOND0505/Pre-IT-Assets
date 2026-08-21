import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { fail } from "../utils/response";
import { logger } from "../utils/logger";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return fail(res, err.message, err.statusCode, err.details);
  }

  logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
  return fail(res, "Internal server error", 500);
}
