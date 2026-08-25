import cron from "node-cron";
import { Ticket } from "../../models/Ticket";
import type { SupportTier } from "../../models/SupportTeam";
import { Task } from "../../models/Task";
import { AuditLog } from "../../models/AuditLog";
import { autoAssignTicket } from "../../modules/helpdesk/roundRobin.service";
import { notifyTicketEvent } from "../../modules/helpdesk/helpdeskNotifications";
import { notifyTaskEvent } from "../../modules/tasks/taskNotifications";
import { logger } from "../../utils/logger";

const TASK_TERMINAL_STATUSES = ["Done", "Cancelled"];

const TERMINAL_STATUSES = ["Resolved", "Closed"];
const WARNING_WINDOW_MINUTES = 30;
const NEXT_TIER: Record<SupportTier, SupportTier | null> = { L1: "L2", L2: "L3", L3: null };

async function sendSlaWarnings(): Promise<number> {
  const now = new Date();
  const warningThreshold = new Date(now.getTime() + WARNING_WINDOW_MINUTES * 60 * 1000);

  const tickets = await Ticket.find({
    isDeleted: false,
    status: { $nin: TERMINAL_STATUSES },
    slaResolutionDueAt: { $ne: null, $gt: now, $lte: warningThreshold },
    slaWarningSent: false,
  }).populate({ path: "requester", select: "_id" });

  for (const ticket of tickets) {
    ticket.slaWarningSent = true;
    await ticket.save();
    if (ticket.assignedAgent) {
      await notifyTicketEvent("ticketSlaWarning", String(ticket.assignedAgent), String(ticket.organization), {
        ticketId: ticket.ticketId,
        subject: ticket.subject,
      });
    }
  }
  return tickets.length;
}

/** Escalates any ticket past its resolution SLA to the next tier (L1 -> L2 -> L3), re-running
 * round-robin for the new tier. A ticket already at L3 just stays flagged as breached - there's
 * nowhere further to escalate to. */
async function escalateBreachedTickets(): Promise<number> {
  const now = new Date();

  const tickets = await Ticket.find({
    isDeleted: false,
    status: { $nin: TERMINAL_STATUSES },
    slaResolutionDueAt: { $ne: null, $lt: now },
    slaResolutionBreached: false,
  });

  for (const ticket of tickets) {
    ticket.slaResolutionBreached = true;
    const nextTier = NEXT_TIER[ticket.tier];

    if (nextTier) {
      const previousTier = ticket.tier;
      const previousAgent = ticket.assignedAgent;
      ticket.tier = nextTier;
      ticket.assignedAgent = null;
      ticket.assignedTeam = null;
      await autoAssignTicket(ticket);
      await ticket.save();

      await AuditLog.create({
        organization: ticket.organization,
        user: null,
        userSnapshot: { name: "System", email: null, role: null },
        action: "ESCALATE",
        module: "Ticket",
        recordId: String(ticket._id),
        recordLabel: ticket.ticketId,
        oldValue: { tier: previousTier, agent: previousAgent },
        newValue: { tier: ticket.tier, agent: ticket.assignedAgent },
      });

      if (ticket.assignedAgent) {
        await notifyTicketEvent("ticketEscalated", String(ticket.assignedAgent), String(ticket.organization), {
          ticketId: ticket.ticketId,
          subject: ticket.subject,
          tier: ticket.tier,
        });
      }
    } else {
      await ticket.save();
    }
  }
  return tickets.length;
}

/** Flags overdue tasks and sends one notice each - re-runs harmlessly find nothing further to do
 * once `overdueNoticeSent` is set, and it's cleared again if the task is reopened (see
 * tasks.service.ts#setTaskStatus). */
async function notifyOverdueTasks(): Promise<number> {
  const now = new Date();

  const tasks = await Task.find({
    isDeleted: false,
    status: { $nin: TASK_TERMINAL_STATUSES },
    dueDate: { $ne: null, $lt: now },
    overdueNoticeSent: false,
  });

  for (const task of tasks) {
    task.overdueNoticeSent = true;
    await task.save();
    await notifyTaskEvent("taskOverdue", String(task.assignedTo), String(task.organization), {
      taskId: task.taskId,
      title: task.title,
    });
  }
  return tasks.length;
}

export async function runEscalationCheck(): Promise<void> {
  const [warned, escalated, overdueTasks] = await Promise.all([
    sendSlaWarnings(),
    escalateBreachedTickets(),
    notifyOverdueTasks(),
  ]);
  if (warned > 0 || escalated > 0 || overdueTasks > 0) {
    logger.info(
      `Helpdesk SLA check: ${warned} warning(s) sent, ${escalated} ticket(s) escalated/breach-flagged, ${overdueTasks} overdue task notice(s) sent`
    );
  }
}

/** Runs every 15 minutes - SLA breach detection needs much finer granularity than the once-daily
 * jobs elsewhere in this codebase (organization expiry, asset/license alerts). */
export function startEscalationScheduler(): void {
  cron.schedule("*/15 * * * *", () => {
    runEscalationCheck().catch((err) => {
      logger.error(`Helpdesk escalation check failed: ${err instanceof Error ? err.message : err}`);
    });
  });
  logger.info("Helpdesk SLA/escalation scheduler started (every 15 minutes)");
}
