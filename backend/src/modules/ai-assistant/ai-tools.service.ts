import { Asset, type IAsset } from "../../models/Asset";
import { AssetCategory } from "../../models/AssetCategory";
import { Department } from "../../models/Department";
import { Location } from "../../models/Location";
import { User } from "../../models/User";
import { Ticket, type TicketStatus } from "../../models/Ticket";
import { HelpdeskCategory } from "../../models/HelpdeskCategory";
import { Task, TASK_STATUSES, TASK_PRIORITIES, type TaskStatus, type TaskPriority } from "../../models/Task";
import { hasPermission } from "../../middleware/authorize";
import type { PermissionModule, PermissionAction, PermissionsShape } from "../../config/permissions";
import { listAssets, getAssetById, updateAsset, createAsset } from "../assets/assets.service";
import { recordAssetHistory, listAssetHistory } from "../assets/assetHistory.service";
import { listTickets } from "../helpdesk/helpdesk.service";
import { listTasks } from "../tasks/tasks.service";
import { createPendingChange, type PendingAiChange } from "./pending-changes.store";
import type { OllamaTool } from "./ollama.client";
import { escapeRegex } from "../../utils/regex";

export type ToolContext = {
  organizationId: string;
  userId: string;
  isAdmin: boolean;
  permissions: PermissionsShape;
};

function canOrgUser(ctx: ToolContext, moduleKey: PermissionModule, action: PermissionAction): boolean {
  return hasPermission({ isAdmin: ctx.isAdmin, permissions: ctx.permissions }, moduleKey, action);
}

// Three thin, explicitly-typed wrappers rather than one generic taking a union of model
// classes - Mongoose's static findOne() overloads don't unify cleanly across different Model
// types in TypeScript, so a shared generic just fights the type checker for no real benefit.
async function findByNameRegex(
  organizationId: string,
  name: string,
  finder: (filter: Record<string, unknown>) => Promise<{ id: string; name: string } | null>
): Promise<{ id: string; name: string } | null> {
  return finder({ organization: organizationId, name: { $regex: escapeRegex(name), $options: "i" }, isDeleted: false });
}

async function resolveDepartmentByName(name: string, organizationId: string) {
  return findByNameRegex(organizationId, name, async (filter) => {
    const doc = await Department.findOne(filter).select("name");
    return doc ? { id: doc.id, name: doc.name } : null;
  });
}

async function resolveLocationByName(name: string, organizationId: string) {
  return findByNameRegex(organizationId, name, async (filter) => {
    const doc = await Location.findOne(filter).select("name");
    return doc ? { id: doc.id, name: doc.name } : null;
  });
}

async function resolveCategoryByName(name: string, organizationId: string) {
  return findByNameRegex(organizationId, name, async (filter) => {
    const doc = await AssetCategory.findOne(filter).select("name");
    return doc ? { id: doc.id, name: doc.name } : null;
  });
}

async function resolveHelpdeskCategoryByName(name: string, organizationId: string) {
  return findByNameRegex(organizationId, name, async (filter) => {
    const doc = await HelpdeskCategory.findOne(filter).select("name");
    return doc ? { id: doc.id, name: doc.name } : null;
  });
}

type UserMatch = { id: string; name: string; email: string; employeeId?: string };

/** Never guesses among multiple people with similar names - returns every match so the caller
 * (and ultimately the model, relaying this back to the person asking) can ask for clarification
 * instead of silently picking one. */
async function resolveUsersByName(name: string, organizationId: string): Promise<UserMatch[]> {
  const rx = { $regex: escapeRegex(name), $options: "i" };
  const users = await User.find({
    organization: organizationId,
    isDeleted: false,
    $or: [{ name: rx }, { email: rx }, { employeeId: rx }],
  })
    .select("name email employeeId")
    .limit(10);
  return users.map((u) => ({ id: u.id, name: u.name, email: u.email, employeeId: u.employeeId }));
}

