import type { PermissionAction, PermissionModule, PermissionsShape } from "../../config/permissions";
import { hasPermission } from "../../middleware/authorize";
import { ApiError } from "../../utils/ApiError";
import * as assetsService from "../assets/assets.service";
import * as licensesService from "../licenses/licenses.service";
import * as helpdeskService from "../helpdesk/helpdesk.service";
import * as tasksService from "../tasks/tasks.service";
import * as knowledgeBaseService from "../knowledgeBase/knowledgeBase.service";
import * as vendorsService from "../vendors/vendors.service";
import * as departmentsService from "../departments/departments.service";
import * as locationsService from "../locations/locations.service";
import * as usersService from "../users/users.service";

/**
 * THE non-negotiable safety boundary for the whole AI Assistant feature: every tool below is
 * gated on the REAL requesting user's permission for its module (never just inherited from the
 * underlying service call), and every handler delegates to the exact same already
 * ownership-scoped service function the normal UI/API already uses - passing `requestingUser`
 * through unchanged so an Employee-tier caller's tool results are automatically restricted to
 * their own assigned/created records exactly like the real UI. Nothing here ever issues its own
 * raw Mongoose query to re-implement that scoping.
 */
export type RequestingUser = { id: string; isAdmin: boolean; permissions: PermissionsShape };

