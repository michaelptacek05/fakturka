"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { InvoiceStatus } from "@/generated/prisma/enums";
import { decimalFromCents } from "@/lib/format";
import {
  buildVariableSymbol,
  DEFAULT_INVOICE_NUMBER_FORMAT,
  extractInvoiceSerial,
  getInvoicePeriodKey,
} from "@/lib/invoice-number";
import {
  MAX_IMPORT_ROWS,
  type ImportedClient,
  type ImportedInvoice,
} from "@/lib/fakturoid-import";
import { prisma } from "@/lib/prisma";

/** Payload chodí z prohlížeče, takže se na serveru kontroluje znovu od nuly. */
function readPayload<TRecord>(formData: FormData): TRecord[] {
  const raw = formData.get("payload");

  if (typeof raw !== "string" || raw.length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.slice(0, MAX_IMPORT_ROWS) : [];
  } catch {
    return [];
  }
}

function toDateOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toCents(value: number) {
  return Math.round(value * 100);
}

function sanitizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function sanitizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

async function getProfileId() {
  const profile = await prisma.userProfile.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return profile?.id ?? null;
}

export async function importClients(formData: FormData) {
  const records = readPayload<ImportedClient>(formData);

  if (records.length === 0) {
    redirect("/import?error=empty");
  }

  let profileId: string | null;

  try {
    profileId = await getProfileId();
  } catch {
    redirect("/import?error=db");
  }

  if (!profileId) {
    redirect("/settings/profile?missingProfile=1");
  }

  let created = 0;
  let updated = 0;

  try {
    for (const record of records) {
      const name = sanitizeText(record.name);

      if (name.length === 0) {
        continue;
      }

      const ico = sanitizeOptionalText(record.ico)?.replace(/\D/g, "") || null;

      const data = {
        city: sanitizeText(record.city),
        companyName: name,
        country: sanitizeText(record.country, "Česká republika"),
        dic: sanitizeOptionalText(record.dic),
        email: sanitizeOptionalText(record.email)?.toLowerCase() ?? null,
        fullName: null,
        ico,
        phone: sanitizeOptionalText(record.phone),
        postalCode: sanitizeText(record.postalCode),
        street: sanitizeText(record.street),
      };

      // Shodu hledáme nejdřív podle IČO, teprve pak podle názvu.
      const existing = await prisma.client.findFirst({
        select: { id: true },
        where: ico
          ? { ico, profileId }
          : { companyName: name, profileId },
      });

      if (existing) {
        await prisma.client.update({ data, where: { id: existing.id } });
        updated += 1;
      } else {
        await prisma.client.create({ data: { ...data, profileId } });
        created += 1;
      }
    }
  } catch {
    redirect("/import?error=db");
  }

  revalidatePath("/clients");
  redirect(`/import?clientsCreated=${created}&clientsUpdated=${updated}`);
}

/**
 * Po importu posuneme číselnou řadu, aby další vystavená faktura nedostala
 * číslo, které už mezi importovanými doklady je.
 */
async function syncSequenceAfterImport(profileId: string) {
  const sequence = await prisma.invoiceSequence.findFirst({
    orderBy: { createdAt: "asc" },
    where: { profileId },
  });

  const format = sequence?.format ?? DEFAULT_INVOICE_NUMBER_FORMAT;

  const latest = await prisma.invoice.findFirst({
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    select: { issueDate: true },
    where: { profileId },
  });

  if (!latest) {
    return;
  }

  const periodKey = getInvoicePeriodKey(format, latest.issueDate);

  // Projdeme jen faktury ze stejného období — jinde se čísla nepotkají.
  const candidates = await prisma.invoice.findMany({
    select: { issueDate: true, number: true },
    where: { profileId },
  });

  let maxSerial = 0;

  for (const candidate of candidates) {
    if (getInvoicePeriodKey(format, candidate.issueDate) !== periodKey) {
      continue;
    }

    const serial = extractInvoiceSerial(
      format,
      candidate.issueDate,
      candidate.number,
    );

    if (serial !== null && serial > maxSerial) {
      maxSerial = serial;
    }
  }

  const nextNumber = maxSerial + 1;

  if (sequence) {
    if (sequence.periodKey !== periodKey || sequence.nextNumber < nextNumber) {
      await prisma.invoiceSequence.update({
        data: { nextNumber, periodKey },
        where: { id: sequence.id },
      });
    }
  } else {
    await prisma.invoiceSequence.create({
      data: { format, nextNumber, periodKey, profileId },
    });
  }
}