async function findAssetByHumanId(assetId: string, organizationId: string) {
  return Asset.findOne({
    organization: organizationId,
    assetId: { $regex: `^${escapeRegex(assetId.trim())}$`, $options: "i" },
    isDeleted: false,
  }).populate([
    { path: "category", select: "name" },
    { path: "vendor", select: "name" },
    { path: "location", select: "name city" },
    { path: "department", select: "name" },
    { path: "assignedUser", select: "name email employeeId" },
  ]);
}

async function findTicketByHumanId(ticketId: string, organizationId: string) {
  return Ticket.findOne({
    organization: organizationId,
    ticketId: { $regex: `^${escapeRegex(ticketId.trim())}$`, $options: "i" },
    isDeleted: false,
  }).populate([
    { path: "category", select: "name" },
    { path: "priority", select: "name" },
    { path: "requester", select: "name email" },
    { path: "department", select: "name" },
    { path: "location", select: "name" },
    { path: "assignedAgent", select: "name email" },
  ]);
}

async function findTaskByHumanId(taskId: string, organizationId: string) {
  return Task.findOne({
    organization: organizationId,
    taskId: { $regex: `^${escapeRegex(taskId.trim())}$`, $options: "i" },
    isDeleted: false,
  }).populate([
    { path: "assignedTo", select: "name email" },
    { path: "assignedBy", select: "name email" },
    { path: "ticket", select: "ticketId subject" },
  ]);
}

/** Accepts a plain object - either a Mongoose document already converted via .toObject(), or
 * the recycle-bin-metadata-augmented plain objects listAssets() itself returns (which are never
 * real documents, so they'd have no .toObject() to call). */
function assetSummary(obj: Record<string, unknown>) {
  return {
    assetId: obj.assetId,
    name: obj.name,
    status: obj.status,
    category: (obj.category as { name?: string } | null)?.name ?? null,
    manufacturer: obj.manufacturer,
    model: obj.model,
    serialNumber: obj.serialNumber,
    assignedUser: (obj.assignedUser as { name?: string; email?: string } | null)?.name ?? null,
    employeeId: obj.employeeId,
    department: (obj.department as { name?: string } | null)?.name ?? null,
    location: (obj.location as { name?: string } | null)?.name ?? null,
    purchaseDate: obj.purchaseDate,
    purchaseCost: obj.purchaseCost,
    vendor: (obj.vendor as { name?: string } | null)?.name ?? null,
    warrantyStart: obj.warrantyStart,
    warrantyEnd: obj.warrantyEnd,
    amcStart: obj.amcStart,
    amcEnd: obj.amcEnd,
    condition: obj.condition,
    notes: obj.notes,
  };
}

function ticketSummary(obj: Record<string, unknown>) {
  return {
    ticketId: obj.ticketId,
    subject: obj.subject,
    status: obj.status,
    category: (obj.category as { name?: string } | null)?.name ?? null,
    priority: (obj.priority as { name?: string } | null)?.name ?? null,
    requester: (obj.requester as { name?: string; email?: string } | null)?.name ?? null,
    department: (obj.department as { name?: string } | null)?.name ?? null,
    location: (obj.location as { name?: string } | null)?.name ?? null,
    assignedAgent: (obj.assignedAgent as { name?: string; email?: string } | null)?.name ?? null,
    createdDate: obj.createdDate,
  };
}

function taskSummary(obj: Record<string, unknown>) {
  return {
    taskId: obj.taskId,
    title: obj.title,
    status: obj.status,
    priority: obj.priority,
    assignedTo: (obj.assignedTo as { name?: string; email?: string } | null)?.name ?? null,
    assignedBy: (obj.assignedBy as { name?: string; email?: string } | null)?.name ?? null,
    dueDate: obj.dueDate,
    ticket: (obj.ticket as { ticketId?: string } | null)?.ticketId ?? null,
    createdDate: obj.createdDate,
  };
}

// ---------------------------------------------------------------------------------------------
// Read tools - executed immediately, no confirmation needed (they never change data).
// ---------------------------------------------------------------------------------------------

