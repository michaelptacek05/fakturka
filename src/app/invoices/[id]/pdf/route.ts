import { notFound } from "next/navigation";
import { NextResponse } from "next/server";

import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InvoicePdfRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: InvoicePdfRouteProps) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    include: {
      client: true,
      items: {
        orderBy: { position: "asc" },
      },
      profile: true,
    },
    where: { id },
  });

  if (!invoice) {
    notFound();
  }

  const pdf = await renderInvoicePdf(invoice);
  const filename = `faktura-${invoice.number}.pdf`;
  const body = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(body).set(pdf);

  return new NextResponse(body, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
      "Content-Type": "application/pdf",
    },
  });
}
