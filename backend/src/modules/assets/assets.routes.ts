import { Router } from "express";
import { authorize, requireAdmin, requireModuleEnabled } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadAssetDocument, uploadSpreadsheet } from "../../utils/upload";
import * as assetsController from "./assets.controller";
import * as assetsService from "./assets.service";
import * as assetDocumentsController from "./assetDocuments.controller";
import { previewAssetImport, confirmAssetImport, downloadAssetTemplate, getAssetImportHistory } from "./assets.import";
import { listAssetHistory } from "./assetHistory.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import {
  assetDocumentParamsSchema,
  assetIdParamsSchema,
  bulkDeleteAssetsSchema,
  confirmAssetImportSchema,
  createAssetSchema,
  listAssetsQuerySchema,
  updateAssetSchema,
  uploadAssetDocumentBodySchema,
} from "./assets.validation";
import { listImportHistoryQuerySchema } from "../importHistory/importHistory.validation";

export const assetsRouter = Router();

assetsRouter.get("/stats", authorize("assets", "view"), assetsController.getAssetStats);
// Always "mine", independent of the view-all permission /stats above ignores entirely - powers
// the Employee Portal dashboard's "My Assets" widget.
assetsRouter.get("/my-summary", authorize("assets", "view"), assetsController.getMyAssetSummary);

assetsRouter.post(
  "/import/preview",
  authorize("assets", "import"),
  uploadSpreadsheet.single("file"),
  previewAssetImport
);
assetsRouter.post(
  "/import/confirm",
  authorize("assets", "import"),
  validate({ body: confirmAssetImportSchema }),
  confirmAssetImport
);
assetsRouter.get("/import/template", authorize("assets", "import"), downloadAssetTemplate);
assetsRouter.get(
  "/import/history",
  authorize("assets", "import"),
  validate({ query: listImportHistoryQuerySchema }),
  getAssetImportHistory
);

assetsRouter.get(
  "/deleted",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
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
  requireModuleEnabled("recycleBin"),
  validate({ params: assetIdParamsSchema }),
  assetsController.restoreAsset
);
assetsRouter.delete(
  "/:id/purge",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
  validate({ params: assetIdParamsSchema }),
  assetsController.purgeAsset
);

assetsRouter.get(
  "/:id/documents",
  authorize("assets", "view"),
  requireModuleEnabled("fileUpload"),
  validate({ params: assetIdParamsSchema }),
  assetDocumentsController.listDocuments
);
assetsRouter.post(
  "/:id/documents",
  authorize("assets", "update"),
  requireModuleEnabled("fileUpload"),
  validate({ params: assetIdParamsSchema }),
  uploadAssetDocument.single("file"),
  validate({ body: uploadAssetDocumentBodySchema }),
  assetDocumentsController.uploadDocument
);
assetsRouter.get(
  "/:id/documents/:docId/download",
  authorize("assets", "view"),
  requireModuleEnabled("fileUpload"),
  validate({ params: assetDocumentParamsSchema }),
  assetDocumentsController.downloadDocument
);
assetsRouter.delete(
  "/:id/documents/:docId",
  authorize("assets", "update"),
  requireModuleEnabled("fileUpload"),
  validate({ params: assetDocumentParamsSchema }),
  assetDocumentsController.deleteDocument
);

assetsRouter.get(
  "/:id/history",
  authorize("assets", "view"),
  validate({ params: assetIdParamsSchema }),
  asyncHandler(async (req, res) => {
    await assetsService.getAssetByIdForRequester(req.params.id, req.organization!._id, {
      id: req.user!.id,
      isAdmin: req.user!.isAdmin,
      permissions: req.user!.permissions,
    });
    const history = await listAssetHistory(req.params.id);
    ok(res, history, "Asset history");
  })
);