export async function importInvoices(formData: FormData) {
  const records = readPayload<ImportedInvoice>(formData);

  if (records.length === 0) {
    redirect("/import?error=empty");
  }

  let profile;

  try {
    profile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
  } catch {
    redirect("/import?error=db");
  }

  if (!profile) {
    redirect("/settings/profile?missingProfile=1");
  }

  const profileId = profile.id;
  let created = 0;
  let skipped = 0;

  try {
    for (const record of records) {
      const number = sanitizeText(record.number);
      const issueDate = toDateOrNull(record.issueDate);
      const items = Array.isArray(record.items) ? record.items : [];

      if (number.length === 0 || !issueDate || items.length === 0) {
        skipped += 1;
        continue;
      }

      // Existující doklad nikdy nepřepisujeme — import se dá bezpečně opakovat.
      const existing = await prisma.invoice.findUnique({
        select: { id: true },
        where: { profileId_number: { number, profileId } },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      const clientName = sanitizeText(record.client?.name, "Neznámý odběratel");
      const clientIco =
        sanitizeOptionalText(record.client?.ico)?.replace(/\D/g, "") || null;
      const clientData = {
        city: sanitizeText(record.client?.city),
        companyName: clientName,
        country: sanitizeText(record.client?.country, "Česká republika"),
        dic: sanitizeOptionalText(record.client?.dic),
        email: sanitizeOptionalText(record.client?.email)?.toLowerCase() ?? null,
        fullName: null,
        ico: clientIco,
        phone: null,
        postalCode: sanitizeText(record.client?.postalCode),
        street: sanitizeText(record.client?.street),
      };

      const client =
        (await prisma.client.findFirst({
          select: { id: true },
          where: clientIco
            ? { ico: clientIco, profileId }
            : { companyName: clientName, profileId },
        })) ??
        (await prisma.client.create({
          data: { ...clientData, profileId },
          select: { id: true },
        }));

      const normalizedItems = items.map((item, index) => {
        const quantity =
          typeof item.quantity === "number" && item.quantity > 0
            ? item.quantity
            : 1;
        const unitPriceCents = toCents(
          typeof item.unitPrice === "number" ? item.unitPrice : 0,
        );
        const vatRate =
          typeof item.vatRate === "number" && item.vatRate >= 0 && item.vatRate <= 100
            ? item.vatRate
            : 0;
        const lineSubtotalCents = Math.round(quantity * unitPriceCents);
        const lineVatCents = Math.round(lineSubtotalCents * (vatRate / 100));

        return {
          lineSubtotalCents,
          lineTotalCents: lineSubtotalCents + lineVatCents,
          lineVatCents,
          name: sanitizeText(item.name, "Fakturovaná položka"),
          position: index + 1,
          quantity,
          unit: sanitizeText(item.unit, "ks"),
          unitPriceCents,
          vatRate,
        };
      });

      const subtotalCents = normalizedItems.reduce(
        (sum, item) => sum + item.lineSubtotalCents,
        0,
      );
      const vatTotalCents = normalizedItems.reduce(
        (sum, item) => sum + item.lineVatCents,
        0,
      );

      const paidAt = toDateOrNull(record.paidAt);
      const status =
        record.status === "CANCELLED"
          ? InvoiceStatus.CANCELLED
          : record.status === "PAID"
            ? InvoiceStatus.PAID
            : InvoiceStatus.ISSUED;

      await prisma.invoice.create({
        data: {
          clientCity: clientData.city,
          clientCountry: clientData.country,
          clientDic: clientData.dic,
          clientEmail: clientData.email,
          clientIco: clientData.ico,
          clientId: client.id,
          clientName,
          clientPostalCode: clientData.postalCode,
          clientStreet: clientData.street,
          currency: sanitizeText(record.currency, "CZK").slice(0, 3),
          dueDate: toDateOrNull(record.dueDate) ?? issueDate,
          issueDate,
          items: {
            create: normalizedItems.map((item) => ({
              lineSubtotal: decimalFromCents(item.lineSubtotalCents),
              lineTotal: decimalFromCents(item.lineTotalCents),
              lineVat: decimalFromCents(item.lineVatCents),
              name: item.name,
              position: item.position,
              quantity: item.quantity.toFixed(3),
              unit: item.unit,
              unitPrice: decimalFromCents(item.unitPriceCents),
              vatRate: item.vatRate.toFixed(2),
            })),
          },
          notes: sanitizeOptionalText(record.notes),
          number,
          // Zaplacené doklady bez data úhrady datujeme dnem vystavení,
          // ať se objeví ve statistikách příjmů.
          paidAt: status === InvoiceStatus.PAID ? (paidAt ?? issueDate) : null,
          profileId,
          status,
          subtotal: decimalFromCents(subtotalCents),
          taxableSupplyDate: toDateOrNull(record.taxableSupplyDate),
          total: decimalFromCents(subtotalCents + vatTotalCents),
          variableSymbol:
            sanitizeOptionalText(record.variableSymbol) ??
            buildVariableSymbol(number),
          vatTotal: decimalFromCents(vatTotalCents),
        },
      });

      created += 1;
    }

    await syncSequenceAfterImport(profileId);
  } catch {
    redirect("/import?error=db");
  }

  revalidatePath("/");
  revalidatePath("/invoices");
  revalidatePath("/clients");
  redirect(`/import?invoicesCreated=${created}&invoicesSkipped=${skipped}`);
}
