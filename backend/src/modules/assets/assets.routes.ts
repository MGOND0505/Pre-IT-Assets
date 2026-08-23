import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadAssetDocument, uploadSpreadsheet } from "../../utils/upload";
import * as assetsController from "./assets.controller";
import * as assetDocumentsController from "./assetDocuments.controller";
import { previewAssetImport, confirmAssetImport } from "./assets.import";
import { listAssetHistory } from "./assetHistory.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import {
  assetDocumentParamsSchema,
  assetIdParamsSchema,
  createAssetSchema,
  listAssetsQuerySchema,
  updateAssetSchema,
  uploadAssetDocumentBodySchema,
} from "./assets.validation";

export const assetsRouter = Router();

assetsRouter.use(authenticate);

assetsRouter.get("/stats", authorize("assets", "read"), assetsController.getAssetStats);

assetsRouter.post(
  "/import/preview",
  authorize("assets", "add"),
  uploadSpreadsheet.single("file"),
  previewAssetImport
);
assetsRouter.post("/import/confirm", authorize("assets", "add"), confirmAssetImport);

assetsRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listAssetsQuerySchema }),
  assetsController.listDeletedAssets
);

assetsRouter.get(
  "/",
  authorize("assets", "read"),
  validate({ query: listAssetsQuerySchema }),
  assetsController.listAssets
);
assetsRouter.post(
  "/",
  authorize("assets", "add"),
  validate({ body: createAssetSchema }),
  assetsController.createAsset
);
assetsRouter.get(
  "/:id",
  authorize("assets", "read"),
  validate({ params: assetIdParamsSchema }),
  assetsController.getAsset
);
assetsRouter.put(
  "/:id",
  authorize("assets", "edit"),
  validate({ params: assetIdParamsSchema, body: updateAssetSchema }),
  assetsController.updateAsset
);
assetsRouter.delete(
  "/:id",
  authorize("assets", "delete"),
  validate({ params: assetIdParamsSchema }),
  assetsController.deleteAsset
);
assetsRouter.post(
  "/:id/restore",
  requireAdmin,
  validate({ params: assetIdParamsSchema }),
  assetsController.restoreAsset
);
assetsRouter.delete(
  "/:id/purge",
  requireAdmin,
  validate({ params: assetIdParamsSchema }),
  assetsController.purgeAsset
);

assetsRouter.get(
  "/:id/documents",
  authorize("assets", "read"),
  validate({ params: assetIdParamsSchema }),
  assetDocumentsController.listDocuments
);
assetsRouter.post(
  "/:id/documents",
  authorize("assets", "edit"),
  validate({ params: assetIdParamsSchema }),
  uploadAssetDocument.single("file"),
  validate({ body: uploadAssetDocumentBodySchema }),
  assetDocumentsController.uploadDocument
);
assetsRouter.get(
  "/:id/documents/:docId/download",
  authorize("assets", "read"),
  validate({ params: assetDocumentParamsSchema }),
  assetDocumentsController.downloadDocument
);
assetsRouter.delete(
  "/:id/documents/:docId",
  authorize("assets", "edit"),
  validate({ params: assetDocumentParamsSchema }),
  assetDocumentsController.deleteDocument
);

assetsRouter.get(
  "/:id/history",
  authorize("assets", "read"),
  validate({ params: assetIdParamsSchema }),
  asyncHandler(async (req, res) => {
    const history = await listAssetHistory(req.params.id);
    ok(res, history, "Asset history");
  })
);
