import type { Response } from "express";

export function ok<T>(res: Response, data: T, message = "OK", status = 200) {
  return res.status(status).json({ success: true, message, data, error: null });
}

export function fail(res: Response, message: string, status = 400, error: unknown = null) {
  return res.status(status).json({ success: false, message, data: null, error });
}
