import Link from "next/link";
import { notFound } from "next/navigation";

import { ClientForm } from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ClientDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getClient(id: string) {
  try {
    return await prisma.client.findUnique({
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

  if (error === "validation") {
    return "Zkontrolujte prosím povinné údaje: název odběratele a adresu.";
  }

  if (error === "delete") {
    return "Odběratele se nepodařilo smazat. Zkontrolujte, zda nemá vystavené faktury.";
  }

  return null;
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: ClientDetailPageProps) {
  const { id } = await params;
  const client = await getClient(id);
  const query = await searchParams;
  const errorMessage = getErrorMessage(query?.error);
  const savedMessage = query?.saved === "1"
    ? "Změny odběratele byly uloženy."
    : null;

  if (!client) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Odběratelé</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            {client.companyName ?? client.fullName ?? "Detail odběratele"}
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/clients">Zpět na adresář</Link>
        </Button>
      </div>

      {savedMessage ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {savedMessage}
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {errorMessage}
        </section>
      ) : null}

      <ClientForm
        clientId={client.id}
        defaultValues={{
          clientCity: client.city,
          clientCountry: client.country,
          clientDic: client.dic ?? "",
          clientEmail: client.email ?? "",
          clientIco: client.ico ?? "",
          clientName: client.companyName ?? client.fullName ?? "",
          clientPhone: client.phone ?? "",
          clientPostalCode: client.postalCode,
          clientStreet: client.street,
        }}
      />
    </main>
  );
}
