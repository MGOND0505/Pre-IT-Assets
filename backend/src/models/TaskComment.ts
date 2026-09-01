import { Schema, model, type Types } from "mongoose";

export interface ITaskComment {
  organization: Types.ObjectId;
  task: Types.ObjectId;
  author: Types.ObjectId;
  body: string;
}

const taskCommentSchema = new Schema<ITaskComment>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

export const TaskComment = model<ITaskComment>("TaskComment", taskCommentSchema);
