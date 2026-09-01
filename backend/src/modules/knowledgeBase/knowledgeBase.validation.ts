import { z } from "zod";

export const createKnowledgeBaseArticleSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(["Published", "Draft"]).optional(),
});

export const updateKnowledgeBaseArticleSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
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
