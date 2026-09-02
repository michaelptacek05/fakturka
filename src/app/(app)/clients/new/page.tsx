import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ClientForm } from "@/components/clients/client-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { getValidationMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function getProfile() {
  try {
    return await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
  } catch {
    return null;
  }
}

function getErrorMessage(error?: string | string[]) {
  if (error === "db") {
    return "Odběratele se nepodařilo uložit, protože databáze není dostupná.";
  }

  return getValidationMessage(error);
}

export default async function NewClientPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const profile = await getProfile();
  const errorMessage = getErrorMessage(params?.error);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Nový odběratel"
        description="Vyhledejte firmu v ARES podle IČO, nebo vyplňte údaje ručně."
        actions={
          <Button asChild variant="outline">
            <Link href="/clients">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Zpět na adresář
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
            Odběratelé jsou navázaní na váš profil. Po uložení profilu se sem
            můžete vrátit.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/settings/profile">Nastavit moje údaje</Link>
          </Button>
        </Alert>
      ) : (
        <ClientForm />
      )}
    </div>
  );
}
