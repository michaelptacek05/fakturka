"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ActivityType,
  InvoiceStatus,
  VatPayerStatus,
} from "@/generated/prisma/enums";
import {
  addDays,
  decimalFromCents,
  toDate,
} from "@/lib/format";
import {
  getPaymentSummary,
  resolvePaymentState,
} from "@/lib/invoice-payment";
import {
  buildInvoiceNumber,
  buildVariableSymbol,
  DEFAULT_INVOICE_NUMBER_FORMAT,
  getInvoicePeriodKey,
  normalizeInvoiceNumberFormat,
} from "@/lib/invoice-number";
import {
  getInvoiceAssetExtension,
  getInvoiceAssetStorageRoot,
  INVOICE_ASSET_MIME_TYPES,
  isAllowedInvoiceAssetType,
  MAX_INVOICE_ASSET_SIZE,
  removeStoredInvoiceAsset,
} from "@/lib/invoice-assets";
import { prisma } from "@/lib/prisma";
import {
  getOptionalFormString,
  getRequiredFormString,
  getValidationCode,
  getValidationErrorParam,
  normalizeAccountNumber,
  normalizeBankCode,
  normalizeDic,
  normalizeEmail,
  normalizeIban,
  normalizeIco,
  normalizeMoneyToCents,
  normalizeQuantity,
  normalizeVatRate,
  normalizeWholeNumber,
  ValidationError,
} from "@/lib/validation";

type ClientData = ReturnType<typeof buildClientData>;

/**
 * Údaje odběratele zamrzlé na faktuře. Vystavený doklad musí zůstat stejný
 * i poté, co se odběratel v adresáři přejmenuje nebo přestěhuje.
 */
function buildClientSnapshot(clientData: ClientData) {
  return {
    clientCity: clientData.city,
    clientCountry: clientData.country,
    clientDic: clientData.dic,
    clientEmail: clientData.email,
    clientIco: clientData.ico,
    clientName: clientData.companyName ?? clientData.fullName ?? "",
    clientPostalCode: clientData.postalCode,
    clientStreet: clientData.street,
  };
}

function buildClientData(formData: FormData) {
  const clientName = getRequiredFormString(formData, "clientName");

  return {
    city: getRequiredFormString(formData, "clientCity"),
    companyName: clientName,
    country: getOptionalFormString(formData, "clientCountry") ?? "Česká republika",
    dic: normalizeDic(getOptionalFormString(formData, "clientDic")),
    email: normalizeEmail(getOptionalFormString(formData, "clientEmail")),
    fullName: null,
    ico: normalizeIco(getOptionalFormString(formData, "clientIco")),
    phone: getOptionalFormString(formData, "clientPhone"),
    postalCode: getRequiredFormString(formData, "clientPostalCode"),
    street: getRequiredFormString(formData, "clientStreet"),
  };
}

