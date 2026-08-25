import { NotificationLog } from "../../models/NotificationLog";
import { logger } from "../../utils/logger";
import type { EmailMessage } from "../email/EmailProvider";

export async function logNotification(params: {
  organizationId: string;
  channel: string;
  message: EmailMessage;
  status: "sent" | "failed";
  error?: string;
}): Promise<void> {
  try {
    await NotificationLog.create({
      organization: params.organizationId,
      channel: params.channel,
      to: Array.isArray(params.message.to) ? params.message.to : [params.message.to],
      cc: params.message.cc ?? [],
      bcc: params.message.bcc ?? [],
      subject: params.message.subject,
      status: params.status,
      error: params.error ?? "",
    });
  } catch (err) {
    // Never let a logging failure mask the real send result.
    logger.error(`Failed to write notification log: ${err instanceof Error ? err.message : err}`);
  }
}