export type ToolDefinition = {
  name: string;
  description: string;
  /** JSON-schema-shaped parameters, exactly as handed to the model's `tools` array. */
  parameters: Record<string, unknown>;
  /** Which permission gates this tool - checked independently in BOTH getAvailableTools (so an
   * unauthorized tool is never even offered to the model) AND executeTool (so a model that
   * somehow requests a tool it wasn't offered still can't run it - the model's own output is
   * never trusted as an authorization boundary). */
  module: PermissionModule;
  action: PermissionAction;
  handler: (args: Record<string, unknown>, requestingUser: RequestingUser, organizationId: string) => Promise<unknown>;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

const ALL_TOOLS: ToolDefinition[] = [
  {
    name: "search_assets",
    description:
      "Search the organization's IT assets (laptops, monitors, phones, etc). An Employee-tier caller only ever sees assets assigned to them, exactly like the normal Assets page - this tool cannot see more than the requesting user already can in the UI.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (asset name, serial number, tag, model, etc)." },
        status: { type: "string", description: "Optional exact status filter, e.g. Assigned, Available, Under Repair." },
      },
    },
    module: "assets",
    action: "view",
    handler: async (args, requestingUser, organizationId) => {
      const input = { search: asString(args.query), status: asString(args.status), limit: 10 };
      const result = await assetsService.listAssets(input as never, organizationId, requestingUser);
      return {
        total: result.total,
        items: result.items.map((a) => ({ assetId: a.assetId, name: a.name, status: a.status })),
      };
    },
  },
  {
    name: "search_licenses",
    description:
      "Search the organization's software licenses. An Employee-tier caller only ever sees licenses assigned to them, exactly like the normal Licenses page.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (software name, publisher, license ID, etc)." },
      },
    },
    module: "licenses",
    action: "view",
    handler: async (args, requestingUser, organizationId) => {
      const input = { search: asString(args.query), limit: 10 };
      const result = await licensesService.listLicenses(organizationId, input as never, requestingUser);
      return {
        total: result.total,
        items: result.items.map((l) => ({ licenseId: l.licenseId, softwareName: l.softwareName, status: l.status })),
      };
    },
  },
  {
    name: "search_tickets",
    description:
      "Search the organization's helpdesk tickets. An Employee-tier caller only ever sees tickets they themselves filed, exactly like the normal Helpdesk page.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (subject, ticket ID)." },
        status: { type: "string", description: "Optional exact status filter, e.g. New, In Progress, Resolved, Closed." },
      },
    },
    module: "helpdesk",
    action: "view",
    handler: async (args, requestingUser, organizationId) => {
      const input = { search: asString(args.query), status: asString(args.status), limit: 10 };
      const result = await helpdeskService.listTickets(input as never, organizationId, requestingUser);
      return {
        total: result.total,
        items: result.items.map((t) => ({ ticketId: t.ticketId, subject: t.subject, status: t.status })),
      };
    },
  },
  {
    name: "search_tasks",
    description:
      "Search the organization's tasks. An Employee-tier caller only ever sees tasks assigned to (or created by) them, exactly like the normal Tasks page.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (task title)." },
        status: { type: "string", description: "Optional exact status filter, e.g. To Do, In Progress, Done." },
      },
    },
    module: "tasks",
    action: "view",
    handler: async (args, requestingUser, organizationId) => {
      const input = { search: asString(args.query), status: asString(args.status), limit: 10 };
      const result = await tasksService.listTasks(input as never, organizationId, requestingUser);
      return {
        total: result.total,
        items: result.items.map((t) => ({ taskId: t.taskId, title: t.title, status: t.status })),
      };
    },
  },
  {
    name: "search_knowledge_base",
    description:
      "Search the organization's published Knowledge Base articles for help/how-to content. Every user with access to this tool sees the same set of Published articles - Knowledge Base is not per-user ownership-scoped.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (title or content)." },
      },
      required: ["query"],
    },
    module: "knowledgeBase",
    action: "view",
    handler: async (args, _requestingUser, organizationId) => {
      const input = { search: asString(args.query), status: "Published" as const, limit: 5 };
      const result = await knowledgeBaseService.listKnowledgeBaseArticles(input, organizationId);
      return {
        total: result.total,
        items: result.items.map((a) => ({ title: String(a.title ?? ""), snippet: String(a.content ?? "").slice(0, 200) })),
      };
    },
  },
  {
    name: "search_vendors",
    description:
      "Search the organization's vendors/suppliers (name, contact person, email, status). Not ownership-scoped - every user with access to this tool sees the same org-wide vendor list, same as the normal Vendors page.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (vendor name, contact person, or email)." },
        status: { type: "string", description: "Optional exact status filter, e.g. Active, Inactive." },
      },
    },
    module: "vendors",
    action: "view",
    handler: async (args, _requestingUser, organizationId) => {
      const input = { search: asString(args.query), status: asString(args.status) as never, limit: 10 };
      const result = await vendorsService.listVendors(input, organizationId);
      return {
        total: result.total,
        items: result.items.map((v) => ({ name: v.name, contactPerson: v.contactPerson, email: v.email, status: v.status })),
      };
    },
  },
  {
    name: "search_departments",
    description:
      "Search the organization's departments (name, status). Not ownership-scoped - every user with access to this tool sees the same org-wide department list, same as the normal Departments page.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (department name)." },
        status: { type: "string", description: "Optional exact status filter, e.g. Active, Inactive." },
      },
    },
    module: "departments",
    action: "view",
    handler: async (args, _requestingUser, organizationId) => {
      const input = { search: asString(args.query), status: asString(args.status) as never, limit: 10 };
      const result = await departmentsService.listDepartments(input, organizationId);
      return { total: result.total, items: result.items.map((d) => ({ name: d.name, status: d.status })) };
    },
  },
  {
    name: "search_locations",
    description:
      "Search the organization's locations/sites (name, status). Not ownership-scoped - every user with access to this tool sees the same org-wide location list, same as the normal Locations page.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (location name)." },
        status: { type: "string", description: "Optional exact status filter, e.g. Active, Inactive." },
      },
    },
    module: "locations",
    action: "view",
    handler: async (args, _requestingUser, organizationId) => {
      const input = { search: asString(args.query), status: asString(args.status) as never, limit: 10 };
      const result = await locationsService.listLocations(input, organizationId);
      return { total: result.total, items: result.items.map((l) => ({ name: l.name, status: l.status })) };
    },
  },
  {
    name: "search_users",
    description:
      "Search the organization's user directory (name, email, employee ID, role, status). Gated on the same 'users' permission as the normal Users page (typically Admin/Sub Admin only) - a regular Employee will never even see this tool offered, exactly like they can't see the Users page today.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (name, email, or employee ID)." },
        status: { type: "string", description: "Optional exact status filter, e.g. Active, Inactive." },
      },
    },
    module: "users",
    action: "view",
    handler: async (args, _requestingUser, organizationId) => {
      const input = { search: asString(args.query), status: asString(args.status) as never, limit: 10 };
      const result = await usersService.listUsers(input, organizationId);
      return {
        total: result.total,
        items: result.items.map((u) => ({ name: u.name, email: u.email, employeeId: u.employeeId, role: u.role, status: u.status })),
      };
    },
  },
  {
    name: "propose_ticket",
    description:
      "Draft a NEW helpdesk ticket for the user to review and explicitly confirm before it is actually created - this tool NEVER creates a ticket itself, it only returns a draft for human confirmation.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Short ticket subject/title." },
        description: { type: "string", description: "Full description of the issue." },
        categoryName: { type: "string", description: "Best-guess category name, e.g. Hardware, Software, Network." },
        priority: { type: "string", description: "Best-guess priority name, e.g. Low, Medium, High, Urgent." },
      },
      required: ["subject", "description"],
    },
    module: "helpdesk",
    action: "create",
    handler: async (args) => {
      const subject = asString(args.subject);
      const description = asString(args.description);
      if (!subject || !description) {
        throw new ApiError(400, "A ticket draft needs at least a subject and description");
      }
      return {
        subject,
        description,
        categoryName: asString(args.categoryName) ?? null,
        priority: asString(args.priority) ?? null,
      };
    },
  },
];

