import mongoose from "mongoose";
import { env } from "../config/env";
import { Organization } from "../models/Organization";
import { NotificationTemplate, type NotificationTemplateKey } from "../models/NotificationTemplate";
import { DEFAULT_TEMPLATES } from "../services/notifications/templates";

/** One-off migration, safe to re-run after each round of template wording changes: per-org
 * NotificationTemplate rows are lazily seeded from DEFAULT_TEMPLATES the first time a key is used
 * (see templates.ts#getTemplate), so an org that already triggered ticketAssigned/ticketReassigned/
 * ticketEscalated before a wording change is stuck on whatever generation it was seeded at unless
 * something re-seeds it. This only overwrites a row if its stored subject+bodyHtml exactly match
 * ANY previously-known generation below (not just the immediately-prior one - an org could be
 * sitting on an older generation than the last time this ran) - an org whose wording matches none
 * of them has been genuinely customized, and is left untouched. Add this run's outgoing defaults
 * as a new entry here each time DEFAULT_TEMPLATES changes, so the next run can still recognize it. */
const KNOWN_PREVIOUS_GENERATIONS: Partial<Record<NotificationTemplateKey, { subject: string; bodyHtml: string }[]>> = {
  ticketAssigned: [
    {
      subject: "Ticket {{ticketId}} assigned to you",
      bodyHtml: "<p>Ticket <b>{{ticketId}}</b> - {{subject}} has been assigned to you.</p>",
    },
    {
      subject: "Ticket {{ticketId}} assigned to you",
      bodyHtml:
        "<p>Ticket <b>{{ticketId}}</b> - {{subject}} has been assigned to you.</p>" +
        "<ul><li>Priority: {{priority}}</li><li>Category: {{category}}</li>" +
        "<li>Requester: {{requester}} ({{requesterEmail}})</li><li>Team: {{assignedTeam}}</li>" +
        "<li>Assigned by: {{assignedBy}}</li></ul>",
    },
  ],
  ticketReassigned: [
    {
      subject: "Ticket {{ticketId}} reassigned",
      bodyHtml: "<p>Ticket <b>{{ticketId}}</b> - {{subject}} has been reassigned to you.</p>",
    },
    {
      subject: "Ticket {{ticketId}} reassigned",
      bodyHtml:
        "<p>Ticket <b>{{ticketId}}</b> - {{subject}} has been reassigned to you.</p>" +
        "<ul><li>Priority: {{priority}}</li><li>Category: {{category}}</li>" +
        "<li>Requester: {{requester}} ({{requesterEmail}})</li><li>Team: {{assignedTeam}}</li>" +
        "<li>Previously assigned to: {{previousAgent}}</li><li>Reassigned by: {{assignedBy}}</li></ul>",
    },
  ],
  ticketEscalated: [
    {
      subject: "Ticket {{ticketId}} escalated to {{tier}}",
      bodyHtml: "<p>Ticket <b>{{ticketId}}</b> - {{subject}} breached its SLA and has been escalated to {{tier}}.</p>",
    },
    {
      subject: "Ticket {{ticketId}} escalated to {{tier}}",
      bodyHtml:
        "<p>Ticket <b>{{ticketId}}</b> - {{subject}} breached its SLA and has been escalated to {{tier}}.</p>" +
        "<ul><li>Priority: {{priority}}</li><li>Category: {{category}}</li>" +
        "<li>Requester: {{requester}} ({{requesterEmail}})</li><li>Team: {{assignedTeam}}</li>" +
        "<li>Previously assigned to: {{previousAgent}}</li></ul>",
    },
  ],
};

async function run() {
  await mongoose.connect(env.MONGODB_URI);

  const orgs = await Organization.find().select("_id name");
  let updated = 0;
  let skippedCustomized = 0;
  let skippedMissing = 0;

  for (const org of orgs) {
    for (const key of Object.keys(KNOWN_PREVIOUS_GENERATIONS) as NotificationTemplateKey[]) {
      const existing = await NotificationTemplate.findOne({ organization: org._id, key });
      if (!existing) {
        skippedMissing += 1;
        continue;
      }

      if (existing.subject === DEFAULT_TEMPLATES[key].subject && existing.bodyHtml === DEFAULT_TEMPLATES[key].bodyHtml) {
        continue; // already on the current default - nothing to do
      }

      const generations = KNOWN_PREVIOUS_GENERATIONS[key]!;
      const isKnownPriorGeneration = generations.some((g) => existing.subject === g.subject && existing.bodyHtml === g.bodyHtml);
      if (!isKnownPriorGeneration) {
        console.log(`Skipped (customized): ${org.name} / ${key}`);
        skippedCustomized += 1;
        continue;
      }

      existing.subject = DEFAULT_TEMPLATES[key].subject;
      existing.bodyHtml = DEFAULT_TEMPLATES[key].bodyHtml;
      await existing.save();
      console.log(`Updated: ${org.name} / ${key}`);
      updated += 1;
    }
  }

  console.log(`\nDone. Updated ${updated}, skipped ${skippedCustomized} customized, ${skippedMissing} not yet seeded (will get the new default automatically on first use).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Reseed failed:", err);
  process.exit(1);
});
