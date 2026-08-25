import { SupportTeam, type ISupportTeam, type SupportTier } from "../../models/SupportTeam";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";

const POPULATE_FIELDS = [
  { path: "categories", select: "name" },
  { path: "departments", select: "name" },
  { path: "locations", select: "name" },
  { path: "members.user", select: "name email status" },
];

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  tier?: SupportTier;
  status?: "Active" | "Inactive";
  includeDeleted?: boolean;
};

export async function listSupportTeams(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.tier) filter.tier = input.tier;
  if (input.status) filter.status = input.status;
  if (input.search) filter.name = { $regex: input.search, $options: "i" };

  const [items, total] = await Promise.all([
    SupportTeam.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ tier: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    SupportTeam.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getSupportTeamById(id: string, organizationId: string) {
  const team = await SupportTeam.findOne({ organization: organizationId, _id: id, isDeleted: false }).populate(
    POPULATE_FIELDS
  );
  if (!team) throw new ApiError(404, "Support team not found");
  return team;
}

async function assertUnique(organizationId: string, name?: string, excludeId?: string) {
  if (!name) return;
  const existing = await SupportTeam.findOne({ organization: organizationId, name, isDeleted: false, _id: { $ne: excludeId } });
  if (existing) throw new ApiError(409, "A support team with this name already exists");
}

type TeamInput = {
  name: string;
  tier: SupportTier;
  categories?: string[];
  departments?: string[];
  locations?: string[];
  members?: { user: string; isActive?: boolean }[];
};

export async function createSupportTeam(input: TeamInput, organizationId: string) {
  await assertUnique(organizationId, input.name);
  const team = await SupportTeam.create({
    organization: organizationId,
    name: input.name,
    tier: input.tier,
    categories: input.categories ?? [],
    departments: input.departments ?? [],
    locations: input.locations ?? [],
    members: (input.members ?? []).map((m) => ({ user: m.user, isActive: m.isActive ?? true })),
  });
  return getSupportTeamById(team.id, organizationId);
}

export async function updateSupportTeam(
  id: string,
  input: Partial<TeamInput> & { status?: "Active" | "Inactive" },
  organizationId: string
) {
  const team = await getSupportTeamById(id, organizationId);
  await assertUnique(organizationId, input.name, id);

  if (input.name !== undefined) team.name = input.name;
  if (input.tier !== undefined) team.tier = input.tier;
  if (input.categories !== undefined) team.categories = input.categories as never;
  if (input.departments !== undefined) team.departments = input.departments as never;
  if (input.locations !== undefined) team.locations = input.locations as never;
  if (input.members !== undefined) {
    team.members = input.members.map((m) => ({ user: m.user, isActive: m.isActive ?? true })) as never;
    // Membership changed shape - the round-robin cursor no longer reliably points at "the next
    // person after whoever went last," so reset it rather than risk skipping/repeating agents.
    team.roundRobinCursor = 0;
  }
  if (input.status !== undefined) team.status = input.status;

  await team.save();
  return getSupportTeamById(id, organizationId);
}

export async function deleteSupportTeam(id: string, deletedBy: string, organizationId: string) {
  const team = await getSupportTeamById(id, organizationId);
  team.isDeleted = true;
  team.deletedAt = new Date();
  team.deletedBy = deletedBy as unknown as ISupportTeam["deletedBy"];
  await team.save();
  return team;
}

export async function restoreSupportTeam(id: string, organizationId: string) {
  const team = await SupportTeam.findOne({ organization: organizationId, _id: id, isDeleted: true });
  if (!team) throw new ApiError(404, "Deleted support team not found");
  await assertUnique(organizationId, team.name, id);

  team.isDeleted = false;
  team.deletedAt = null;
  team.deletedBy = null;
  await team.save();
  return getSupportTeamById(id, organizationId);
}