export async function toolSearchAssets(
  args: {
    status?: string;
    departmentName?: string;
    locationName?: string;
    categoryName?: string;
    assignedUserName?: string;
    search?: string;
    warrantyStatus?: "active" | "expired" | "expiringSoon";
    page?: number;
    limit?: number;
  },
  ctx: ToolContext
) {
  if (!canOrgUser(ctx, "assets", "view")) {
    return { ok: false, message: "You don't have permission to view assets." };
  }

  const [department, location, category] = await Promise.all([
    args.departmentName ? resolveDepartmentByName(args.departmentName, ctx.organizationId) : null,
    args.locationName ? resolveLocationByName(args.locationName, ctx.organizationId) : null,
    args.categoryName ? resolveCategoryByName(args.categoryName, ctx.organizationId) : null,
  ]);
  if (args.departmentName && !department) {
    return { ok: false, message: `No department matching "${args.departmentName}" was found.` };
  }
  if (args.locationName && !location) {
    return { ok: false, message: `No location matching "${args.locationName}" was found.` };
  }
  if (args.categoryName && !category) {
    return { ok: false, message: `No asset category matching "${args.categoryName}" was found.` };
  }

  let assignedUserId: string | undefined;
  if (args.assignedUserName) {
    const matches = await resolveUsersByName(args.assignedUserName, ctx.organizationId);
    if (matches.length === 0) return { ok: false, message: `No person matching "${args.assignedUserName}" was found.` };
    if (matches.length > 1) {
      return {
        ok: false,
        message: `Multiple people match "${args.assignedUserName}" - please specify which one: ${matches
          .map((m) => `${m.name} (${m.email})`)
          .join(", ")}`,
      };
    }
    assignedUserId = matches[0].id;
  }

  const result = await listAssets(
    {
      status: args.status,
      department: department?.id,
      location: location?.id,
      category: category?.id,
      assignedUser: assignedUserId,
      search: args.search,
      warrantyStatus: args.warrantyStatus,
      page: args.page,
      limit: Math.min(args.limit ?? 20, 50),
    },
    ctx.organizationId,
    { id: ctx.userId, isAdmin: ctx.isAdmin, permissions: ctx.permissions }
  );

  return {
    ok: true,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    assets: result.items.map((a) => assetSummary(a)),
  };
}

export async function toolGetAssetDetails(args: { assetId: string }, ctx: ToolContext) {
  if (!canOrgUser(ctx, "assets", "view")) {
    return { ok: false, message: "You don't have permission to view assets." };
  }
  const asset = await findAssetByHumanId(args.assetId, ctx.organizationId);
  if (!asset) return { ok: false, message: `No asset found with ID "${args.assetId}".` };
  return { ok: true, asset: assetSummary(asset.toObject() as unknown as Record<string, unknown>) };
}

export async function toolGetAssetHistory(args: { assetId: string }, ctx: ToolContext) {
  if (!canOrgUser(ctx, "assets", "view")) {
    return { ok: false, message: "You don't have permission to view assets." };
  }
  const asset = await findAssetByHumanId(args.assetId, ctx.organizationId);
  if (!asset) return { ok: false, message: `No asset found with ID "${args.assetId}".` };
  const history = await listAssetHistory(asset.id);
  return {
    ok: true,
    assetId: asset.assetId,
    history: history.map((h) => ({
      action: h.action,
      user: (h.user as unknown as { name?: string } | null)?.name ?? "System",
      previousValue: h.previousValue,
      newValue: h.newValue,
      remarks: h.remarks,
      date: h.get("createdAt"),
    })),
  };
}

