import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { PERM } from "../../config/permissionCatalog";
import { AssetAssignment } from "../../models/AssetAssignment";

export const assetAssignmentsRouter = Router();

assetAssignmentsRouter.get(
  "/",
  authenticate,
  authorize(PERM.ASSETS_READ),
  asyncHandler(async (req, res) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const filter: Record<string, unknown> = {};
    if (req.query.active === "true") filter.returnedDate = null;
    if (req.query.active === "false") filter.returnedDate = { $ne: null };

    const [items, total] = await Promise.all([
      AssetAssignment.find(filter)
        .populate("asset", "assetId name")
        .populate("assignedTo", "name email")
        .populate("department", "name")
        .populate("location", "name")
        .populate("assignedBy", "name email")
        .sort({ createdDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AssetAssignment.countDocuments(filter),
    ]);

    ok(res, { items, total, page, limit, totalPages: Math.ceil(total / limit) }, "Asset assignments");
  })
);
