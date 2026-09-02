import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createInvoice } from "@/app/actions";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { VatPayerStatus } from "@/generated/prisma/enums";
import { addDays, formatDateInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getValidationMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function getProfile() {
  try {
    return await prisma.userProfile.findFirst({
      include: {
        sequences: {
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return null;
  }
}

function getErrorMessage(error?: string | string[]) {
  if (error === "db") {
    return "Fakturu se nepodařilo uložit, protože databáze není dostupná.";
  }

  return getValidationMessage(error);
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const profile = await getProfile();
  const issueDate = new Date();
  const errorMessage = getErrorMessage(params?.error);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Nová faktura"
        description="Číslo faktury a variabilní symbol se doplní automaticky při uložení."
        actions={
          <Button asChild variant="outline">
            <Link href="/invoices">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Zpět na faktury
            </Link>
          </Button>
        }
      />

      {errorMessage ? (
        <Alert variant="destructive" title={errorMessage} />
      ) : null}

      {!profile ? (
        <Alert variant="warning" title="Nejdřív nastavte své OSVČ údaje">
          <p>
            Faktura potřebuje vaše fakturační a bankovní údaje dodavatele. Po
            uložení profilu se sem můžete vrátit.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/settings/profile">Nastavit moje údaje</Link>
          </Button>
        </Alert>
      ) : (
        <InvoiceForm
          action={createInvoice}
          defaultIssueDate={formatDateInput(issueDate)}
          defaultDueDate={formatDateInput(addDays(issueDate, 14))}
          defaultTaxableSupplyDate={formatDateInput(issueDate)}
          isVatPayer={profile.vatPayerStatus === VatPayerStatus.PAYER}
        />
      )}
    </div>
  );
}