export async function toolSearchTickets(
  args: { search?: string; status?: string; categoryName?: string; page?: number; limit?: number },
  ctx: ToolContext
) {
  if (!canOrgUser(ctx, "helpdesk", "view")) {
    return { ok: false, message: "You don't have permission to view helpdesk tickets." };
  }

  const category = args.categoryName ? await resolveHelpdeskCategoryByName(args.categoryName, ctx.organizationId) : null;
  if (args.categoryName && !category) {
    return { ok: false, message: `No ticket category matching "${args.categoryName}" was found.` };
  }

  const result = await listTickets(
    {
      search: args.search,
      status: args.status as TicketStatus | undefined,
      category: category?.id,
      page: args.page,
      limit: Math.min(args.limit ?? 20, 50),
    },
    ctx.organizationId,
    { id: ctx.userId, isAdmin: ctx.isAdmin, permissions: ctx.permissions }
  );

  return {
    ok: true,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    tickets: result.items.map((t) => ticketSummary(t)),
  };
}

export async function toolGetTicketDetails(args: { ticketId: string }, ctx: ToolContext) {
  if (!canOrgUser(ctx, "helpdesk", "view")) {
    return { ok: false, message: "You don't have permission to view helpdesk tickets." };
  }
  const ticket = await findTicketByHumanId(args.ticketId, ctx.organizationId);
  if (!ticket) return { ok: false, message: `No ticket found with ID "${args.ticketId}".` };
  return { ok: true, ticket: ticketSummary(ticket.toObject() as unknown as Record<string, unknown>) };
}

export async function toolSearchTasks(
  args: { search?: string; status?: string; priority?: string; assignedToName?: string; page?: number; limit?: number },
  ctx: ToolContext
) {
  if (!canOrgUser(ctx, "tasks", "view")) {
    return { ok: false, message: "You don't have permission to view tasks." };
  }

  let assignedTo: string | undefined;
  if (args.assignedToName) {
    const matches = await resolveUsersByName(args.assignedToName, ctx.organizationId);
    if (matches.length === 0) return { ok: false, message: `No person matching "${args.assignedToName}" was found.` };
    if (matches.length > 1) {
      return {
        ok: false,
        message: `Multiple people match "${args.assignedToName}" - please specify which one: ${matches
          .map((m) => `${m.name} (${m.email})`)
          .join(", ")}`,
      };
    }
    assignedTo = matches[0].id;
  }

  const result = await listTasks(
    {
      search: args.search,
      status: args.status as TaskStatus | undefined,
      priority: args.priority as TaskPriority | undefined,
      assignedTo,
      page: args.page,
      limit: Math.min(args.limit ?? 20, 50),
    },
    ctx.organizationId,
    { id: ctx.userId, isAdmin: ctx.isAdmin, permissions: ctx.permissions }
  );

  return {
    ok: true,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    tasks: result.items.map((t) => taskSummary(t)),
  };
}

export async function toolGetTaskDetails(args: { taskId: string }, ctx: ToolContext) {
  if (!canOrgUser(ctx, "tasks", "view")) {
    return { ok: false, message: "You don't have permission to view tasks." };
  }
  const task = await findTaskByHumanId(args.taskId, ctx.organizationId);
  if (!task) return { ok: false, message: `No task found with ID "${args.taskId}".` };
  return { ok: true, task: taskSummary(task.toObject() as unknown as Record<string, unknown>) };
}

// ---------------------------------------------------------------------------------------------
// Write tools - never touch the database. Each one resolves what it needs, then creates a
// PendingAiChange and returns it for the frontend to render as a Confirm/Cancel card. The
// change is only actually applied by confirmPendingChange(), called from POST
// /ai-assistant/confirm - a real HTTP request the frontend only sends when the user clicks
// Confirm, never something the model itself can trigger mid-conversation.
// ---------------------------------------------------------------------------------------------

type ProposalResult = { ok: true; pendingChange: PendingAiChange } | { ok: false; message: string };

async function proposeStatusChange(
  args: { assetId: string; status: IAsset["status"]; assignedUserId?: string | null; extra?: Record<string, unknown> },
  action: string,
  summary: string,
  ctx: ToolContext
): Promise<ProposalResult> {
  if (!canOrgUser(ctx, "assets", "update")) {
    return { ok: false, message: "You don't have permission to update assets." };
  }
  const asset = await findAssetByHumanId(args.assetId, ctx.organizationId);
  if (!asset) return { ok: false, message: `No asset found with ID "${args.assetId}".` };

  const before = assetSummary(asset.toObject() as unknown as Record<string, unknown>);
  const newValue: Record<string, unknown> = { status: args.status, ...(args.extra ?? {}) };
  if (args.assignedUserId !== undefined) newValue.assignedUser = args.assignedUserId;

  const pendingChange = createPendingChange({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    assetId: asset.id,
    assetLabel: asset.assetId,
    action,
    oldValue: before,
    newValue,
    summary,
  });
  return { ok: true, pendingChange };
}

