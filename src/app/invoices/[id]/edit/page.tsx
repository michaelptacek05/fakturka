import Link from "next/link";
import { notFound } from "next/navigation";

import { updateInvoice } from "@/app/actions";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Button } from "@/components/ui/button";
import { InvoiceStatus, VatPayerStatus } from "@/generated/prisma/enums";
import { formatDateInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getValidationMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

type InvoiceEditPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getInvoice(id: string) {
  try {
    return await prisma.invoice.findUnique({
      include: {
        client: true,
        items: { orderBy: { position: "asc" } },
        profile: true,
      },
      where: { id },
    });
  } catch {
    return null;
  }
}

function getErrorMessage(error?: string | string[]) {
  if (error === "db") {
    return "Změny se nepodařilo uložit, protože databáze není dostupná. Spusťte PostgreSQL a migrace, potom to zkuste znovu.";
  }

  if (error === "readonly") {
    return "Fakturu nelze upravovat, protože je zaplacená nebo stornovaná.";
  }

  return getValidationMessage(error);
}

export default async function InvoiceEditPage({
  params,
  searchParams,
}: InvoiceEditPageProps) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  const query = await searchParams;
  const errorMessage = getErrorMessage(query?.error);

  if (!invoice) {
    notFound();
  }

  const isVatPayer = invoice.profile.vatPayerStatus === VatPayerStatus.PAYER;
  const isReadOnly =
    invoice.status === InvoiceStatus.PAID ||
    invoice.status === InvoiceStatus.CANCELLED;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Faktura</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            Upravit fakturu {invoice.number}
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link href={`/invoices/${invoice.id}`}>Zpět na fakturu</Link>
        </Button>
      </div>

      {isReadOnly ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Fakturu nelze upravovat, protože je zaplacená nebo stornovaná.
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {errorMessage}
        </section>
      ) : null}

      <InvoiceForm
        action={updateInvoice.bind(null, invoice.id)}
        defaultIssueDate={formatDateInput(invoice.issueDate)}
        defaultDueDate={formatDateInput(invoice.dueDate)}
        defaultTaxableSupplyDate={formatDateInput(
          invoice.taxableSupplyDate ?? invoice.issueDate,
        )}
        defaultValues={{
          clientCity: invoice.client.city,
          clientCountry: invoice.client.country,
          clientDic: invoice.client.dic ?? "",
          clientEmail: invoice.client.email ?? "",
          clientIco: invoice.client.ico ?? "",
          clientName: invoice.client.companyName ?? invoice.client.fullName ?? "",
          clientPhone: invoice.client.phone ?? "",
          clientPostalCode: invoice.client.postalCode,
          clientStreet: invoice.client.street,
          constantSymbol: invoice.constantSymbol ?? "",
          notes: invoice.notes ?? "",
          specificSymbol: invoice.specificSymbol ?? "",
        }}
        initialItems={invoice.items.map((item) => ({
          name: item.name,
          quantity: item.quantity.toString(),
          unit: item.unit,
          unitPrice: item.unitPrice.toString(),
          vatRate: item.vatRate.toString(),
        }))}
        isVatPayer={isVatPayer}
        readOnly={isReadOnly}
        submitLabel="Uložit změny"
      />
    </main>
  );
}
