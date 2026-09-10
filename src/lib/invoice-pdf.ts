import fs from "node:fs";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import { InvoiceAssetType, VatPayerStatus } from "@/generated/prisma/enums";
import { formatCurrency, formatDate, numberFormatter } from "@/lib/format";
import { getInvoiceAssetAbsolutePath } from "@/lib/invoice-assets";
import { fromCents, getPaymentSummary } from "@/lib/invoice-payment";
import {
  buildSpaydPayload,
  sanitizeSpaydPayload,
  validateBankProfile,
} from "@/lib/spayd";

type PdfInvoice = {
  // Údaje odběratele jsou zamrzlé na faktuře, ne načtené z adresáře.
  clientCity: string;
  clientCountry: string;
  clientDic: string | null;
  clientIco: string | null;
  clientName: string;
  clientPostalCode: string;
  clientStreet: string;
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
  /** Součet evidovaných plateb. Rozhoduje o QR i o řádcích v součtu. */
  paidAmount: { toString(): string };
  profile: {
    accountNumber: string;
    assets: Array<{
      id: string;
      mimeType: string;
      storagePath: string;
      type: InvoiceAssetType;
    }>;
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

/** Vodorovné hranice sazby — A4 s okrajem 40 bodů. */
const CONTENT_LEFT = 40;
const CONTENT_RIGHT = 555;
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;

/**
 * Patička je dvousloupcová: vlevo platební údaje s QR kódem, vpravo součty
 * a pod nimi podpis s razítkem. Sloupce se vodorovně nedotýkají, takže se
 * QR a podpis nemůžou potkat, ať je v patičce cokoliv.
 */
const FOOTER_LEFT_WIDTH = 240;
const FOOTER_RIGHT_X = 295;
/** Šířka textu v levém sloupci — o kus užší, aby k QR zbyl vzduch. */
const FOOTER_TEXT_WIDTH = 220;
/** Odsazení popisku (8 bodů) od obsahu, který pod ním začíná. */
const LABEL_OFFSET = 18;
/** Popisek nad podpisem a razítkem sedí těsněji než nad textovým blokem. */
const ASSET_LABEL_OFFSET = 12;
const ITEM_ROW_HEIGHT = 25;
const QR_SIZE = 105;
const SIGNATURE_FIT: [number, number] = [130, 60];
const SPAYD_FONT_SIZE = 4.5;
const STAMP_FIT: [number, number] = [95, 75];
const STAMP_X = 445;
const TOTALS_ROW_HEIGHT = 24;
/** Kam patička sedne u krátké faktury, aby stránka nebyla nahoře přeplácaná. */
const PREFERRED_FOOTER_TOP = 590;
/**
 * Rezerva nad spodním okrajem. PDFKit zalomí stránku sám, jakmile se řádek
 * dotkne okraje, a rozdělil by tím patičku — tenhle polštář tomu předejde
 * i při drobné odchylce měření od skutečné sazby.
 */
const FOOTER_BOTTOM_GAP = 6;
/** Odstup poznámky od nejnižšího prvku patičky. */
const NOTES_GAP = 12;
const PAID_WITHOUT_QR_TEXT = "Faktura je uhrazená, QR platba se proto netiskne.";

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

/**
 * Řádky součtu. Skládají se na jednom místě, protože je potřebuje jak měření
 * patičky, tak samotné kreslení — jinak by se počet řádků mohl rozejít.
 */
function getTotalsRows(invoice: PdfInvoice) {
  const summary = getPaymentSummary(invoice);
  const rows = [
    ["Mezisoučet", formatCurrency(invoice.subtotal)],
    ["DPH", formatCurrency(invoice.vatTotal)],
    ["Celkem k úhradě", formatCurrency(invoice.total)],
  ];

  // U částečné úhrady musí být na dokladu vidět doplatek, ne jen celková částka.
  if (summary.isPartiallyPaid) {
    rows.push(
      ["Uhrazeno", formatCurrency(fromCents(summary.paidCents))],
      ["Zbývá k úhradě", formatCurrency(fromCents(summary.remainingCents))],
    );
  }

  return rows;
}

/** Výška bloku součtů. Poslední řádek je větší, sází se dvanáctkou. */
function getTotalsHeight(rowCount: number) {
  return (rowCount - 1) * TOTALS_ROW_HEIGHT + 16;
}

function drawTotals(
  document: PDFKit.PDFDocument,
  rows: string[][],
  x: number,
  y: number,
  fonts: { bold: string; regular: string },
) {
  rows.forEach(([label, value], index) => {
    const rowY = y + index * TOTALS_ROW_HEIGHT;

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

function getPdfImagePath(
  assets: PdfInvoice["profile"]["assets"],
  type: InvoiceAssetType,
) {
  const asset = assets.find((item) => item.type === type);

  if (!asset || !["image/jpeg", "image/png"].includes(asset.mimeType)) {
    return null;
  }

  const assetPath = getInvoiceAssetAbsolutePath(asset.storagePath);

  return fs.existsSync(assetPath) ? assetPath : null;
}

function drawImageIfAvailable(
  document: PDFKit.PDFDocument,
  imagePath: string | null,
  x: number,
  y: number,
  options: PDFKit.Mixins.ImageOption,
) {
  if (!imagePath) {
    return false;
  }

  try {
    document.image(imagePath, x, y, options);
    return true;
  } catch {
    return false;
  }
}

/** Poslední řádka, na kterou se ještě smí kreslit. */
function getContentBottom(document: PDFKit.PDFDocument) {
  return document.page.height - document.page.margins.bottom;
}

/**
 * SPAYD payload má proměnnou délku (zpráva pro příjemce může mít až 60 znaků)
 * a nemá kde se zlomit. Písmo se proto přizpůsobí, aby se vešel do sloupce.
 */
function getSpaydFontSize(document: PDFKit.PDFDocument, payload: string) {
  const width = document.fontSize(SPAYD_FONT_SIZE).widthOfString(payload);

  return width <= FOOTER_LEFT_WIDTH
    ? SPAYD_FONT_SIZE
    : (SPAYD_FONT_SIZE * FOOTER_LEFT_WIDTH) / width;
}

/**
 * Výška, kterou obrázek po zmenšení do rámečku doopravdy zabere. Rezervovat
 * celý rámeček by pod širokým podpisem nechalo prázdné místo, a zbytečně by
 * tak patičku prodloužilo. Nulu vrací i poškozený soubor — ten se nevykreslí.
 */
function measureFittedHeight(
  document: PDFKit.PDFDocument,
  imagePath: string | null,
  fit: [number, number],
) {
  if (!imagePath) {
    return 0;
  }

  try {
    // `openImage` PDFKit umí, jen ho nemá v typech; soubor si přitom zapamatuje.
    const { height, width } = (
      document as unknown as {
        openImage(source: string): { height: number; width: number };
      }
    ).openImage(imagePath);

    return height * Math.min(fit[0] / width, fit[1] / height);
  } catch {
    return 0;
  }
}

/** Výška bloku, který by nakreslila `writeLines` se stejnými argumenty. */
function measureLines(
  document: PDFKit.PDFDocument,
  lines: Array<string | null | undefined>,
  width: number,
) {
  return lines
    .filter((line): line is string => Boolean(line))
    .reduce(
      (height, line) => height + document.fontSize(9).heightOfString(line, { width }) + 2,
      0,
    );
}

type FooterLayout = {
  /** Podpis a razítko, odsazení od horní linky patičky. */
  assetsTop: number;
  /** Výška patičky bez poznámky — tahle část se nikdy nesmí roztrhnout. */
  coreHeight: number;
  notesHeight: number;
  paymentLinesTop: number;
  qrTop: number;
  spaydFontSize: number;
  spaydTop: number;
  totalsTop: number;
};

/**
 * Spočítá geometrii patičky dřív, než se cokoliv nakreslí. Všechna odsazení
 * jsou vztažená k horní lince patičky, takže se celý blok dá posunout naráz —
 * i na další stránku, když se na tu rozdělanou nevejde.
 */
function measureFooter(
  document: PDFKit.PDFDocument,
  {
    assetHeight,
    notes,
    paymentLines,
    spaydPayload,
    totalsRowCount,
  }: {
    assetHeight: number;
    notes: string | null;
    paymentLines: Array<string | null>;
    spaydPayload: string | null;
    totalsRowCount: number;
  },
): FooterLayout {
  const paymentLinesTop = 20 + LABEL_OFFSET;
  const qrTop =
    paymentLinesTop + measureLines(document, paymentLines, FOOTER_TEXT_WIDTH) + 16;
  const spaydFontSize = spaydPayload ? getSpaydFontSize(document, spaydPayload) : 0;
  const spaydTop = qrTop + QR_SIZE + 6;
  const leftBottom = spaydPayload
    ? spaydTop +
      document.fontSize(spaydFontSize).heightOfString(spaydPayload, {
        lineBreak: false,
        width: FOOTER_LEFT_WIDTH,
      })
    : qrTop +
      document.fontSize(10).heightOfString(PAID_WITHOUT_QR_TEXT, {
        width: FOOTER_LEFT_WIDTH,
      });

  const totalsTop = 35;
  const assetsTop = totalsTop + getTotalsHeight(totalsRowCount) + 10;
  const rightBottom =
    assetsTop + (assetHeight > 0 ? ASSET_LABEL_OFFSET + assetHeight : 0);

  return {
    assetsTop,
    coreHeight: Math.max(leftBottom, rightBottom),
    notesHeight: notes
      ? document.fontSize(9).heightOfString(notes, { width: CONTENT_WIDTH })
      : 0,
    paymentLinesTop,
    qrTop,
    spaydFontSize,
    spaydTop,
    totalsTop,
  };
}

/**
 * Vejde se blok končící na `bottom` ještě nad okraj? Bloky se usazují přesně
 * na `footerLimit`, takže sčítání ve floatech běžně přeteče o setinu bodu —
 * bez téhle tolerance by se patička kvůli zaokrouhlení stěhovala na další
 * stránku.
 */
function fitsOnPage(bottom: number, footerLimit: number) {
  return bottom <= footerLimit + 0.01;
}

/**
 * Kam na stránce začne patička. Nejraději sedí na pevné lince; když se pod ni
 * nevejde, vysune se nahoru, nejvýš ale na `minTop` (těsně pod poslední
 * položku, nebo na horní okraj čerstvé stránky).
 */
function placeFooter({
  coreHeight,
  footerLimit,
  fullHeight,
  minTop,
}: {
  coreHeight: number;
  footerLimit: number;
  fullHeight: number;
  minTop: number;
}) {
  let top = Math.max(minTop, PREFERRED_FOOTER_TOP);

  if (!fitsOnPage(top + fullHeight, footerLimit)) {
    const topWithNotes = Math.max(minTop, footerLimit - fullHeight);

    // Kvůli poznámce má posun smysl jen tehdy, když se tím poznámka na
    // stránku opravdu vejde. Jinak patička zůstane dole a poznámka jde dál.
    if (fitsOnPage(topWithNotes + fullHeight, footerLimit)) {
      top = topWithNotes;
    }
  }

  // Samotná patička se roztrhnout nesmí, tady se posouvá vždycky.
  if (!fitsOnPage(top + coreHeight, footerLimit)) {
    top = Math.max(minTop, footerLimit - coreHeight);
  }

  return top;
}

/** Hlavička tabulky položek. Na pokračovací stránce se kreslí znovu. */
function drawItemsHeader(
  document: PDFKit.PDFDocument,
  y: number,
  fonts: { bold: string; regular: string },
) {
  document
    .moveTo(CONTENT_LEFT, y)
    .lineTo(CONTENT_RIGHT, y)
    .lineWidth(1)
    .strokeColor("#18181b")
    .stroke();
  document.font(fonts.bold).fontSize(9).fillColor("#18181b");
  document.text("Položka", 40, y + 12, { width: 210 });
  document.text("Množství", 255, y + 12, { align: "right", width: 70 });
  document.text("Cena / j.", 335, y + 12, { align: "right", width: 75 });
  document.text("DPH", 420, y + 12, { align: "right", width: 45 });
  document.text("Celkem", 475, y + 12, { align: "right", width: 80 });
  document
    .moveTo(CONTENT_LEFT, y + 32)
    .lineTo(CONTENT_RIGHT, y + 32)
    .strokeColor("#18181b")
    .stroke();
  document.font(fonts.regular).fontSize(9);

  return y + 45;
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
  const clientName = invoice.clientName;
  const isVatPayer = invoice.profile.vatPayerStatus === VatPayerStatus.PAYER;
  const payment = validateBankProfile(invoice.profile);
  const logoPath = getPdfImagePath(invoice.profile.assets, InvoiceAssetType.LOGO);
  const signaturePath = getPdfImagePath(
    invoice.profile.assets,
    InvoiceAssetType.SIGNATURE,
  );
  const stampPath = getPdfImagePath(invoice.profile.assets, InvoiceAssetType.STAMP);
  const summary = getPaymentSummary(invoice);
  // Na uhrazené faktuře QR chybí schválně — sveden odběratel by zaplatil znovu.
  const spaydPayload =
    summary.remainingCents > 0
      ? sanitizeSpaydPayload(
          buildSpaydPayload({
            accountNumber: invoice.profile.accountNumber,
            // Do QR patří doplatek, ne celková částka faktury.
            amount: fromCents(summary.remainingCents),
            bankCode: invoice.profile.bankCode,
            currency: invoice.currency,
            dueDate: invoice.dueDate,
            iban: invoice.profile.iban,
            message: `Faktura ${invoice.number}`,
            variableSymbol: invoice.variableSymbol,
          }),
        )
      : null;
  const qrBuffer = spaydPayload
    ? await QRCode.toBuffer(spaydPayload, {
        errorCorrectionLevel: "M",
        margin: 4,
        scale: 5,
        type: "png",
      })
    : null;

  const hasLogo = drawImageIfAvailable(document, logoPath, 40, 38, {
    fit: [90, 54],
  });
  const titleX = hasLogo ? 145 : 40;

  document
    .font(fonts.regular)
    .fillColor("#71717a")
    .fontSize(10)
    .text(isVatPayer ? "Faktura - daňový doklad" : "Faktura", titleX, 40);
  document
    .font(fonts.bold)
    .fillColor("#18181b")
    .fontSize(26)
    .text(invoice.number, titleX, 58);
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
      invoice.clientStreet,
      `${invoice.clientPostalCode} ${invoice.clientCity}`,
      invoice.clientCountry,
      invoice.clientIco ? `IČO: ${invoice.clientIco}` : null,
      invoice.clientDic ? `DIČ: ${invoice.clientDic}` : null,
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

  const contentBottom = getContentBottom(document);
  let rowY = drawItemsHeader(document, 385, fonts);

  invoice.items.forEach((item) => {
    // Řádek, který by přetekl přes spodní okraj, patří až na další stránku.
    // Bez toho zalomí PDFKit sám a `rowY` přestane odpovídat skutečnosti.
    if (rowY + ITEM_ROW_HEIGHT > contentBottom) {
      document.addPage();
      rowY = drawItemsHeader(document, document.page.margins.top, fonts);
    }

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
    rowY += ITEM_ROW_HEIGHT;
    document.moveTo(40, rowY - 8).lineTo(555, rowY - 8).strokeColor("#e4e4e7").stroke();
  });

  const paymentLines = [
    `Číslo účtu: ${invoice.profile.accountNumber}/${invoice.profile.bankCode}`,
    spaydPayload ? `IBAN v QR: ${payment.paymentIban}` : `IBAN: ${payment.paymentIban}`,
    invoice.profile.swift ? `SWIFT: ${invoice.profile.swift}` : null,
    `Variabilní symbol: ${invoice.variableSymbol}`,
  ];
  const totalsRows = getTotalsRows(invoice);
  const layout = measureFooter(document, {
    assetHeight: Math.max(
      measureFittedHeight(document, signaturePath, SIGNATURE_FIT),
      measureFittedHeight(document, stampPath, STAMP_FIT),
    ),
    notes: invoice.notes,
    paymentLines,
    spaydPayload,
    totalsRowCount: totalsRows.length,
  });

  const footerLimit = contentBottom - FOOTER_BOTTOM_GAP;
  const placement = {
    coreHeight: layout.coreHeight,
    footerLimit,
    fullHeight: layout.coreHeight + (invoice.notes ? NOTES_GAP + layout.notesHeight : 0),
  };
  let footerTop = placeFooter({ ...placement, minTop: rowY + 20 });

  // Ani na doraz se nevejde — celá patička jde na novou stránku. Nechat
  // zalomení na PDFKitu by ji roztrhlo mezi QR a podpisem.
  if (!fitsOnPage(footerTop + layout.coreHeight, footerLimit)) {
    document.addPage();
    footerTop = placeFooter({ ...placement, minTop: document.page.margins.top });
  }

  document
    .moveTo(CONTENT_LEFT, footerTop)
    .lineTo(CONTENT_RIGHT, footerTop)
    .strokeColor("#d4d4d8")
    .stroke();

  // Levý sloupec: platební údaje a pod nimi QR s vypsaným payloadem.
  writeLabel(document, "Platební údaje", CONTENT_LEFT, footerTop + 20);
  writeLines(document, paymentLines, CONTENT_LEFT, footerTop + layout.paymentLinesTop, {
    width: FOOTER_TEXT_WIDTH,
  });

  if (qrBuffer && spaydPayload) {
    document.image(qrBuffer, CONTENT_LEFT, footerTop + layout.qrTop, { width: QR_SIZE });
    document
      .fontSize(layout.spaydFontSize)
      .fillColor("#71717a")
      .text(spaydPayload, CONTENT_LEFT, footerTop + layout.spaydTop, {
        lineBreak: false,
        width: FOOTER_LEFT_WIDTH,
      });
  } else {
    document
      .font(fonts.regular)
      .fontSize(10)
      .fillColor("#18181b")
      .text(PAID_WITHOUT_QR_TEXT, CONTENT_LEFT, footerTop + layout.qrTop, {
        width: FOOTER_LEFT_WIDTH,
      });
  }

  // Pravý sloupec: součty a pod nimi podpis s razítkem.
  drawTotals(document, totalsRows, FOOTER_RIGHT_X, footerTop + layout.totalsTop, fonts);

  const assetTop = footerTop + layout.assetsTop;
  const hasSignature = drawImageIfAvailable(
    document,
    signaturePath,
    FOOTER_RIGHT_X,
    assetTop + ASSET_LABEL_OFFSET,
    { fit: SIGNATURE_FIT },
  );
  const hasStamp = drawImageIfAvailable(
    document,
    stampPath,
    STAMP_X,
    assetTop + ASSET_LABEL_OFFSET,
    { fit: STAMP_FIT },
  );

  if (hasSignature) {
    writeLabel(document, "Podpis", FOOTER_RIGHT_X, assetTop);
  }

  if (hasStamp) {
    writeLabel(document, "Razítko", STAMP_X, assetTop);
  }

  if (invoice.notes) {
    let notesTop = footerTop + layout.coreHeight + NOTES_GAP;

    // Poznámka se veze až pod nejnižším prvkem patičky. Když se pod ni
    // nevejde, přesune se celá na další stránku — patička zůstane vcelku.
    if (!fitsOnPage(notesTop + layout.notesHeight, footerLimit)) {
      document.addPage();
      notesTop = document.page.margins.top;
    }

    document.fontSize(9).fillColor("#52525b").text(invoice.notes, CONTENT_LEFT, notesTop, {
      width: CONTENT_WIDTH,
    });
  }

  document.end();

  return pdf;
}