function parseInvoiceFormData(formData: FormData, isVatPayer: boolean) {
  const issueDate = toDate(
    getOptionalFormString(formData, "issueDate"),
    new Date(),
  );
  const dueDate = toDate(
    getOptionalFormString(formData, "dueDate"),
    addDays(issueDate, 14),
  );
  const taxableSupplyDate = toDate(
    getOptionalFormString(formData, "taxableSupplyDate"),
    issueDate,
  );

  const itemNames = formData.getAll("itemName");
  const quantities = formData.getAll("quantity");
  const units = formData.getAll("unit");
  const unitPrices = formData.getAll("unitPrice");
  const vatRates = formData.getAll("vatRate");

  const items = itemNames
    .map((value, index) => {
      const name = typeof value === "string" ? value.trim() : "";
      const rawQuantity = quantities[index];
      const rawUnitPrice = unitPrices[index];
      const hasQuantity =
        typeof rawQuantity === "string" && rawQuantity.trim().length > 0;
      const hasUnitPrice =
        typeof rawUnitPrice === "string" && rawUnitPrice.trim().length > 0;

      if (!name && !hasQuantity && !hasUnitPrice) {
        return null;
      }

      if (!name) {
        throw new ValidationError("item", "Položka faktury musí mít název.");
      }

      const quantity = normalizeQuantity(rawQuantity ?? null);
      const unitPriceCents = normalizeMoneyToCents(rawUnitPrice ?? null);
      const vatRate = isVatPayer
        ? normalizeVatRate(vatRates[index] ?? null)
        : 0;
      const lineSubtotalCents = Math.round(quantity * unitPriceCents);
      const lineVatCents = Math.round(lineSubtotalCents * (vatRate / 100));
      const lineTotalCents = lineSubtotalCents + lineVatCents;

      return {
        lineSubtotalCents,
        lineTotalCents,
        lineVatCents,
        name,
        position: index + 1,
        quantity,
        unit:
          typeof units[index] === "string" && units[index].trim()
            ? units[index].trim()
            : "ks",
        unitPriceCents,
        vatRate,
      };
    })
    .filter((item): item is {
      lineSubtotalCents: number;
      lineTotalCents: number;
      lineVatCents: number;
      name: string;
      position: number;
      quantity: number;
      unit: string;
      unitPriceCents: number;
      vatRate: number;
    } => item !== null);

  if (items.length === 0) {
    throw new ValidationError("item", "Faktura musí mít alespoň jednu položku.");
  }

  const subtotalCents = items.reduce(
    (sum, item) => sum + item.lineSubtotalCents,
    0,
  );
  const vatTotalCents = items.reduce((sum, item) => sum + item.lineVatCents, 0);
  const totalCents = subtotalCents + vatTotalCents;

  const clientData = buildClientData(formData);
  const clientLookup = [
    clientData.ico ? { ico: clientData.ico } : null,
    clientData.email ? { email: clientData.email } : null,
  ].filter(
    (item): item is { ico: string } | { email: string } => item !== null,
  );

  return {
    clientData,
    clientLookup,
    dueDate,
    issueDate,
    items,
    subtotalCents,
    taxableSupplyDate,
    totalCents,
    vatTotalCents,
  };
}

export async function upsertProfile(formData: FormData) {
  let data;
  let invoiceNumberFormat = DEFAULT_INVOICE_NUMBER_FORMAT;

  try {
    invoiceNumberFormat = normalizeInvoiceNumberFormat(
      getOptionalFormString(formData, "invoiceNumberFormat"),
    );
    const displayName = getRequiredFormString(formData, "displayName");
    const street = getRequiredFormString(formData, "street");
    const city = getRequiredFormString(formData, "city");
    const postalCode = getRequiredFormString(formData, "postalCode");
    const ico = normalizeIco(getRequiredFormString(formData, "ico"), true) ?? "";
    const bankCode = normalizeBankCode(
      getRequiredFormString(formData, "bankCode", "bank"),
    );
    const accountNumber = normalizeAccountNumber(
      getRequiredFormString(formData, "accountNumber", "account"),
      bankCode,
    );
    const activityType =
      formData.get("activityType") === ActivityType.SECONDARY
        ? ActivityType.SECONDARY
        : ActivityType.MAIN;
    const applyTaxpayerCredit = formData.get("applyTaxpayerCredit") === "on";
    const flatExpenseRate = normalizeWholeNumber(
      getOptionalFormString(formData, "flatExpenseRate"),
      60,
      { max: 80, min: 0 },
    );
    const taxpayerCredit = normalizeWholeNumber(
      getOptionalFormString(formData, "taxpayerCredit"),
      30_840,
      { max: 1_000_000, min: 0 },
    );
    const socialThreshold = normalizeWholeNumber(
      getOptionalFormString(formData, "socialThreshold"),
      117_521,
      { max: 10_000_000, min: 0 },
    );
    const vatPayerStatus =
      formData.get("vatPayerStatus") === VatPayerStatus.PAYER
        ? VatPayerStatus.PAYER
        : VatPayerStatus.NON_PAYER;

    data = {
      accountNumber,
      bankCode,
      city,
      activityType,
      applyTaxpayerCredit,
      companyName: getOptionalFormString(formData, "companyName"),
      flatExpenseRate,
      socialThreshold,
      taxpayerCredit,
      country: getOptionalFormString(formData, "country") ?? "Česká republika",
      dic: normalizeDic(getOptionalFormString(formData, "dic")),
      displayName,
      iban: normalizeIban(getOptionalFormString(formData, "iban")),
      ico,
      postalCode,
      registryText: getOptionalFormString(formData, "registryText"),
      street,
      swift: getOptionalFormString(formData, "swift"),
      vatPayerStatus,
    };
  } catch (error) {
    redirect(`/settings/profile?error=${getValidationErrorParam(error)}`);
  }

  try {
    const profile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    const savedProfile = profile
      ? await prisma.userProfile.update({
          data,
          select: { id: true },
          where: { id: profile.id },
        })
      : await prisma.userProfile.create({ data, select: { id: true } });

    // Formát čísla faktury žije na číselné řadě, ne na profilu.
    const sequence = await prisma.invoiceSequence.findFirst({
      orderBy: { createdAt: "asc" },
      select: { format: true, id: true },
      where: { profileId: savedProfile.id },
    });

    if (!sequence) {
      await prisma.invoiceSequence.create({
        data: {
          format: invoiceNumberFormat,
          profileId: savedProfile.id,
        },
      });
    } else if (sequence.format !== invoiceNumberFormat) {
      // periodKey necháváme být — při změně formátu se období neshodne
      // a další faktura správně začne novou řadu od jedničky.
      await prisma.invoiceSequence.update({
        data: { format: invoiceNumberFormat },
        where: { id: sequence.id },
      });
    }
  } catch {
    redirect("/settings/profile?error=db");
  }

  revalidatePath("/");
  revalidatePath("/settings/profile");
  revalidatePath("/invoices/new");
  redirect("/settings/profile?saved=1");
}

