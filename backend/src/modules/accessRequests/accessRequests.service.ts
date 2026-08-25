import { Types } from "mongoose";
import { AccessRequest } from "../../models/AccessRequest";
import { Organization } from "../../models/Organization";
import { ApiError } from "../../utils/ApiError";
import { emptyPermissions, type PermissionsShape } from "../../config/permissions";
import { upsertOrgAccessGrant } from "../subSuperAdmins/subSuperAdmins.service";

const POPULATE = [
  { path: "subSuperAdmin", select: "name email" },
  { path: "organization", select: "name slug" },
  { path: "decidedBy", select: "name email" },
];

type CreateInput = {
  organization: string;
  requestedPermissions: Partial<PermissionsShape>;
  reason?: string;
};

export async function createAccessRequest(subSuperAdminId: string, input: CreateInput) {
  const org = await Organization.findOne({ _id: input.organization, isDeleted: false });
  if (!org) throw new ApiError(404, "Organization not found");

  const existingPending = await AccessRequest.findOne({
    subSuperAdmin: subSuperAdminId,
    organization: input.organization,
    status: "Pending",
  });
  if (existingPending) {
    throw new ApiError(409, "You already have a pending request for this organization");
  }

  return AccessRequest.create({
    subSuperAdmin: subSuperAdminId,
    organization: input.organization,
    requestedPermissions: { ...emptyPermissions(), ...input.requestedPermissions },
    reason: input.reason ?? "",
  });
}

export async function listAllAccessRequests() {
  return AccessRequest.find().populate(POPULATE).sort({ createdDate: -1 });
}

export async function listMyAccessRequests(subSuperAdminId: string) {
  return AccessRequest.find({ subSuperAdmin: subSuperAdminId }).populate(POPULATE).sort({ createdDate: -1 });
}

/** name/slug only, no stats - lets a Sub-Super Admin browse every org to request access to,
 * distinct from /api/my-organizations which only ever returns orgs they ALREADY hold a grant for. */
export async function listBrowsableOrganizations() {
  return Organization.find({ status: "Active", isDeleted: false }).select("name slug").sort({ name: 1 });
}

export async function decideAccessRequest(id: string, decision: "Approved" | "Denied", decidedBy: string) {
  const request = await AccessRequest.findById(id);
  if (!request) throw new ApiError(404, "Access request not found");
  if (request.status !== "Pending") {
    throw new ApiError(409, "This request has already been decided");
  }

  const organizationId = String(request.organization);

  if (decision === "Approved") {
    await upsertOrgAccessGrant(String(request.subSuperAdmin), organizationId, request.requestedPermissions);
  }

  request.status = decision;
  request.decidedBy = new Types.ObjectId(decidedBy);
  request.decidedAt = new Date();
  await request.save();

  return { request: await AccessRequest.findById(id).populate(POPULATE), organizationId };
}