export async function toolAssignAsset(args: { assetId: string; employeeName: string }, ctx: ToolContext): Promise<ProposalResult> {
  const matches = await resolveUsersByName(args.employeeName, ctx.organizationId);
  if (matches.length === 0) return { ok: false, message: `No person matching "${args.employeeName}" was found.` };
  if (matches.length > 1) {
    return {
      ok: false,
      message: `Multiple people match "${args.employeeName}" - please specify which one: ${matches
        .map((m) => `${m.name} (${m.email})`)
        .join(", ")}`,
    };
  }
  const user = matches[0];
  return proposeStatusChange(
    { assetId: args.assetId, status: "Assigned", assignedUserId: user.id, extra: { employeeName: user.name, employeeId: user.employeeId ?? "" } },
    "AI_ASSIGN",
    `Assign to ${user.name}`,
    ctx
  );
}

export async function toolTransferAsset(args: { assetId: string; newEmployeeName: string }, ctx: ToolContext): Promise<ProposalResult> {
  const matches = await resolveUsersByName(args.newEmployeeName, ctx.organizationId);
  if (matches.length === 0) return { ok: false, message: `No person matching "${args.newEmployeeName}" was found.` };
  if (matches.length > 1) {
    return {
      ok: false,
      message: `Multiple people match "${args.newEmployeeName}" - please specify which one: ${matches
        .map((m) => `${m.name} (${m.email})`)
        .join(", ")}`,
    };
  }
  const user = matches[0];
  return proposeStatusChange(
    { assetId: args.assetId, status: "Assigned", assignedUserId: user.id, extra: { employeeName: user.name, employeeId: user.employeeId ?? "" } },
    "AI_TRANSFER",
    `Transfer to ${user.name}`,
    ctx
  );
}

export async function toolReturnAsset(args: { assetId: string }, ctx: ToolContext): Promise<ProposalResult> {
  return proposeStatusChange(
    { assetId: args.assetId, status: "Available", assignedUserId: null, extra: { employeeName: "", employeeId: "" } },
    "AI_RETURN",
    "Return to available pool (unassign)",
    ctx
  );
}

export async function toolMarkAssetDamaged(args: { assetId: string; notes?: string }, ctx: ToolContext): Promise<ProposalResult> {
  return proposeStatusChange(
    { assetId: args.assetId, status: "Damaged", extra: args.notes ? { conditionNotes: args.notes } : {} },
    "AI_MARK_DAMAGED",
    "Mark as damaged",
    ctx
  );
}

export async function toolMarkAssetLost(args: { assetId: string; notes?: string }, ctx: ToolContext): Promise<ProposalResult> {
  return proposeStatusChange(
    { assetId: args.assetId, status: "Lost", extra: args.notes ? { conditionNotes: args.notes } : {} },
    "AI_MARK_LOST",
    "Mark as lost",
    ctx
  );
}

export async function toolRetireAsset(args: { assetId: string; notes?: string }, ctx: ToolContext): Promise<ProposalResult> {
  return proposeStatusChange(
    { assetId: args.assetId, status: "Retired", extra: args.notes ? { notes: args.notes } : {} },
    "AI_RETIRE",
    "Retire this asset",
    ctx
  );
}