export async function createInvoice(formData: FormData) {
  let profile;

  try {
    profile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
    });
  } catch {
    redirect("/invoices/new?error=db");
  }

  if (!profile) {
    redirect("/settings/profile?missingProfile=1");
  }

  let invoiceData: ReturnType<typeof parseInvoiceFormData>;

  try {
    invoiceData = parseInvoiceFormData(
      formData,
      profile.vatPayerStatus === VatPayerStatus.PAYER,
    );
  } catch (error) {
    redirect(`/invoices/new?error=${getValidationErrorParam(error)}`);
  }

  let invoiceId;

  try {
    invoiceId = await prisma.$transaction(async (tx) => {
      // Zámek na číselné řadě, aby dvě souběžná uložení nedostala stejné číslo.
      await tx.$queryRaw`SELECT "id" FROM "InvoiceSequence" WHERE "profileId" = ${profile.id} FOR UPDATE`;

      const sequence = await tx.invoiceSequence.findFirst({
        orderBy: { createdAt: "asc" },
        where: { profileId: profile.id },
      });
      const format = sequence?.format ?? DEFAULT_INVOICE_NUMBER_FORMAT;
      const periodKey = getInvoicePeriodKey(format, invoiceData.issueDate);
      // Nové období (jiný měsíc nebo rok) začíná pořadím od jedničky.
      const nextNumber =
        sequence && sequence.periodKey === periodKey ? sequence.nextNumber : 1;
      const number = buildInvoiceNumber(format, invoiceData.issueDate, nextNumber);

      const client =
        invoiceData.clientLookup.length > 0
          ? await tx.client.findFirst({
              where: {
                OR: invoiceData.clientLookup,
                profileId: profile.id,
              },
            })
          : null;

      const savedClient = client
        ? await tx.client.update({
            data: invoiceData.clientData,
            where: { id: client.id },
          })
        : await tx.client.create({
            data: {
              ...invoiceData.clientData,
              profileId: profile.id,
            },
          });

      const savedSequence = sequence
        ? await tx.invoiceSequence.update({
            data: { nextNumber: nextNumber + 1, periodKey },
            where: { id: sequence.id },
          })
        : await tx.invoiceSequence.create({
            data: {
              format,
              name: "Výchozí",
              nextNumber: nextNumber + 1,
              periodKey,
              profileId: profile.id,
            },
          });

      const invoice = await tx.invoice.create({
        data: {
          ...buildClientSnapshot(invoiceData.clientData),
          clientId: savedClient.id,
          constantSymbol: getOptionalFormString(formData, "constantSymbol"),
          currency: "CZK",
          dueDate: invoiceData.dueDate,
          issueDate: invoiceData.issueDate,
          items: {
            create: invoiceData.items.map((item, index) => ({
              lineSubtotal: decimalFromCents(item.lineSubtotalCents),
              lineTotal: decimalFromCents(item.lineTotalCents),
              lineVat: decimalFromCents(item.lineVatCents),
              name: item.name,
              position: index + 1,
              quantity: item.quantity.toFixed(3),
              unit: item.unit,
              unitPrice: decimalFromCents(item.unitPriceCents),
              vatRate: item.vatRate.toFixed(2),
            })),
          },
          notes: getOptionalFormString(formData, "notes"),
          number,
          profileId: profile.id,
          sequenceId: savedSequence.id,
          specificSymbol: getOptionalFormString(formData, "specificSymbol"),
          status: InvoiceStatus.ISSUED,
          subtotal: decimalFromCents(invoiceData.subtotalCents),
          taxableSupplyDate: invoiceData.taxableSupplyDate,
          total: decimalFromCents(invoiceData.totalCents),
          variableSymbol: buildVariableSymbol(number),
          vatTotal: decimalFromCents(invoiceData.vatTotalCents),
        },
        select: { id: true },
      });

      return invoice.id;
    });
  } catch {
    redirect("/invoices/new?error=db");
  }

  revalidatePath("/");
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

