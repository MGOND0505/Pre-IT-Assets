import { Router } from "express";
import { authorize } from "../../middleware/authorize";
import * as analyticsController from "./analytics.controller";

export const analyticsRouter = Router();

// Same permission the existing native Reports feature already uses - this embed is another
// reports/analytics surface, not a new permission concept.
analyticsRouter.get("/embed-url", authorize("reports", "view"), analyticsController.getEmbedUrl);
