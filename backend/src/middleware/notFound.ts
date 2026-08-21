import type { Request, Response } from "express";
import { fail } from "../utils/response";

export function notFound(req: Request, res: Response) {
  fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
}