export async function updateInvoice(invoiceId: string, formData: FormData) {
  let profile;

  try {
    profile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, vatPayerStatus: true },
    });
  } catch {
    redirect(`/invoices/${invoiceId}/edit?error=db`);
  }

  if (!profile) {
    redirect("/settings/profile?missingProfile=1");
  }

  let invoice;

  try {
    invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, profileId: profile.id },
      select: { clientId: true, paidAmount: true, status: true, total: true },
    });
  } catch {
    redirect(`/invoices/${invoiceId}/edit?error=db`);
  }

  if (!invoice) {
    redirect("/invoices?error=notfound");
  }

  if (invoice.status === InvoiceStatus.CANCELLED || invoice.status === InvoiceStatus.PAID) {
    redirect(`/invoices/${invoiceId}/edit?error=readonly`);
  }

  // Změna položek by posunula celkovou částku pod už evidované úhrady.
  if (getPaymentSummary(invoice).paidCents > 0) {
    redirect(`/invoices/${invoiceId}/edit?error=paidlock`);
  }

  let invoiceData: ReturnType<typeof parseInvoiceFormData>;

  try {
    invoiceData = parseInvoiceFormData(
      formData,
      profile.vatPayerStatus === VatPayerStatus.PAYER,
    );
  } catch (error) {
    redirect(`/invoices/${invoiceId}/edit?error=${getValidationErrorParam(error)}`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Záměrně needitujeme záznam odběratele v adresáři — úprava jedné
      // faktury nesmí přepsat údaje na ostatních dokladech.
      await tx.invoiceItem.deleteMany({
        where: { invoiceId },
      });

      await tx.invoice.update({
        data: {
          ...buildClientSnapshot(invoiceData.clientData),
          constantSymbol: getOptionalFormString(formData, "constantSymbol"),
          dueDate: invoiceData.dueDate,
          issueDate: invoiceData.issueDate,
          items: {
            create: invoiceData.items.map((item, index) => ({
              lineSubtotal: decimalFromCents(item.lineSubtotalCents),
              lineTotal: decimalFromCents(item.lineTotalCents),
              lineVat: decimalFromCents(item.lineVatCents),
              name: item.name,
              position: index + 1,
              quantity: item.quantity.toFixed(3),
              unit: item.unit,
              unitPrice: decimalFromCents(item.unitPriceCents),
              vatRate: item.vatRate.toFixed(2),
            })),
          },
          notes: getOptionalFormString(formData, "notes"),
          specificSymbol: getOptionalFormString(formData, "specificSymbol"),
          subtotal: decimalFromCents(invoiceData.subtotalCents),
          taxableSupplyDate: invoiceData.taxableSupplyDate,
          total: decimalFromCents(invoiceData.totalCents),
          vatTotal: decimalFromCents(invoiceData.vatTotalCents),
        },
        where: { id: invoiceId },
      });
    });
  } catch {
    redirect(`/invoices/${invoiceId}/edit?error=db`);
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/invoices/${invoiceId}/edit`);
  redirect(`/invoices/${invoiceId}?saved=1`);
}

/**
 * Chyba zjištěná až uvnitř transakce. Redirect z callbacku by transakci
 * shodil vlastní výjimkou, proto se kód přenese ven a přesměruje se až tam.
 */
class PaymentStateError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/**
 * Přepočte uhrazenou částku a stav dokladu podle evidovaných plateb.
 * Voláme vždy uvnitř transakce, aby se cache `paidAmount` nerozešla s platbami.
 */
async function syncInvoicePaymentState(
  tx: Pick<typeof prisma, "invoice" | "invoicePayment">,
  invoiceId: string,
) {
  const invoice = await tx.invoice.findUnique({
    select: {
      payments: { select: { amount: true, paidOn: true } },
      status: true,
      total: true,
    },
    where: { id: invoiceId },
  });

  if (!invoice) {
    return;
  }

  await tx.invoice.update({
    data: resolvePaymentState({
      currentStatus: invoice.status,
      payments: invoice.payments,
      total: invoice.total,
    }),
    where: { id: invoiceId },
  });
}

export async function addInvoicePayment(invoiceId: string, formData: FormData) {
  let amountCents: number;
  let paidOn: Date;
  let note: string | null;

  try {
    amountCents = normalizeMoneyToCents(formData.get("amount"));

    if (amountCents <= 0) {
      throw new ValidationError("payment", "Úhrada musí být kladná částka.");
    }

    paidOn = toDate(getOptionalFormString(formData, "paidOn"), new Date());
    note = getOptionalFormString(formData, "note");
  } catch (error) {
    // Nečitelnou částku hlásíme jako chybu úhrady, ne jako chybu ceníku.
    const code =
      getValidationCode(error) === "amount" ? "payment" : getValidationCode(error);

    redirect(`/invoices/${invoiceId}?error=${encodeURIComponent(code)}`);
  }

  try {
    // Stav se čte až uvnitř transakce: kontrola nad daty načtenými dřív by
    // při dvojím odeslání pustila obě platby a faktura by se přeplatila.
    await prisma.$transaction(
      async (tx) => {
        const invoice = await tx.invoice.findUnique({
          select: { paidAmount: true, status: true, total: true },
          where: { id: invoiceId },
        });

        if (!invoice) {
          throw new PaymentStateError("notfound");
        }

        if (invoice.status === InvoiceStatus.CANCELLED) {
          throw new PaymentStateError("readonly");
        }

        if (amountCents > getPaymentSummary(invoice).remainingCents) {
          throw new PaymentStateError("payment");
        }

        await tx.invoicePayment.create({
          data: {
            amount: decimalFromCents(amountCents),
            invoiceId,
            note,
            paidOn,
          },
        });

        await syncInvoicePaymentState(tx, invoiceId);
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof PaymentStateError) {
      if (error.code === "notfound") {
        redirect("/invoices?error=notfound");
      }

      redirect(`/invoices/${invoiceId}?error=${error.code}`);
    }

    redirect(`/invoices/${invoiceId}?error=db`);
  }

  revalidatePath("/");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?payment=added`);
}

