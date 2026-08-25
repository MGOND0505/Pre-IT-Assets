import type { EmailProvider, EmailMessage } from "./EmailProvider";
import { logger } from "../../utils/logger";

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    const to = Array.isArray(message.to) ? message.to.join(", ") : message.to;
    const cc = message.cc?.length ? ` | Cc: ${message.cc.join(", ")}` : "";
    const bcc = message.bcc?.length ? ` | Bcc: ${message.bcc.join(", ")}` : "";
    logger.info(`[ConsoleEmailProvider] To: ${to}${cc}${bcc} | Subject: ${message.subject}\n${message.html}`);
  }
}
