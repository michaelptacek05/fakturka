import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { ClientForm } from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

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
    return "Odběratele se nepodařilo uložit, protože databáze není dostupná. Spusťte PostgreSQL a migrace, potom to zkuste znovu.";
  }

  if (error === "validation") {
    return "Zkontrolujte prosím povinné údaje: název odběratele a adresu.";
  }

  return null;
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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Odběratelé</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            Nový odběratel
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/clients">Zpět na adresář</Link>
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
                  Odběratele jsou navázaní na váš profil. Po uložení profilu se
                  sem můžete vrátit a odběratele spravovat.
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
        <ClientForm />
      )}
    </main>
  );
}
