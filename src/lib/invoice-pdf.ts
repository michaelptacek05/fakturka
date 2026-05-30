import fs from "node:fs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import { VatPayerStatus } from "@/generated/prisma/enums";
import { formatCurrency, formatDate, numberFormatter } from "@/lib/format";
import {
  buildSpaydPayload,
  sanitizeSpaydPayload,
  validateBankProfile,
} from "@/lib/spayd";

type PdfInvoice = {
  client: {
    city: string;
    companyName: string | null;
    country: string;
    dic: string | null;
    fullName: string | null;
    ico: string | null;
    postalCode: string;
    street: string;
  };
  constantSymbol: string | null;
  currency: string;
  dueDate: Date;
  issueDate: Date;
  items: Array<{
    id: string;
    lineTotal: { toString(): string };
    name: string;
    quantity: { toString(): string };
    unit: string;
    unitPrice: { toString(): string };
    vatRate: { toString(): string };
  }>;
  notes: string | null;
  number: string;
  profile: {
    accountNumber: string;
    bankCode: string;
    city: string;
    companyName: string | null;
    country: string;
    dic: string | null;
    displayName: string;
    iban: string | null;
    ico: string;
    postalCode: string;
    registryText: string | null;
    street: string;
    swift: string | null;
    vatPayerStatus: VatPayerStatus;
  };
  specificSymbol: string | null;
  subtotal: { toString(): string };
  taxableSupplyDate: Date | null;
  total: { toString(): string };
  variableSymbol: string;
  vatTotal: { toString(): string };
};

