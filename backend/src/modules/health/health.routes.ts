import { Router } from "express";
import { isDbConnected } from "../../config/db";
import { ok } from "../../utils/response";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const dbConnected = isDbConnected();
  ok(
    res,
    {
      status: dbConnected ? "ok" : "degraded",
      db: dbConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    },
    "Health check"
  );
});
