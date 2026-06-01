"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  InvoiceStatus,
  VatPayerStatus,
} from "@/generated/prisma/enums";
import {
  addDays,
  decimalFromCents,
  toDate,
} from "@/lib/format";
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
  ValidationError,
} from "@/lib/validation";

function buildInvoiceNumber(issueDate: Date, nextNumber: number) {
  const year = issueDate.getFullYear();
  const month = String(issueDate.getMonth() + 1).padStart(2, "0");
  const serial = String(nextNumber).padStart(3, "0");

  return `${year}${month}${serial}`;
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

  try {
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
    const vatPayerStatus =
      formData.get("vatPayerStatus") === VatPayerStatus.PAYER
        ? VatPayerStatus.PAYER
        : VatPayerStatus.NON_PAYER;

    data = {
      accountNumber,
      bankCode,
      city,
      companyName: getOptionalFormString(formData, "companyName"),
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
  } catch (error) {
    redirect(`/invoices/new?error=${getValidationErrorParam(error)}`);
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
  } catch (error) {
    redirect(`/invoices/${invoiceId}/edit?error=${getValidationErrorParam(error)}`);
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
