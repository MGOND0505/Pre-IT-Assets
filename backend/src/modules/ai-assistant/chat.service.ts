import { ApiError } from "../../utils/ApiError";
import { ChatSession } from "../../models/ChatSession";
import { ChatMessage, type ChatMessageRole, type ChatMessageResolution } from "../../models/ChatMessage";

type RequestingUser = { id: string; isAdmin: boolean };

const TITLE_MAX_LENGTH = 60;

function deriveTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim();
  if (trimmed.length <= TITLE_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, TITLE_MAX_LENGTH).trimEnd()}...`;
}

export async function createSession(organizationId: string, userId: string, firstMessage: string) {
  return ChatSession.create({
    organization: organizationId,
    user: userId,
    title: deriveTitle(firstMessage),
    lastMessageAt: new Date(),
  });
}

type AppendInput = {
  role: ChatMessageRole;
  content: string;
  pendingChange?: unknown;
  results?: unknown;
};

export async function appendMessage(sessionId: string, organizationId: string, input: AppendInput) {
  const message = await ChatMessage.create({
    organization: organizationId,
    session: sessionId,
    role: input.role,
    content: input.content,
    pendingChange: input.pendingChange ?? null,
    results: input.results ?? null,
  });
  await ChatSession.updateOne({ _id: sessionId, organization: organizationId }, { lastMessageAt: new Date() });
  return message;
}

/** Replaces the client-supplied `history` array the chat endpoint used to trust - loading the
 * last N turns from the database instead means the model only ever sees what was actually said
 * in this session, not whatever a client chooses to send. */
export async function getRecentMessages(sessionId: string, organizationId: string, limit = 20) {
  const messages = await ChatMessage.find({ session: sessionId, organization: organizationId })
    .sort({ createdDate: -1 })
    .limit(limit);
  return messages.reverse();
}

async function getOwnedSession(sessionId: string, organizationId: string, requestingUser: RequestingUser) {
  const session = await ChatSession.findOne({ _id: sessionId, organization: organizationId });
  if (!session) throw new ApiError(404, "Conversation not found");
  if (String(session.user) !== requestingUser.id && !requestingUser.isAdmin) {
    throw new ApiError(403, "You do not have permission to view this conversation");
  }
  return session;
}

type ListInput = { scope: "mine" | "all"; userId?: string };

export async function listSessions(organizationId: string, requestingUser: RequestingUser, input: ListInput) {
  if (input.scope === "all" && !requestingUser.isAdmin) {
    throw new ApiError(403, "You do not have permission to view other users' conversations");
  }

  const filter: Record<string, unknown> = { organization: organizationId };
  if (input.scope === "mine") {
    filter.user = requestingUser.id;
  } else if (input.userId) {
    filter.user = input.userId;
  }

  const query = ChatSession.find(filter).sort({ lastMessageAt: -1 }).limit(50);
  if (input.scope === "all") query.populate("user", "name email");
  return query;
}

export async function getSessionMessages(sessionId: string, organizationId: string, requestingUser: RequestingUser) {
  await getOwnedSession(sessionId, organizationId, requestingUser);
  return ChatMessage.find({ session: sessionId, organization: organizationId }).sort({ createdDate: 1 });
}

export async function deleteSession(sessionId: string, organizationId: string, requestingUser: RequestingUser) {
  await getOwnedSession(sessionId, organizationId, requestingUser);
  await ChatMessage.deleteMany({ session: sessionId, organization: organizationId });
  await ChatSession.deleteOne({ _id: sessionId, organization: organizationId });
}

export async function resolvePendingMessage(token: string, resolution: ChatMessageResolution) {
  await ChatMessage.updateOne({ "pendingChange.token": token }, { resolution });
}
