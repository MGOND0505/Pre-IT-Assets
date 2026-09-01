import { Router } from "express";
import { authorize, requireAdmin, requireModuleEnabled } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as knowledgeBaseController from "./knowledgeBase.controller";
import {
  createKnowledgeBaseArticleSchema,
  knowledgeBaseArticleIdParamsSchema,
  listKnowledgeBaseArticlesQuerySchema,
  updateKnowledgeBaseArticleSchema,
} from "./knowledgeBase.validation";

export const knowledgeBaseRouter = Router();

knowledgeBaseRouter.get(
  "/deleted",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
  validate({ query: listKnowledgeBaseArticlesQuerySchema }),
  knowledgeBaseController.listDeletedKnowledgeBaseArticles
);
knowledgeBaseRouter.get(
  "/",
  authorize("knowledgeBase", "view"),
  validate({ query: listKnowledgeBaseArticlesQuerySchema }),
  knowledgeBaseController.listKnowledgeBaseArticles
);
knowledgeBaseRouter.post(
  "/",
  authorize("knowledgeBase", "create"),
  validate({ body: createKnowledgeBaseArticleSchema }),
  knowledgeBaseController.createKnowledgeBaseArticle
);
knowledgeBaseRouter.get(
  "/:id",
  authorize("knowledgeBase", "view"),
  validate({ params: knowledgeBaseArticleIdParamsSchema }),
  knowledgeBaseController.getKnowledgeBaseArticle
);
knowledgeBaseRouter.put(
  "/:id",
  authorize("knowledgeBase", "update"),
  validate({ params: knowledgeBaseArticleIdParamsSchema, body: updateKnowledgeBaseArticleSchema }),
  knowledgeBaseController.updateKnowledgeBaseArticle
);
knowledgeBaseRouter.delete(
  "/:id",
  authorize("knowledgeBase", "delete"),
  validate({ params: knowledgeBaseArticleIdParamsSchema }),
  knowledgeBaseController.deleteKnowledgeBaseArticle
);
knowledgeBaseRouter.post(
  "/:id/restore",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
  validate({ params: knowledgeBaseArticleIdParamsSchema }),
  knowledgeBaseController.restoreKnowledgeBaseArticle
);
