import { Schema, model, type Types } from "mongoose";

/** Phase 1 of the AI Assistant rebuild - a standalone, admin-authored content module. No AI/
 * Ollama dependency here; a later phase will have the assistant search these articles to
 * recommend solutions (see the text index below), but this phase is purely the content
 * management layer, mirroring Designation in soft-delete/recycle-bin shape. */
export interface IKnowledgeBaseArticle {
  organization: Types.ObjectId;
  title: string;
  content: string;
  category: Types.ObjectId | null;
  tags: string[];
  status: "Published" | "Draft";
  createdBy: Types.ObjectId | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const knowledgeBaseArticleSchema = new Schema<IKnowledgeBaseArticle>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: "HelpdeskCategory", default: null },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ["Published", "Draft"], default: "Draft" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

// Relevance-ranked full-text search within an org's own articles - not used by this phase's
// basic admin list (which stays on the same escapeRegex + $regex convention as every other
// module's list), but wired now since a text index can't be added without a model change later,
// and a later phase's "recommended solutions" retrieval will need it.
knowledgeBaseArticleSchema.index({ title: "text", content: "text", tags: "text" });

export const KnowledgeBaseArticle = model<IKnowledgeBaseArticle>("KnowledgeBaseArticle", knowledgeBaseArticleSchema);
