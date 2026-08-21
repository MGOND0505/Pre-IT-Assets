import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { PERM } from "../../config/permissionCatalog";
import { uploadAssetDocument } from "../../utils/upload";
import * as assetsController from "./assets.controller";
import * as assetDocumentsController from "./assetDocuments.controller";
import * as assetWorkflowController from "./assetWorkflow.controller";
import {
  assetDocumentParamsSchema,
  assetIdParamsSchema,
  createAssetSchema,
  listAssetsQuerySchema,
  updateAssetSchema,
  uploadAssetDocumentBodySchema,
} from "./assets.validation";
import {
  assignAssetSchema,
  returnAssetSchema,
  retireAssetSchema,
  transferAssetSchema,
} from "./assetWorkflow.validation";

export const assetsRouter = Router();

assetsRouter.use(authenticate);

assetsRouter.get("/", authorize(PERM.ASSETS_READ), validate({ query: listAssetsQuerySchema }), assetsController.listAssets);
assetsRouter.post(
  "/",
  authorize(PERM.ASSETS_CREATE),
  validate({ body: createAssetSchema }),
  assetsController.createAsset
);
assetsRouter.get(
  "/:id",
  authorize(PERM.ASSETS_READ),
  validate({ params: assetIdParamsSchema }),
  assetsController.getAsset
);
assetsRouter.put(
  "/:id",
  authorize(PERM.ASSETS_WRITE),
  validate({ params: assetIdParamsSchema, body: updateAssetSchema }),
  assetsController.updateAsset
);
assetsRouter.delete(
  "/:id",
  authorize(PERM.ASSETS_DELETE),
  validate({ params: assetIdParamsSchema }),
  assetsController.deleteAsset
);

assetsRouter.get(
  "/:id/documents",
  authorize(PERM.ASSETS_READ),
  validate({ params: assetIdParamsSchema }),
  assetDocumentsController.listDocuments
);
assetsRouter.post(
  "/:id/documents",
  authorize(PERM.ASSETS_WRITE),
  validate({ params: assetIdParamsSchema }),
  uploadAssetDocument.single("file"),
  validate({ body: uploadAssetDocumentBodySchema }),
  assetDocumentsController.uploadDocument
);
assetsRouter.get(
  "/:id/documents/:docId/download",
  authorize(PERM.ASSETS_READ),
  validate({ params: assetDocumentParamsSchema }),
  assetDocumentsController.downloadDocument
);
assetsRouter.delete(
  "/:id/documents/:docId",
  authorize(PERM.ASSETS_WRITE),
  validate({ params: assetDocumentParamsSchema }),
  assetDocumentsController.deleteDocument
);

assetsRouter.get(
  "/:id/history",
  authorize(PERM.ASSETS_READ),
  validate({ params: assetIdParamsSchema }),
  assetWorkflowController.getAssetHistory
);
assetsRouter.post(
  "/:id/assign",
  authorize(PERM.ASSETS_ASSIGN),
  validate({ params: assetIdParamsSchema, body: assignAssetSchema }),
  assetWorkflowController.assignAsset
);
assetsRouter.post(
  "/:id/transfer",
  authorize(PERM.ASSETS_TRANSFER),
  validate({ params: assetIdParamsSchema, body: transferAssetSchema }),
  assetWorkflowController.transferAsset
);
assetsRouter.post(
  "/:id/return",
  authorize(PERM.ASSETS_ASSIGN),
  validate({ params: assetIdParamsSchema, body: returnAssetSchema }),
  assetWorkflowController.returnAsset
);
assetsRouter.post(
  "/:id/retire",
  authorize(PERM.ASSETS_RETIRE),
  validate({ params: assetIdParamsSchema, body: retireAssetSchema }),
  assetWorkflowController.retireAsset
);
