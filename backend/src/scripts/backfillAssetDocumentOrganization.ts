import mongoose from "mongoose";
import { env } from "../config/env";
import { Asset } from "../models/Asset";
import { AssetDocument } from "../models/AssetDocument";

/** One-off, idempotent migration: `organization` is new on AssetDocument, so every document
 * uploaded before this field existed has none. Backfill each from its parent Asset's own
 * organization. Safe to re-run - only touches documents where the field is still unset. */
async function run() {
  await mongoose.connect(env.MONGODB_URI);

  const docs = await AssetDocument.find({ organization: { $exists: false } }).select("_id asset");
  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const asset = await Asset.findById(doc.asset).select("organization");
    if (!asset) {
      skipped += 1;
      continue;
    }
    await AssetDocument.updateOne({ _id: doc._id }, { organization: asset.organization });
    updated += 1;
  }

  console.log(`Done. Backfilled organization for ${updated} asset document(s), skipped ${skipped} (parent asset not found).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
