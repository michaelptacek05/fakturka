import sharp from "sharp";

import { MAX_INVOICE_ASSET_SIZE } from "@/lib/invoice-assets";

/** Dekódování ověří obsah i rozměry; překódování odstraní připojený obsah a metadata. */
export async function normalizeInvoiceAsset(data: Buffer, declaredMime: string) {
  if (!data.length || data.length > MAX_INVOICE_ASSET_SIZE) throw new Error("Neplatná velikost obrázku.");
  const input = sharp(data, { limitInputPixels: 16_000_000, failOn: "warning", animated: false });
  const metadata = await input.metadata();
  const expected = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp" }[declaredMime];
  if (!expected || metadata.format !== expected || (metadata.pages ?? 1) > 1) throw new Error("Obsah neodpovídá formátu obrázku.");
  const isJpeg = metadata.format === "jpeg";
  const normalized = await (isJpeg ? input.rotate().jpeg() : input.rotate().png()).toBuffer();
  if (normalized.length > 8 * 1024 * 1024) throw new Error("Dekódovaný obrázek je příliš velký.");
  return { data: normalized, mimeType: isJpeg ? "image/jpeg" : "image/png" };
}