export async function deleteInvoicePayment(paymentId: string) {
  let payment;

  try {
    payment = await prisma.invoicePayment.findUnique({
      select: { invoiceId: true },
      where: { id: paymentId },
    });
  } catch {
    redirect("/invoices?error=db");
  }

  if (!payment) {
    redirect("/invoices?error=notfound");
  }

  const { invoiceId } = payment;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoicePayment.delete({ where: { id: paymentId } });
      await syncInvoicePaymentState(tx, invoiceId);
    });
  } catch {
    redirect(`/invoices/${invoiceId}?error=db`);
  }

  revalidatePath("/");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?payment=removed`);
}

/**
 * Doplatí zbývající částku jednou platbou. Zkratka pro běžný případ
 * „přišlo to celé“ — historie plateb tím zůstane úplná.
 */
export async function markInvoicePaid(invoiceId: string) {
  try {
    await prisma.$transaction(
      async (tx) => {
        const invoice = await tx.invoice.findUnique({
          select: { paidAmount: true, status: true, total: true },
          where: { id: invoiceId },
        });

        if (!invoice) {
          throw new PaymentStateError("notfound");
        }

        if (invoice.status === InvoiceStatus.CANCELLED) {
          throw new PaymentStateError("readonly");
        }

        const { remainingCents } = getPaymentSummary(invoice);

        // Doklad na nulovou částku nemá co doplácet, stav se přesto srovná.
        if (remainingCents > 0) {
          await tx.invoicePayment.create({
            data: {
              amount: decimalFromCents(remainingCents),
              invoiceId,
              paidOn: new Date(),
            },
          });
        }

        await syncInvoicePaymentState(tx, invoiceId);
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof PaymentStateError) {
      if (error.code === "notfound") {
        redirect("/invoices?error=notfound");
      }

      redirect(`/invoices/${invoiceId}?error=${error.code}`);
    }

    redirect(`/invoices/${invoiceId}?error=db`);
  }

  revalidatePath("/");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?paid=1`);
}

