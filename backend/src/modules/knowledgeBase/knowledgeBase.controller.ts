import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as knowledgeBaseService from "./knowledgeBase.service";

export const listKnowledgeBaseArticles = asyncHandler(async (req: Request, res: Response) => {
  const result = await knowledgeBaseService.listKnowledgeBaseArticles(req.query as never, req.organization!._id);
  ok(res, result, "Knowledge base articles");
});

export const getKnowledgeBaseArticle = asyncHandler(async (req: Request, res: Response) => {
  const article = await knowledgeBaseService.getKnowledgeBaseArticleById(req.params.id, req.organization!._id);
  ok(res, article, "Knowledge base article");
});

export const createKnowledgeBaseArticle = asyncHandler(async (req: Request, res: Response) => {
  const article = await knowledgeBaseService.createKnowledgeBaseArticle(req.body, req.organization!._id, req.user!.id);

  await logAction({
    req,
    action: "CREATE",
    module: "KnowledgeBaseArticle",
    recordId: article.id,
    recordLabel: article.title,
    newValue: req.body,
  });

  ok(res, article, "Knowledge base article created", 201);
});

export const updateKnowledgeBaseArticle = asyncHandler(async (req: Request, res: Response) => {
  const before = await knowledgeBaseService.getKnowledgeBaseArticleById(req.params.id, req.organization!._id);
  const oldValue = {
    title: before.title,
    content: before.content,
    category: before.category,
    tags: before.tags,
    status: before.status,
  };

  const article = await knowledgeBaseService.updateKnowledgeBaseArticle(req.params.id, req.body, req.organization!._id);

  await logAction({
    req,
    action: "UPDATE",
    module: "KnowledgeBaseArticle",
    recordId: article.id,
    recordLabel: article.title,
    oldValue,
    newValue: req.body,
  });

  ok(res, article, "Knowledge base article updated");
});

export const deleteKnowledgeBaseArticle = asyncHandler(async (req: Request, res: Response) => {
  const article = await knowledgeBaseService.deleteKnowledgeBaseArticle(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "KnowledgeBaseArticle",
    recordId: req.params.id,
    recordLabel: article.title,
  });

  ok(res, null, "Knowledge base article deleted");
});

export const listDeletedKnowledgeBaseArticles = asyncHandler(async (req: Request, res: Response) => {
  const result = await knowledgeBaseService.listKnowledgeBaseArticles(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id
  );
  ok(res, result, "Deleted knowledge base articles");
});

export const restoreKnowledgeBaseArticle = asyncHandler(async (req: Request, res: Response) => {
  const article = await knowledgeBaseService.restoreKnowledgeBaseArticle(req.params.id, req.organization!._id);

  await logAction({
    req,
    action: "RESTORE",
    module: "KnowledgeBaseArticle",
    recordId: article.id,
    recordLabel: article.title,
  });

  ok(res, article, "Knowledge base article restored");
});
