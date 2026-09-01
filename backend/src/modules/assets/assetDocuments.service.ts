import fs from "node:fs/promises";
import path from "node:path";
import { AssetDocument, type AssetDocumentType } from "../../models/AssetDocument";
import { ApiError } from "../../utils/ApiError";
import { ASSET_DOCUMENTS_DIR } from "../../utils/upload";

export async function listAssetDocuments(assetId: string, organizationId: string) {
  return AssetDocument.find({ asset: assetId, organization: organizationId }).sort({ createdDate: -1 });
}

export async function createAssetDocument(input: {
  asset: string;
  organization: string;
  type: AssetDocumentType;
  originalName: string;
  storedFileName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
}) {
  return AssetDocument.create(input);
}

export async function getAssetDocument(assetId: string, docId: string, organizationId: string) {
  const doc = await AssetDocument.findOne({ _id: docId, asset: assetId, organization: organizationId });
  if (!doc) throw new ApiError(404, "Document not found");
  return doc;
}

export async function deleteAssetDocument(assetId: string, docId: string, organizationId: string) {
  const doc = await getAssetDocument(assetId, docId, organizationId);
  await fs.unlink(path.join(ASSET_DOCUMENTS_DIR, doc.storedFileName)).catch(() => {
    /* file already gone - fine */
  });
  await doc.deleteOne();
  return doc;
}