/**
 * Storno ruší doklad, ne pohyb peněz. Když už úhrada přišla, musí volající
 * říct, jestli se odběrateli vrátila — vrácení se zapíše jako záporná platba,
 * takže se v příjmech odečte přesně tam, kde peníze reálně odešly.
 */
export async function cancelInvoice(invoiceId: string, formData?: FormData) {
  const shouldRefund = formData?.get("refund") === "1";

  let invoice;

  try {
    invoice = await prisma.invoice.findUnique({
      select: { paidAmount: true, status: true, total: true },
      where: { id: invoiceId },
    });
  } catch {
    redirect(`/invoices/${invoiceId}?error=db`);
  }

  if (!invoice) {
    redirect("/invoices?error=notfound");
  }

  if (invoice.status === InvoiceStatus.CANCELLED) {
    redirect(`/invoices/${invoiceId}?cancelled=1`);
  }

  const { paidCents } = getPaymentSummary(invoice);

  try {
    await prisma.$transaction(
      async (tx) => {
        // Stav se přepíná první — `resolvePaymentState` pak stornovaný doklad
        // nepřeklopí zpátky na vystavený, jen dopočítá uhrazenou částku.
        await tx.invoice.update({
          data: { paidAt: null, status: InvoiceStatus.CANCELLED },
          where: { id: invoiceId },
        });

        if (shouldRefund && paidCents > 0) {
          await tx.invoicePayment.create({
            data: {
              amount: decimalFromCents(-paidCents),
              invoiceId,
              note: "Vrácení platby při stornu",
              paidOn: new Date(),
            },
          });
        }

        await syncInvoicePaymentState(tx, invoiceId);
      },
      { isolationLevel: "Serializable" },
    );
  } catch {
    redirect(`/invoices/${invoiceId}?error=db`);
  }

  revalidatePath("/");
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(
    `/invoices/${invoiceId}?cancelled=${shouldRefund && paidCents > 0 ? "refunded" : "1"}`,
  );
}

export async function deleteInvoices(formData: FormData) {
  const invoiceIds = formData
    .getAll("invoiceId")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  if (invoiceIds.length === 0) {
    redirect("/invoices?bulkError=empty");
  }

  try {
    const result = await prisma.invoice.deleteMany({
      where: {
        id: { in: invoiceIds },
      },
    });

    revalidatePath("/");
    revalidatePath("/invoices");
    redirect(`/invoices?deleted=${result.count}`);
  } catch {
    redirect("/invoices?bulkError=db");
  }
}

export async function createClient(formData: FormData) {
  let profile;

  try {
    profile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
  } catch {
    redirect("/clients/new?error=db");
  }

  if (!profile) {
    redirect("/settings/profile?missingProfile=1");
  }

  let data;

  try {
    data = buildClientData(formData);
  } catch (error) {
    redirect(`/clients/new?error=${getValidationErrorParam(error)}`);
  }

  let clientId;

  try {
    const client = await prisma.client.create({
      data: {
        ...data,
        profileId: profile.id,
      },
      select: { id: true },
    });

    clientId = client.id;
  } catch {
    redirect("/clients/new?error=db");
  }

  revalidatePath("/clients");
  redirect(`/clients/${clientId}?saved=1`);
}

