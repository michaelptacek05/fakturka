import { NextResponse } from "next/server";

import { InvoiceStatus } from "@/generated/prisma/enums";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const statusLabels: Record<InvoiceStatus, string> = {
  [InvoiceStatus.CANCELLED]: "Stornováno",
  [InvoiceStatus.DRAFT]: "Koncept",
  [InvoiceStatus.ISSUED]: "Vystaveno",
  [InvoiceStatus.OVERDUE]: "Po splatnosti",
  [InvoiceStatus.PAID]: "Zaplaceno",
};

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function getInvoiceIds(request: Request) {
  const url = new URL(request.url);
  const ids = url.searchParams
    .getAll("ids")
    .flatMap((value) => value.split(","))
    .map((id) => id.trim())
    .filter(Boolean);

  return Array.from(new Set(ids));
}

export async function GET(request: Request) {
  const invoiceIds = getInvoiceIds(request);

  if (invoiceIds.length === 0) {
    return NextResponse.json(
      { error: "Vyberte alespoň jednu fakturu k exportu." },
      { status: 400 },
    );
  }

  let invoices;

  try {
    invoices = await prisma.invoice.findMany({
      include: {
        client: true,
      },
      orderBy: { issueDate: "desc" },
      where: {
        id: { in: invoiceIds },
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Export se nepodařilo připravit, protože databáze není dostupná." },
      { status: 500 },
    );
  }

  const rows = [
    [
      "Číslo",
      "Odběratel",
      "IČO odběratele",
      "DIČ odběratele",
      "Datum vystavení",
      "Datum splatnosti",
      "Stav",
      "Měna",
      "Mezisoučet",
      "DPH",
      "Celkem",
      "Variabilní symbol",
    ],
    ...invoices.map((invoice) => [
      invoice.number,
      invoice.client.companyName ?? invoice.client.fullName ?? "",
      invoice.client.ico ?? "",
      invoice.client.dic ?? "",
      formatDate(invoice.issueDate),
      formatDate(invoice.dueDate),
      statusLabels[invoice.status],
      invoice.currency,
      invoice.subtotal.toString(),
      invoice.vatTotal.toString(),
      invoice.total.toString(),
      invoice.variableSymbol,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
  const body = `\uFEFF${csv}\n`;
  const timestamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    headers: {
      "Content-Disposition": `attachment; filename="faktury-${timestamp}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
