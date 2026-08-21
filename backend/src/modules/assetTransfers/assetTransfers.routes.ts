import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { PERM } from "../../config/permissionCatalog";
import { AssetTransfer } from "../../models/AssetTransfer";

export const assetTransfersRouter = Router();

assetTransfersRouter.get(
  "/",
  authenticate,
  authorize(PERM.ASSETS_READ),
  asyncHandler(async (req, res) => {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const [items, total] = await Promise.all([
      AssetTransfer.find()
        .populate("asset", "assetId name")
        .populate("fromUser", "name email")
        .populate("toUser", "name email")
        .populate("fromLocation", "name")
        .populate("toLocation", "name")
        .populate("fromDepartment", "name")
        .populate("toDepartment", "name")
        .populate("approvedBy", "name email")
        .populate("performedBy", "name email")
        .sort({ createdDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AssetTransfer.countDocuments(),
    ]);

    ok(res, { items, total, page, limit, totalPages: Math.ceil(total / limit) }, "Asset transfers");
  })
);
