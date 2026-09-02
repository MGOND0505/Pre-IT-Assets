import { z } from "zod";

export const createKnowledgeBaseArticleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50_000),
  category: z.string().optional(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  status: z.enum(["Published", "Draft"]).optional(),
});

export const updateKnowledgeBaseArticleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50_000).optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  status: z.enum(["Published", "Draft"]).optional(),
});

export const listKnowledgeBaseArticlesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["Published", "Draft"]).optional(),
  category: z.string().optional(),
});

export const knowledgeBaseArticleIdParamsSchema = z.object({
  id: z.string().min(1),
});
