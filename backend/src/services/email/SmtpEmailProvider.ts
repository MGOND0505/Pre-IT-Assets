import nodemailer from "nodemailer";
import type { EmailProvider, EmailMessage } from "./EmailProvider";
import type { ISystemSettings } from "../../models/SystemSettings";

export type SmtpConfig = Pick<
  ISystemSettings,
  "smtpHost" | "smtpPort" | "smtpUser" | "smtpPassword" | "smtpSecure" | "smtpFromEmail" | "smtpFromName"
>;

export class SmtpEmailProvider implements EmailProvider {
  constructor(private readonly config: SmtpConfig) {}

  async send(message: EmailMessage): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      auth: this.config.smtpUser ? { user: this.config.smtpUser, pass: this.config.smtpPassword } : undefined,
    });

    const from = this.config.smtpFromName
      ? `"${this.config.smtpFromName}" <${this.config.smtpFromEmail}>`
      : this.config.smtpFromEmail;

    await transporter.sendMail({
      from,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      html: message.html,
    });
  }
}