export async function toolCreateAssetProposal(
  args: { name: string; categoryName: string; assetType?: string; manufacturer?: string; model?: string },
  ctx: ToolContext
): Promise<ProposalResult> {
  if (!canOrgUser(ctx, "assets", "create")) {
    return { ok: false, message: "You don't have permission to create assets." };
  }
  const category = await resolveCategoryByName(args.categoryName, ctx.organizationId);
  if (!category) return { ok: false, message: `No asset category matching "${args.categoryName}" was found.` };

  const newValue: Record<string, unknown> = {
    name: args.name,
    category: category.id,
    assetType: args.assetType ?? "",
    manufacturer: args.manufacturer ?? "",
    model: args.model ?? "",
  };
  const pendingChange = createPendingChange({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    assetId: null,
    assetLabel: args.name,
    action: "AI_CREATE",
    oldValue: null,
    newValue,
    summary: `Create a new asset "${args.name}" (${category.name})`,
  });
  return { ok: true, pendingChange };
}

// ---------------------------------------------------------------------------------------------
// Applying a confirmed change - called only from POST /ai-assistant/confirm, never from the
// tool-calling loop itself.
// ---------------------------------------------------------------------------------------------

export async function applyPendingChange(change: PendingAiChange, ctx: ToolContext) {
  if (change.action === "AI_CREATE") {
    if (!canOrgUser(ctx, "assets", "create")) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
    const asset = await createAsset(change.newValue as never, ctx.userId, ctx.organizationId);
    return { assetId: asset.assetId, id: asset.id };
  }

  if (!canOrgUser(ctx, "assets", "update")) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  if (!change.assetId) throw Object.assign(new Error("Invalid pending change"), { statusCode: 400 });

  const before = await getAssetById(change.assetId, ctx.organizationId);
  const beforeSnapshot = { status: before.status, assignedUser: before.assignedUser };

  const asset = await updateAsset(change.assetId, change.newValue as never, ctx.organizationId);

  await recordAssetHistory({
    asset: asset.id,
    action: assetHistoryActionFor(change.action),
    user: ctx.userId,
    previousValue: beforeSnapshot,
    newValue: change.newValue,
    remarks: `Via AssetIQ AI: ${change.summary}`,
  });

  return { assetId: asset.assetId, id: asset.id };
}

function assetHistoryActionFor(aiAction: string): "Assigned" | "Reassigned" | "Transferred" | "Returned" | "Retired" | "Updated" {
  switch (aiAction) {
    case "AI_ASSIGN":
      return "Assigned";
    case "AI_TRANSFER":
      return "Transferred";
    case "AI_RETURN":
      return "Returned";
    case "AI_RETIRE":
      return "Retired";
    default:
      return "Updated";
  }
}

// ---------------------------------------------------------------------------------------------
// Tool definitions (JSON schema) + dispatcher, for the chat controller's tool-calling loop.
// ---------------------------------------------------------------------------------------------