export async function updateClient(clientId: string, formData: FormData) {
  let profile;

  try {
    profile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
  } catch {
    redirect(`/clients/${clientId}?error=db`);
  }

  if (!profile) {
    redirect("/settings/profile?missingProfile=1");
  }

  let data;

  try {
    data = buildClientData(formData);
  } catch (error) {
    redirect(`/clients/${clientId}?error=${getValidationErrorParam(error)}`);
  }

  try {
    await prisma.client.update({
      data,
      where: { id: clientId },
    });
  } catch {
    redirect(`/clients/${clientId}?error=db`);
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}?saved=1`);
}

export async function deleteClient(clientId: string) {
  try {
    await prisma.client.delete({
      where: { id: clientId },
    });
  } catch {
    redirect(`/clients/${clientId}?error=delete`);
  }

  revalidatePath("/clients");
  redirect("/clients?deleted=1");
}

export async function uploadInvoiceAsset(formData: FormData) {
  const assetType = formData.get("assetType");
  const file = formData.get("assetFile");

  if (!isAllowedInvoiceAssetType(assetType)) {
    redirect("/settings/profile?assetError=validation");
  }

  if (!(file instanceof File) || file.size === 0) {
    redirect("/settings/profile?assetError=missing");
  }

  if (!INVOICE_ASSET_MIME_TYPES.includes(file.type)) {
    redirect("/settings/profile?assetError=type");
  }

  if (file.size > MAX_INVOICE_ASSET_SIZE) {
    redirect("/settings/profile?assetError=size");
  }

  let profile;

  try {
    profile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
  } catch {
    redirect("/settings/profile?assetError=db");
  }

  if (!profile) {
    redirect("/settings/profile?missingProfile=1");
  }

  const extension = getInvoiceAssetExtension(file.type);
  const directory = path.join(getInvoiceAssetStorageRoot(), profile.id);
  const fileName = `${assetType.toLowerCase()}-${randomUUID()}.${extension}`;
  const storagePath = path.join("storage", "invoice-assets", profile.id, fileName);
  const absolutePath = path.join(process.cwd(), storagePath);
  const oldStoragePaths: string[] = [];

  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

    await prisma.$transaction(async (tx) => {
      const oldAssets = await tx.invoiceAsset.findMany({
        select: { storagePath: true },
        where: {
          profileId: profile.id,
          type: assetType,
        },
      });

      oldStoragePaths.push(...oldAssets.map((asset) => asset.storagePath));

      await tx.invoiceAsset.deleteMany({
        where: {
          profileId: profile.id,
          type: assetType,
        },
      });

      await tx.invoiceAsset.create({
        data: {
          fileName: file.name || fileName,
          mimeType: file.type,
          profileId: profile.id,
          storagePath,
          type: assetType,
        },
      });
    });
  } catch {
    await removeStoredInvoiceAsset(storagePath);
    redirect("/settings/profile?assetError=db");
  }

  for (const oldStoragePath of oldStoragePaths) {
    try {
      await removeStoredInvoiceAsset(oldStoragePath);
    } catch {
      // The new DB state is already committed; stale files can be cleaned up later.
    }
  }

  revalidatePath("/settings/profile");
  revalidatePath("/invoices");
  redirect("/settings/profile?assetSaved=1");
}

export async function deleteInvoiceAsset(assetId: string) {
  let storagePath: string | null = null;

  try {
    const asset = await prisma.invoiceAsset.delete({
      select: { storagePath: true },
      where: { id: assetId },
    });

    storagePath = asset.storagePath;
  } catch {
    redirect("/settings/profile?assetError=delete");
  }

  try {
    await removeStoredInvoiceAsset(storagePath);
  } catch {
    // The asset row is gone; a leftover file must not block the user flow.
  }

  revalidatePath("/settings/profile");
  revalidatePath("/invoices");
  redirect("/settings/profile?assetDeleted=1");
}
