import { env } from "../../config/env";
import type { EmailProvider } from "./EmailProvider";
import { ConsoleEmailProvider } from "./ConsoleEmailProvider";

function createEmailProvider(): EmailProvider {
  switch (env.MAIL_PROVIDER) {
    case "console":
    default:
      return new ConsoleEmailProvider();
    // case "smtp": return new SmtpEmailProvider(); // added in Phase 12
  }
}

export const emailProvider = createEmailProvider();
