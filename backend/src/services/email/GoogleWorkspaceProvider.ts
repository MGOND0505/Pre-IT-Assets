import crypto from "node:crypto";
import type { EmailProvider, EmailMessage } from "./EmailProvider";
import type { ISystemSettings } from "../../models/SystemSettings";

export type GoogleWorkspaceConfig = Pick<
  ISystemSettings,
  "googleServiceAccountEmail" | "googleServiceAccountPrivateKey" | "googleSenderEmail"
>;

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Domain-wide delegation service account auth - no interactive login. Requires a Google
 * Cloud service account with the Gmail API "https://www.googleapis.com/auth/gmail.send"
 * scope authorized for domain-wide delegation in the Google Workspace admin console, then
 * impersonating googleSenderEmail (a real mailbox in the Workspace domain).
 */
export class GoogleWorkspaceProvider implements EmailProvider {
  constructor(private readonly config: GoogleWorkspaceConfig) {}

  private async getAccessToken(): Promise<string> {
    const privateKey = this.config.googleServiceAccountPrivateKey.replace(/\\n/g, "\n");
    const now = Math.floor(Date.now() / 1000);

    const header = { alg: "RS256", typ: "JWT" };
    const claims = {
      iss: this.config.googleServiceAccountEmail,
      scope: "https://www.googleapis.com/auth/gmail.send",
      aud: "https://oauth2.googleapis.com/token",
      sub: this.config.googleSenderEmail,
      iat: now,
      exp: now + 3600,
    };

    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
    const signature = crypto.createSign("RSA-SHA256").update(signingInput).sign(privateKey);
    const assertion = `${signingInput}.${base64url(signature)}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google token request failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  async send(message: EmailMessage): Promise<void> {
    const token = await this.getAccessToken();
    const to = Array.isArray(message.to) ? message.to.join(", ") : message.to;

    const headers = [
      `From: ${this.config.googleSenderEmail}`,
      `To: ${to}`,
      message.cc?.length ? `Cc: ${message.cc.join(", ")}` : null,
      message.bcc?.length ? `Bcc: ${message.bcc.join(", ")}` : null,
      `Subject: ${message.subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
    ].filter((line): line is string => line !== null);

    const rawMessage = `${headers.join("\r\n")}\r\n\r\n${message.html}`;

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: base64url(rawMessage) }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gmail API send failed (${res.status}): ${body}`);
    }
  }
}
