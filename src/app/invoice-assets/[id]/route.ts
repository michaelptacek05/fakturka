import fs from "node:fs/promises";

import { notFound } from "next/navigation";
import { NextResponse } from "next/server";

import { getInvoiceAssetAbsolutePath } from "@/lib/invoice-assets";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InvoiceAssetRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: InvoiceAssetRouteProps) {
  const { id } = await params;
  const asset = await prisma.invoiceAsset.findUnique({
    where: { id },
  });

  if (!asset) {
    notFound();
  }

  try {
    const file = await fs.readFile(getInvoiceAssetAbsolutePath(asset.storagePath));
    const body = new ArrayBuffer(file.byteLength);
    new Uint8Array(body).set(file);

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(file.byteLength),
        "Content-Type": asset.mimeType,
      },
    });
  } catch {
    notFound();
  }
}
