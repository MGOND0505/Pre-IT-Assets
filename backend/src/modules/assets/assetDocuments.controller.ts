import type { Request, Response } from "express";
import path from "node:path";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok, fail } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { ASSET_DOCUMENTS_DIR } from "../../utils/upload";
import { logAction } from "../audit/audit.service";
import * as assetsService from "./assets.service";
import * as assetDocumentsService from "./assetDocuments.service";

function requestingUserFrom(req: Request) {
  return { id: req.user!.id, isAdmin: req.user!.isAdmin, permissions: req.user!.permissions };
}

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  await assetsService.getAssetByIdForRequester(req.params.id, req.organization!._id, requestingUserFrom(req));
  const documents = await assetDocumentsService.listAssetDocuments(req.params.id);
  ok(res, documents, "Documents");
});

export const uploadDocument = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, "No file uploaded");
  }
  await assetsService.getAssetByIdForRequester(req.params.id, req.organization!._id, requestingUserFrom(req));

  const doc = await assetDocumentsService.createAssetDocument({
    asset: req.params.id,
    type: req.body.type ?? "Other",
    originalName: req.file.originalname,
    storedFileName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedBy: req.user!.id,
  });

  await logAction({
    req,
    action: "UPLOAD_DOCUMENT",
    module: "Asset",
    recordId: req.params.id,
    recordLabel: doc.originalName,
  });

  ok(res, doc, "Document uploaded", 201);
});

export const downloadDocument = asyncHandler(async (req: Request, res: Response) => {
  await assetsService.getAssetByIdForRequester(req.params.id, req.organization!._id, requestingUserFrom(req));
  const doc = await assetDocumentsService.getAssetDocument(req.params.id, req.params.docId);
  const filePath = path.join(ASSET_DOCUMENTS_DIR, doc.storedFileName);
  res.download(filePath, doc.originalName, (err) => {
    if (err) fail(res, "Could not download file", 404);
  });
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  await assetsService.getAssetByIdForRequester(req.params.id, req.organization!._id, requestingUserFrom(req));
  const doc = await assetDocumentsService.deleteAssetDocument(req.params.id, req.params.docId);

  await logAction({
    req,
    action: "DELETE_DOCUMENT",
    module: "Asset",
    recordId: req.params.id,
    recordLabel: doc.originalName,
  });

  ok(res, null, "Document deleted");
});
