import { TaskComment } from "../../models/TaskComment";

export async function listComments(taskId: string, organizationId: string) {
  return TaskComment.find({ task: taskId, organization: organizationId })
    .populate({ path: "author", select: "name email" })
    .sort({ createdDate: 1 });
}

export async function addComment(taskId: string, organizationId: string, authorId: string, body: string) {
  const comment = await TaskComment.create({ organization: organizationId, task: taskId, author: authorId, body });
  return TaskComment.findById(comment._id).populate({ path: "author", select: "name email" });
}
