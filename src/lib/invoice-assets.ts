import fs from "node:fs/promises";
import path from "node:path";

import { InvoiceAssetType } from "@/generated/prisma/enums";

export const MAX_INVOICE_ASSET_SIZE = 2 * 1024 * 1024;
export const INVOICE_ASSET_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function getInvoiceAssetStorageRoot() {
  return path.join(process.cwd(), "storage", "invoice-assets");
}

export function getInvoiceAssetAbsolutePath(storagePath: string) {
  const relativeStoragePath = storagePath.replace(/^storage[\\/]/, "");
  const storageRoot = path.join(process.cwd(), "storage");
  const absolutePath = path.resolve(storageRoot, relativeStoragePath);

  // Cesty pochází z databáze, ale ven ze storage adresáře nikdy nesmí vést.
  if (
    absolutePath !== storageRoot &&
    !absolutePath.startsWith(`${storageRoot}${path.sep}`)
  ) {
    throw new Error("Cesta k souboru vede mimo adresář storage.");
  }

  return absolutePath;
}

export function getInvoiceAssetExtension(mimeType: string) {
  return MIME_EXTENSIONS[mimeType] ?? "bin";
}

export function isAllowedInvoiceAssetType(
  value: FormDataEntryValue | null,
): value is InvoiceAssetType {
  return (
    value === InvoiceAssetType.LOGO ||
    value === InvoiceAssetType.SIGNATURE ||
    value === InvoiceAssetType.STAMP
  );
}

export function getInvoiceAssetTypeLabel(type: InvoiceAssetType) {
  const labels: Record<InvoiceAssetType, string> = {
    [InvoiceAssetType.LOGO]: "Logo",
    [InvoiceAssetType.SIGNATURE]: "Podpis",
    [InvoiceAssetType.STAMP]: "Razítko",
  };

  return labels[type];
}

export async function removeStoredInvoiceAsset(storagePath: string | null | undefined) {
  if (!storagePath) {
    return;
  }

  try {
    await fs.unlink(getInvoiceAssetAbsolutePath(storagePath));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== "ENOENT") {
      throw error;
    }
  }
}
