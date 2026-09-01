import { Schema, model, type Types } from "mongoose";

export interface IImportBatch {
  organization: Types.ObjectId;
  module: string;
  performedBy: Types.ObjectId | null;
  performedBySnapshot: { name: string | null; email: string | null };
  fileName: string | null;
  counts: { total: number; added: number; updated: number; duplicates: number; invalid: number };
  errors: string[];
  createdAt: Date;
}

const importBatchSchema = new Schema<IImportBatch>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    module: { type: String, required: true, index: true },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    performedBySnapshot: {
      name: { type: String, default: null },
      email: { type: String, default: null },
    },
    fileName: { type: String, default: null },
    counts: {
      total: { type: Number, required: true },
      added: { type: Number, required: true },
      updated: { type: Number, required: true },
      duplicates: { type: Number, required: true },
      invalid: { type: Number, required: true },
    },
    errors: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

importBatchSchema.index({ organization: 1, module: 1, createdAt: -1 });

// Same convention as AuditLog: an import batch record is a historical fact, never edited or
// removed after the fact, even by internal code.
for (const op of ["findOneAndUpdate", "updateOne", "updateMany", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  importBatchSchema.pre(op, function (next) {
    next(new Error("ImportBatch documents are immutable"));
  });
}

export const ImportBatch = model<IImportBatch>("ImportBatch", importBatchSchema);