export const TOOL_DEFINITIONS: OllamaTool[] = [
  {
    type: "function",
    function: {
      name: "search_assets",
      description:
        "Search/filter assets by status, department, location, category, assigned person, warranty status, or free text. Use this for any question about a group of assets (e.g. 'laptops in Finance', 'available assets', 'assets under warranty').",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Exact asset status, e.g. Assigned, Available, Under Repair, Damaged, Lost, Retired" },
          departmentName: { type: "string" },
          locationName: { type: "string" },
          categoryName: { type: "string", description: "e.g. Laptop, Desktop, Monitor" },
          assignedUserName: { type: "string" },
          search: { type: "string", description: "Free-text search across asset ID, name, serial number, employee name" },
          warrantyStatus: { type: "string", enum: ["active", "expired", "expiringSoon"] },
          page: { type: "number" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_asset_details",
      description: "Get complete details of one specific asset by its Asset ID (e.g. 'LAP-1025').",
      parameters: { type: "object", properties: { assetId: { type: "string" } }, required: ["assetId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_asset_history",
      description: "Get the full change history of one specific asset by its Asset ID.",
      parameters: { type: "object", properties: { assetId: { type: "string" } }, required: ["assetId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_asset",
      description: "Propose assigning an unassigned/available asset to a person. Does not apply the change - only proposes it for confirmation.",
      parameters: {
        type: "object",
        properties: { assetId: { type: "string" }, employeeName: { type: "string" } },
        required: ["assetId", "employeeName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_asset",
      description: "Propose transferring an already-assigned asset to a different person. Does not apply the change - only proposes it.",
      parameters: {
        type: "object",
        properties: { assetId: { type: "string" }, newEmployeeName: { type: "string" } },
        required: ["assetId", "newEmployeeName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "return_asset",
      description: "Propose returning an asset from its current holder back to the available pool (unassign it). Does not apply the change.",
      parameters: { type: "object", properties: { assetId: { type: "string" } }, required: ["assetId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_asset_damaged",
      description: "Propose marking an asset as damaged. Does not apply the change.",
      parameters: { type: "object", properties: { assetId: { type: "string" }, notes: { type: "string" } }, required: ["assetId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_asset_lost",
      description: "Propose marking an asset as lost. Does not apply the change.",
      parameters: { type: "object", properties: { assetId: { type: "string" }, notes: { type: "string" } }, required: ["assetId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "retire_asset",
      description: "Propose retiring an asset. Does not apply the change.",
      parameters: { type: "object", properties: { assetId: { type: "string" }, notes: { type: "string" } }, required: ["assetId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_asset",
      description: "Propose creating a brand-new asset record. Does not apply the change.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          categoryName: { type: "string" },
          assetType: { type: "string" },
          manufacturer: { type: "string" },
          model: { type: "string" },
        },
        required: ["name", "categoryName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_tickets",
      description:
        "Search/filter helpdesk tickets by status, category, or free text. Use this for any question about a group of tickets (e.g. 'open tickets', 'tickets in Hardware category').",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Free-text search across ticket ID and subject" },
          status: { type: "string", description: "e.g. New, Open, In Progress, Pending, Resolved, Closed, Reopened" },
          categoryName: { type: "string" },
          page: { type: "number" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ticket_details",
      description: "Get complete details of one specific helpdesk ticket by its Ticket ID (e.g. 'TCK-000017').",
      parameters: { type: "object", properties: { ticketId: { type: "string" } }, required: ["ticketId"] },
    },
  },
  {
    type: "function",
    function: {
      name: "search_tasks",
      description:
        "Search/filter tasks by status, priority, assigned person, or free text. Use this for any question about a group of tasks (e.g. 'tasks assigned to John', 'overdue tasks').",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Free-text search across task title" },
          status: { type: "string", enum: [...TASK_STATUSES] },
          priority: { type: "string", enum: [...TASK_PRIORITIES] },
          assignedToName: { type: "string" },
          page: { type: "number" },
          limit: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_task_details",
      description: "Get complete details of one specific task by its Task ID.",
      parameters: { type: "object", properties: { taskId: { type: "string" } }, required: ["taskId"] },
    },
  },
];

export async function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case "search_assets":
      return toolSearchAssets(args as never, ctx);
    case "get_asset_details":
      return toolGetAssetDetails(args as never, ctx);
    case "get_asset_history":
      return toolGetAssetHistory(args as never, ctx);
    case "assign_asset":
      return toolAssignAsset(args as never, ctx);
    case "transfer_asset":
      return toolTransferAsset(args as never, ctx);
    case "return_asset":
      return toolReturnAsset(args as never, ctx);
    case "mark_asset_damaged":
      return toolMarkAssetDamaged(args as never, ctx);
    case "mark_asset_lost":
      return toolMarkAssetLost(args as never, ctx);
    case "retire_asset":
      return toolRetireAsset(args as never, ctx);
    case "create_asset":
      return toolCreateAssetProposal(args as never, ctx);
    case "search_tickets":
      return toolSearchTickets(args as never, ctx);
    case "get_ticket_details":
      return toolGetTicketDetails(args as never, ctx);
    case "search_tasks":
      return toolSearchTasks(args as never, ctx);
    case "get_task_details":
      return toolGetTaskDetails(args as never, ctx);
    default:
      return { ok: false, message: `Unknown tool "${name}".` };
  }
}
