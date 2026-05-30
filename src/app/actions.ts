"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { InvoiceStatus, VatPayerStatus } from "@/generated/prisma/enums";
import {
  addDays,
  decimalFromCents,
  getOptionalString,
  getRequiredString,
  parseMoneyToCents,
  parseQuantity,
  toDate,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

function normalizeDigits(value: string | null) {
  return value?.replace(/\D/g, "") || null;
}

function buildInvoiceNumber(issueDate: Date, nextNumber: number) {
  const year = issueDate.getFullYear();
  const month = String(issueDate.getMonth() + 1).padStart(2, "0");
  const serial = String(nextNumber).padStart(3, "0");

  return `${year}${month}${serial}`;
}

function buildClientData(formData: FormData) {
  const clientName = getRequiredString(formData, "clientName");

  return {
    city: getRequiredString(formData, "clientCity"),
    companyName: clientName,
    country: getOptionalString(formData, "clientCountry") ?? "Česká republika",
    dic: getOptionalString(formData, "clientDic"),
    email: getOptionalString(formData, "clientEmail"),
    fullName: null,
    ico: normalizeDigits(getOptionalString(formData, "clientIco")),
    phone: getOptionalString(formData, "clientPhone"),
    postalCode: getRequiredString(formData, "clientPostalCode"),
    street: getRequiredString(formData, "clientStreet"),
  };
}

function parseInvoiceFormData(formData: FormData, isVatPayer: boolean) {
  const issueDate = toDate(
    getOptionalString(formData, "issueDate"),
    new Date(),
  );
  const dueDate = toDate(
    getOptionalString(formData, "dueDate"),
    addDays(issueDate, 14),
  );
  const taxableSupplyDate = toDate(
    getOptionalString(formData, "taxableSupplyDate"),
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
      const quantity = parseQuantity(quantities[index] ?? null);
      const unitPriceCents = parseMoneyToCents(unitPrices[index] ?? null);
      const vatRate = isVatPayer
        ? parseQuantity(vatRates[index] ?? null)
        : 0;

      if (!name && quantity === 0 && unitPriceCents === 0) {
        return null;
      }

      if (!name || quantity <= 0 || unitPriceCents < 0) {
        throw new Error("Invalid invoice item.");
      }

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
    throw new Error("Missing invoice items.");
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

  try {
    const displayName = getRequiredString(formData, "displayName");
    const street = getRequiredString(formData, "street");
    const city = getRequiredString(formData, "city");
    const postalCode = getRequiredString(formData, "postalCode");
    const ico = normalizeDigits(getRequiredString(formData, "ico")) ?? "";
    const accountNumber = getRequiredString(formData, "accountNumber");
    const bankCode = getRequiredString(formData, "bankCode");
    const vatPayerStatus =
      formData.get("vatPayerStatus") === VatPayerStatus.PAYER
        ? VatPayerStatus.PAYER
        : VatPayerStatus.NON_PAYER;

    data = {
      accountNumber,
      bankCode,
      city,
      companyName: getOptionalString(formData, "companyName"),
      country: getOptionalString(formData, "country") ?? "Česká republika",
      dic: getOptionalString(formData, "dic"),
      displayName,
      iban: getOptionalString(formData, "iban"),
      ico,
      postalCode,
      registryText: getOptionalString(formData, "registryText"),
      street,
      swift: getOptionalString(formData, "swift"),
      vatPayerStatus,
    };
  } catch {
    redirect("/settings/profile?error=validation");
  }

  try {
    const profile = await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (profile) {
      await prisma.userProfile.update({
        data,
        where: { id: profile.id },
      });
    } else {
      await prisma.userProfile.create({ data });
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
  } catch {
    redirect("/invoices/new?error=validation");
  }

  let invoiceId;

  try {
    invoiceId = await prisma.$transaction(async (tx) => {
      const sequence = await tx.invoiceSequence.findFirst({
        orderBy: { createdAt: "asc" },
        where: { profileId: profile.id },
      });
      const nextNumber = sequence?.nextNumber ?? 1;
      const number = buildInvoiceNumber(invoiceData.issueDate, nextNumber);

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
            data: { nextNumber: { increment: 1 } },
            where: { id: sequence.id },
          })
        : await tx.invoiceSequence.create({
            data: {
              format: "YYYYMM###",
              name: "Výchozí",
              nextNumber: nextNumber + 1,
              profileId: profile.id,
            },
          });

      const invoice = await tx.invoice.create({
        data: {
          clientId: savedClient.id,
          constantSymbol: getOptionalString(formData, "constantSymbol"),
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
          notes: getOptionalString(formData, "notes"),
          number,
          profileId: profile.id,
          sequenceId: savedSequence.id,
          specificSymbol: getOptionalString(formData, "specificSymbol"),
          status: InvoiceStatus.ISSUED,
          subtotal: decimalFromCents(invoiceData.subtotalCents),
          taxableSupplyDate: invoiceData.taxableSupplyDate,
          total: decimalFromCents(invoiceData.totalCents),
          variableSymbol: number.replace(/\D/g, ""),
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
      select: { clientId: true, status: true },
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

  let invoiceData: ReturnType<typeof parseInvoiceFormData>;

  try {
    invoiceData = parseInvoiceFormData(
      formData,
      profile.vatPayerStatus === VatPayerStatus.PAYER,
    );
  } catch {
    redirect(`/invoices/${invoiceId}/edit?error=validation`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.client.update({
        data: invoiceData.clientData,
        where: { id: invoice.clientId },
      });

      await tx.invoiceItem.deleteMany({
        where: { invoiceId },
      });

      await tx.invoice.update({
        data: {
          constantSymbol: getOptionalString(formData, "constantSymbol"),
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
          notes: getOptionalString(formData, "notes"),
          specificSymbol: getOptionalString(formData, "specificSymbol"),
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

export async function markInvoicePaid(invoiceId: string) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });

    if (!invoice) {
      redirect("/invoices?error=notfound");
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      redirect(`/invoices/${invoiceId}?error=readonly`);
    }

    if (invoice.status !== InvoiceStatus.PAID) {
      await prisma.invoice.update({
        data: {
          paidAt: new Date(),
          status: InvoiceStatus.PAID,
        },
        where: { id: invoiceId },
      });
    }
  } catch {
    redirect(`/invoices/${invoiceId}?error=db`);
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?paid=1`);
}

export async function cancelInvoice(invoiceId: string) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });

    if (!invoice) {
      redirect("/invoices?error=notfound");
    }

    if (invoice.status !== InvoiceStatus.CANCELLED) {
      await prisma.invoice.update({
        data: {
          paidAt: null,
          status: InvoiceStatus.CANCELLED,
        },
        where: { id: invoiceId },
      });
    }
  } catch {
    redirect(`/invoices/${invoiceId}?error=db`);
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  redirect(`/invoices/${invoiceId}?cancelled=1`);
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
  } catch {
    redirect("/clients/new?error=validation");
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
  } catch {
    redirect(`/clients/${clientId}?error=validation`);
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
