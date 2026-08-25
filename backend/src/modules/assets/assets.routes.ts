import { Router } from "express";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadAssetDocument, uploadSpreadsheet } from "../../utils/upload";
import * as assetsController from "./assets.controller";
import * as assetsService from "./assets.service";
import * as assetDocumentsController from "./assetDocuments.controller";
import { previewAssetImport, confirmAssetImport, downloadAssetTemplate } from "./assets.import";
import { listAssetHistory } from "./assetHistory.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import {
  assetDocumentParamsSchema,
  assetIdParamsSchema,
  bulkDeleteAssetsSchema,
  createAssetSchema,
  listAssetsQuerySchema,
  updateAssetSchema,
  uploadAssetDocumentBodySchema,
} from "./assets.validation";

export const assetsRouter = Router();

assetsRouter.get("/stats", authorize("assets", "view"), assetsController.getAssetStats);

assetsRouter.post(
  "/import/preview",
  authorize("assets", "import"),
  uploadSpreadsheet.single("file"),
  previewAssetImport
);
assetsRouter.post("/import/confirm", authorize("assets", "import"), confirmAssetImport);
assetsRouter.get("/import/template", authorize("assets", "import"), downloadAssetTemplate);

assetsRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listAssetsQuerySchema }),
  assetsController.listDeletedAssets
);

// Bulk delete (multi-select on the list page) is Admin-only, deliberately stricter than
// the single-asset delete permission - a mass action warrants a higher bar.
assetsRouter.post(
  "/bulk-delete",
  requireAdmin,
  validate({ body: bulkDeleteAssetsSchema }),
  assetsController.bulkDeleteAssets
);

assetsRouter.get(
  "/",
  authorize("assets", "view"),
  validate({ query: listAssetsQuerySchema }),
  assetsController.listAssets
);
assetsRouter.post(
  "/",
  authorize("assets", "create"),
  validate({ body: createAssetSchema }),
  assetsController.createAsset
);
assetsRouter.get(
  "/:id",
  authorize("assets", "view"),
  validate({ params: assetIdParamsSchema }),
  assetsController.getAsset
);
assetsRouter.put(
  "/:id",
  authorize("assets", "update"),
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
  authorize("assets", "view"),
  validate({ params: assetIdParamsSchema }),
  assetDocumentsController.listDocuments
);
assetsRouter.post(
  "/:id/documents",
  authorize("assets", "update"),
  validate({ params: assetIdParamsSchema }),
  uploadAssetDocument.single("file"),
  validate({ body: uploadAssetDocumentBodySchema }),
  assetDocumentsController.uploadDocument
);
assetsRouter.get(
  "/:id/documents/:docId/download",
  authorize("assets", "view"),
  validate({ params: assetDocumentParamsSchema }),
  assetDocumentsController.downloadDocument
);
assetsRouter.delete(
  "/:id/documents/:docId",
  authorize("assets", "update"),
  validate({ params: assetDocumentParamsSchema }),
  assetDocumentsController.deleteDocument
);

assetsRouter.get(
  "/:id/history",
  authorize("assets", "view"),
  validate({ params: assetIdParamsSchema }),
  asyncHandler(async (req, res) => {
    await assetsService.getAssetById(req.params.id, req.organization!._id);
    const history = await listAssetHistory(req.params.id);
    ok(res, history, "Asset history");
  })
);