const FONT_CANDIDATES = [
  "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
  "/Library/Fonts/Arial Unicode.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];

function resolveFont() {
  return FONT_CANDIDATES.find((path) => fs.existsSync(path)) ?? null;
}

function collectPdf(document: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    document.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
}

function writeLabel(document: PDFKit.PDFDocument, label: string, x: number, y: number) {
  document
    .fontSize(8)
    .fillColor("#71717a")
    .text(label.toUpperCase(), x, y, { continued: false });
}

function writeLines(
  document: PDFKit.PDFDocument,
  lines: Array<string | null | undefined>,
  x: number,
  y: number,
  options: PDFKit.Mixins.TextOptions = {},
) {
  let currentY = y;

  for (const line of lines.filter(Boolean)) {
    document.fillColor("#18181b").fontSize(9).text(line ?? "", x, currentY, options);
    currentY = document.y + 2;
  }

  return currentY;
}

function drawKeyValue(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
) {
  writeLabel(document, label, x, y);
  document.fontSize(10).fillColor("#18181b").text(value, x, y + 12);
}

function drawTotals(
  document: PDFKit.PDFDocument,
  invoice: PdfInvoice,
  x: number,
  y: number,
  fonts: { bold: string; regular: string },
) {
  const rows = [
    ["Mezisoučet", formatCurrency(invoice.subtotal)],
    ["DPH", formatCurrency(invoice.vatTotal)],
    ["Celkem k úhradě", formatCurrency(invoice.total)],
  ];

  rows.forEach(([label, value], index) => {
    const rowY = y + index * 24;

    if (index === rows.length - 1) {
      document.moveTo(x, rowY - 5).lineTo(545, rowY - 5).strokeColor("#18181b").stroke();
      document.fontSize(12);
    } else {
      document.fontSize(9);
    }

    document.fillColor("#18181b").text(label, x, rowY);
    document.font(fonts.bold).text(value, x + 120, rowY, {
      align: "right",
      width: 130,
    });
    document.font(fonts.regular);
  });
}

export async function renderInvoicePdf(invoice: PdfInvoice) {
  const fontPath = resolveFont();
  const document = new PDFDocument({
    font: fontPath ?? undefined,
    margin: 40,
    size: "A4",
  });

  if (fontPath) {
    document.registerFont("Regular", fontPath);
    document.registerFont("Bold", fontPath);
    document.font("Regular");
  } else {
    document.font("Helvetica");
  }
  const fonts = fontPath
    ? { bold: "Bold", regular: "Regular" }
    : { bold: "Helvetica-Bold", regular: "Helvetica" };

  const pdf = collectPdf(document);
  const supplierName = invoice.profile.companyName || invoice.profile.displayName;
  const clientName = invoice.client.companyName || invoice.client.fullName || "";
  const isVatPayer = invoice.profile.vatPayerStatus === VatPayerStatus.PAYER;
  const payment = validateBankProfile(invoice.profile);
  const spaydPayload = sanitizeSpaydPayload(buildSpaydPayload({
    accountNumber: invoice.profile.accountNumber,
    amount: invoice.total,
    bankCode: invoice.profile.bankCode,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    iban: invoice.profile.iban,
    message: `Faktura ${invoice.number}`,
    variableSymbol: invoice.variableSymbol,
  }));
  const qrBuffer = await QRCode.toBuffer(spaydPayload, {
    errorCorrectionLevel: "M",
    margin: 4,
    scale: 5,
    type: "png",
  });

  document
    .font(fonts.regular)
    .fillColor("#71717a")
    .fontSize(10)
    .text(isVatPayer ? "Faktura - daňový doklad" : "Faktura", 40, 40);
  document.font(fonts.bold).fillColor("#18181b").fontSize(26).text(invoice.number, 40, 58);
  writeLines(
    document,
    [supplierName, invoice.profile.street, `${invoice.profile.postalCode} ${invoice.profile.city}`, invoice.profile.country],
    360,
    42,
    { align: "right", width: 185 },
  );
  document.moveTo(40, 115).lineTo(555, 115).lineWidth(1.5).strokeColor("#18181b").stroke();

  writeLabel(document, "Dodavatel", 40, 135);
  writeLines(
    document,
    [
      supplierName,
      invoice.profile.street,
      `${invoice.profile.postalCode} ${invoice.profile.city}`,
      invoice.profile.country,
      `IČO: ${invoice.profile.ico}`,
      invoice.profile.dic ? `DIČ: ${invoice.profile.dic}` : null,
      invoice.profile.registryText,
    ],
    40,
    152,
    { width: 220 },
  );

  writeLabel(document, "Odběratel", 320, 135);
  writeLines(
    document,
    [
      clientName,
      invoice.client.street,
      `${invoice.client.postalCode} ${invoice.client.city}`,
      invoice.client.country,
      invoice.client.ico ? `IČO: ${invoice.client.ico}` : null,
      invoice.client.dic ? `DIČ: ${invoice.client.dic}` : null,
    ],
    320,
    152,
    { width: 220 },
  );

  document.moveTo(40, 260).lineTo(555, 260).lineWidth(0.7).strokeColor("#d4d4d8").stroke();
  drawKeyValue(document, "Datum vystavení", formatDate(invoice.issueDate), 40, 280);
  drawKeyValue(
    document,
    "DUZP",
    formatDate(invoice.taxableSupplyDate ?? invoice.issueDate),
    210,
    280,
  );
  drawKeyValue(document, "Datum splatnosti", formatDate(invoice.dueDate), 380, 280);
  drawKeyValue(document, "Variabilní symbol", invoice.variableSymbol, 40, 325);
  drawKeyValue(document, "Konstantní symbol", invoice.constantSymbol || "-", 210, 325);
  drawKeyValue(document, "Specifický symbol", invoice.specificSymbol || "-", 380, 325);

  const tableTop = 385;
  document.moveTo(40, tableTop).lineTo(555, tableTop).lineWidth(1).strokeColor("#18181b").stroke();
  document.font(fonts.bold).fontSize(9).fillColor("#18181b");
  document.text("Položka", 40, tableTop + 12, { width: 210 });
  document.text("Množství", 255, tableTop + 12, { align: "right", width: 70 });
  document.text("Cena / j.", 335, tableTop + 12, { align: "right", width: 75 });
  document.text("DPH", 420, tableTop + 12, { align: "right", width: 45 });
  document.text("Celkem", 475, tableTop + 12, { align: "right", width: 80 });
  document.moveTo(40, tableTop + 32).lineTo(555, tableTop + 32).strokeColor("#18181b").stroke();

  let rowY = tableTop + 45;
  document.font(fonts.regular).fontSize(9);
  invoice.items.forEach((item) => {
    document.fillColor("#18181b").text(item.name, 40, rowY, { width: 210 });
    document.text(`${numberFormatter.format(Number(item.quantity))} ${item.unit}`, 255, rowY, {
      align: "right",
      width: 70,
    });
    document.text(formatCurrency(item.unitPrice), 335, rowY, {
      align: "right",
      width: 75,
    });
    document.text(`${numberFormatter.format(Number(item.vatRate))} %`, 420, rowY, {
      align: "right",
      width: 45,
    });
    document.font(fonts.bold).text(formatCurrency(item.lineTotal), 475, rowY, {
      align: "right",
      width: 80,
    });
    document.font(fonts.regular);
    rowY += 25;
    document.moveTo(40, rowY - 8).lineTo(555, rowY - 8).strokeColor("#e4e4e7").stroke();
  });

  const footerTop = Math.max(rowY + 20, 590);
  document.moveTo(40, footerTop).lineTo(555, footerTop).strokeColor("#d4d4d8").stroke();
  writeLabel(document, "Platební údaje", 40, footerTop + 20);
  writeLines(
    document,
    [
      `Číslo účtu: ${invoice.profile.accountNumber}/${invoice.profile.bankCode}`,
      `IBAN v QR: ${payment.paymentIban}`,
      invoice.profile.swift ? `SWIFT: ${invoice.profile.swift}` : null,
      `Variabilní symbol: ${invoice.variableSymbol}`,
    ],
    40,
    footerTop + 38,
    { width: 220 },
  );
  document.image(qrBuffer, 40, footerTop + 120, { width: 105 });
  document.fontSize(4.5).fillColor("#71717a").text(spaydPayload, 155, footerTop + 125, {
    lineBreak: false,
    width: 380,
  });

  drawTotals(document, invoice, 295, footerTop + 35, fonts);

  if (invoice.notes) {
    document.fontSize(9).fillColor("#52525b").text(invoice.notes, 40, 790, {
      width: 515,
    });
  }

  document.end();

  return pdf;
}
