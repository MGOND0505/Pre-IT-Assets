import { Router } from "express";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as supportTeamsController from "./supportTeams.controller";
import {
  createSupportTeamSchema,
  listSupportTeamsQuerySchema,
  supportTeamIdParamsSchema,
  updateSupportTeamSchema,
} from "./supportTeams.validation";

export const supportTeamsRouter = Router();

supportTeamsRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listSupportTeamsQuerySchema }),
  supportTeamsController.listDeletedSupportTeams
);
supportTeamsRouter.get("/", validate({ query: listSupportTeamsQuerySchema }), supportTeamsController.listSupportTeams);
supportTeamsRouter.post(
  "/",
  requireAdmin,
  validate({ body: createSupportTeamSchema }),
  supportTeamsController.createSupportTeam
);
supportTeamsRouter.get(
  "/:id",
  validate({ params: supportTeamIdParamsSchema }),
  supportTeamsController.getSupportTeam
);
supportTeamsRouter.put(
  "/:id",
  requireAdmin,
  validate({ params: supportTeamIdParamsSchema, body: updateSupportTeamSchema }),
  supportTeamsController.updateSupportTeam
);
supportTeamsRouter.delete(
  "/:id",
  requireAdmin,
  validate({ params: supportTeamIdParamsSchema }),
  supportTeamsController.deleteSupportTeam
);
supportTeamsRouter.post(
  "/:id/restore",
  requireAdmin,
  validate({ params: supportTeamIdParamsSchema }),
  supportTeamsController.restoreSupportTeam
);