/** Filters the full tool catalog down to only what this specific requesting user's permissions
 * allow - a tool the user lacks permission for is never even listed as available to the model,
 * never mind executed. */
export function getAvailableTools(requestingUser: RequestingUser): ToolDefinition[] {
  return ALL_TOOLS.filter((tool) => hasPermission(requestingUser, tool.module, tool.action));
}

/** Dispatches a model-requested tool call. Re-checks the permission gate defensively even though
 * getAvailableTools already filtered the catalog the model was offered - the model's own output
 * is never trusted as an authorization boundary, so a tool name it wasn't offered (or one it
 * hallucinated) is refused here too, not just silently filtered upstream. */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  requestingUser: RequestingUser,
  organizationId: string
): Promise<unknown> {
  const tool = ALL_TOOLS.find((t) => t.name === toolName);
  if (!tool) throw new ApiError(400, `Unknown tool: ${toolName}`);
  if (!hasPermission(requestingUser, tool.module, tool.action)) {
    throw new ApiError(403, `You do not have permission to use the "${toolName}" tool`);
  }
  return tool.handler(args, requestingUser, organizationId);
}

/** A short, human-readable summary of a tool call and its result - used for BOTH the AiActivityLog
 * entry and the `role: "tool"` message appended back into the conversation for the model to read.
 * Deliberately never a raw dump of the full result payload (see AiActivityLog.ts's own doc
 * comment on `summary`). */
export function summarizeToolResult(toolName: string, args: Record<string, unknown>, result: unknown): string {
  const query = asString((args as Record<string, unknown>).query);

  if (toolName === "propose_ticket") {
    const draft = result as { subject: string };
    return `Drafted a ticket ("${draft.subject}") for the user to review and confirm - not yet created.`;
  }

  const r = result as { total?: number; items?: { [key: string]: unknown }[] };
  const total = r?.total ?? 0;
  const labelOf = (item: Record<string, unknown>) => {
    const label = item.name ?? item.subject ?? item.title ?? item.softwareName ?? item.assetId ?? "";
    const id = item.assetId ?? item.licenseId ?? item.ticketId ?? item.taskId ?? "";
    return [id, label].filter(Boolean).join(" - ");
  };
  const sample = (r?.items ?? []).slice(0, 5).map((item) => labelOf(item as Record<string, unknown>));

  const verb = toolName.startsWith("search_") ? toolName.replace("search_", "Searched ") : toolName;
  const queryPart = query ? `: "${query}"` : "";
  const countPart = `found ${total} result(s)`;
  const samplePart = sample.length > 0 ? ` - e.g. ${sample.join(", ")}` : "";
  return `${verb}${queryPart} - ${countPart}${samplePart}`;
}
