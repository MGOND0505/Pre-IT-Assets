import type { EmailProvider, EmailMessage } from "./EmailProvider";
import type { ISystemSettings } from "../../models/SystemSettings";

export type Microsoft365Config = Pick<ISystemSettings, "m365TenantId" | "m365ClientId" | "m365ClientSecret" | "m365SenderEmail">;

function toRecipients(addresses: string[] | undefined) {
  return (addresses ?? []).map((address) => ({ emailAddress: { address } }));
}

/**
 * App-only (client credentials) Microsoft Graph auth - no interactive login, suitable for a
 * background job. Requires an Azure AD app registration with the application permission
 * "Mail.Send" and admin consent granted, sending as m365SenderEmail (a real mailbox in the tenant).
 */
export class Microsoft365Provider implements EmailProvider {
  constructor(private readonly config: Microsoft365Config) {}

  private async getAccessToken(): Promise<string> {
    const res = await fetch(`https://login.microsoftonline.com/${this.config.m365TenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.m365ClientId,
        client_secret: this.config.m365ClientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Microsoft 365 token request failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  async send(message: EmailMessage): Promise<void> {
    const token = await this.getAccessToken();
    const toList = Array.isArray(message.to) ? message.to : [message.to];

    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(this.config.m365SenderEmail)}/sendMail`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            subject: message.subject,
            body: { contentType: "HTML", content: message.html },
            toRecipients: toRecipients(toList),
            ccRecipients: toRecipients(message.cc),
            bccRecipients: toRecipients(message.bcc),
          },
          saveToSentItems: false,
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Microsoft Graph sendMail failed (${res.status}): ${body}`);
    }
  }
}
