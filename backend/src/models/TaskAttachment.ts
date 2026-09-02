import { Schema, model, type Types } from "mongoose";

/** Mirrors models/AssetDocument.ts field-for-field, minus `type` - AssetDocument's type enum
 * (Invoice/Warranty/AMC/Purchase/Other) is asset-specific; Task attachments are generic files, no
 * categorization needed. */
export interface ITaskAttachment {
  task: Types.ObjectId;
  organization: Types.ObjectId;
  originalName: string;
  storedFileName: string;
  mimeType: string;
  size: number;
  uploadedBy: Types.ObjectId | null;
}

const taskAttachmentSchema = new Schema<ITaskAttachment>(
  {
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    originalName: { type: String, required: true },
    storedFileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

export const TaskAttachment = model<ITaskAttachment>("TaskAttachment", taskAttachmentSchema);
