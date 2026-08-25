export type EmailMessage = {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
