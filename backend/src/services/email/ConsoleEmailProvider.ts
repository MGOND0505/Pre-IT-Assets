import type { EmailProvider, EmailMessage } from "./EmailProvider";
import { logger } from "../../utils/logger";

export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    logger.info(
      `[ConsoleEmailProvider] To: ${message.to} | Subject: ${message.subject}\n${message.html}`
    );
  }
}
