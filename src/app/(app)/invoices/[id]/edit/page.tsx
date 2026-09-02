import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { updateInvoice } from "@/app/actions";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
    return "Změny se nepodařilo uložit, protože databáze není dostupná.";
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
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={`Upravit fakturu ${invoice.number}`}
        description="Úprava odběratele se zapíše jen na tuto fakturu, adresář zůstane beze změny."
        actions={
          <Button asChild variant="outline">
            <Link href={`/invoices/${invoice.id}`}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Zpět na fakturu
            </Link>
          </Button>
        }
      />

      {isReadOnly ? (
        <Alert
          variant="warning"
          title="Fakturu nelze upravovat, protože je zaplacená nebo stornovaná."
        />
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive" title={errorMessage} />
      ) : null}

      <InvoiceForm
        action={updateInvoice.bind(null, invoice.id)}
        defaultIssueDate={formatDateInput(invoice.issueDate)}
        defaultDueDate={formatDateInput(invoice.dueDate)}
        defaultTaxableSupplyDate={formatDateInput(
          invoice.taxableSupplyDate ?? invoice.issueDate,
        )}
        defaultValues={{
          clientCity: invoice.clientCity,
          clientCountry: invoice.clientCountry,
          clientDic: invoice.clientDic ?? "",
          clientEmail: invoice.clientEmail ?? "",
          clientIco: invoice.clientIco ?? "",
          clientName: invoice.clientName,
          clientPhone: invoice.client.phone ?? "",
          clientPostalCode: invoice.clientPostalCode,
          clientStreet: invoice.clientStreet,
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
    </div>
  );
}
