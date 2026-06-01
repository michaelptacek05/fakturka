import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { createInvoice } from "@/app/actions";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Button } from "@/components/ui/button";
import { VatPayerStatus } from "@/generated/prisma/enums";
import { addDays, formatDateInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getValidationMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function getProfile() {
  try {
    return await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return null;
  }
}

function getErrorMessage(error?: string | string[]) {
  if (error === "db") {
    return "Fakturu se nepodařilo uložit, protože databáze není dostupná. Spusťte PostgreSQL a migrace, potom to zkuste znovu.";
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Faktury</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            Nová faktura
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/invoices">Zpět na faktury</Link>
        </Button>
      </div>

      {errorMessage ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {errorMessage}
        </section>
      ) : null}

      {!profile ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-3">
            <AlertTriangle
              className="mt-0.5 size-5 text-amber-700"
              aria-hidden="true"
            />
            <div className="grid gap-3">
              <div>
                <h2 className="font-semibold text-amber-950">
                  Nejdřív nastavte moje OSVČ údaje
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  Faktura potřebuje vaše fakturační a bankovní údaje dodavatele. Po uložení
                  profilu se sem můžete vrátit a fakturu vystavit.
                </p>
              </div>
              <div>
                <Button asChild>
                  <Link href="/settings/profile">Nastavit moje údaje</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <InvoiceForm
          action={createInvoice}
          defaultIssueDate={formatDateInput(issueDate)}
          defaultDueDate={formatDateInput(addDays(issueDate, 14))}
          defaultTaxableSupplyDate={formatDateInput(issueDate)}
          isVatPayer={profile.vatPayerStatus === VatPayerStatus.PAYER}
        />
      )}
    </main>
  );
}
