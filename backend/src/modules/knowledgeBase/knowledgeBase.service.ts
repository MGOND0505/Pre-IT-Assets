import { KnowledgeBaseArticle, type IKnowledgeBaseArticle } from "../../models/KnowledgeBaseArticle";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { escapeRegex } from "../../utils/regex";

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "Published" | "Draft";
  category?: string;
  includeDeleted?: boolean;
};

export async function listKnowledgeBaseArticles(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.status) filter.status = input.status;
  if (input.category) filter.category = input.category;
  if (input.search) {
    const search = escapeRegex(input.search);
    filter.$or = [{ title: { $regex: search, $options: "i" } }, { content: { $regex: search, $options: "i" } }];
  }

  const [items, total] = await Promise.all([
    KnowledgeBaseArticle.find(filter)
      .populate("category", "name")
      .populate("createdBy", "name")
      .sort({ createdDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    KnowledgeBaseArticle.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getKnowledgeBaseArticleById(id: string, organizationId: string) {
  const article = await KnowledgeBaseArticle.findOne({ organization: organizationId, _id: id, isDeleted: false })
    .populate("category", "name")
    .populate("createdBy", "name");
  if (!article) throw new ApiError(404, "Knowledge base article not found");
  return article;
}

export async function createKnowledgeBaseArticle(
  input: {
    title: string;
    content: string;
    category?: string | null;
    tags?: string[];
    status?: "Published" | "Draft";
  },
  organizationId: string,
  createdBy: string
) {
  return KnowledgeBaseArticle.create({ organization: organizationId, createdBy, ...input });
}

export async function updateKnowledgeBaseArticle(
  id: string,
  input: Partial<{
    title: string;
    content: string;
    category: string | null;
    tags: string[];
    status: "Published" | "Draft";
  }>,
  organizationId: string
) {
  const article = await getKnowledgeBaseArticleById(id, organizationId);
  Object.assign(article, input);
  await article.save();
  return article;
}

/** Soft delete: hidden from normal listings but recoverable via the Recycle Bin. */
export async function deleteKnowledgeBaseArticle(id: string, deletedBy: string, organizationId: string) {
  const article = await getKnowledgeBaseArticleById(id, organizationId);
  article.isDeleted = true;
  article.deletedAt = new Date();
  article.deletedBy = deletedBy as unknown as IKnowledgeBaseArticle["deletedBy"];
  await article.save();
  return article;
}

export async function restoreKnowledgeBaseArticle(id: string, organizationId: string) {
  const article = await KnowledgeBaseArticle.findOne({ organization: organizationId, _id: id, isDeleted: true });
  if (!article) throw new ApiError(404, "Deleted knowledge base article not found");

  article.isDeleted = false;
  article.deletedAt = null;
  article.deletedBy = null;
  await article.save();
  return article;
}
