import Link from "next/link";
import { AlertTriangle, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";

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

async function getClients(profileId: string) {
  try {
    return await prisma.client.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return null;
  }
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const profile = await getProfile();
  const deletedMessage = params?.deleted === "1"
    ? "Odběratel byl smazán."
    : null;

  if (!profile) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Odběratelé</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">
              Adresář odběratelů
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link href="/settings/profile">Nastavit moje údaje</Link>
          </Button>
        </div>

        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-3">
            <AlertTriangle
              className="mt-0.5 size-5 text-amber-700"
              aria-hidden="true"
            />
            <div className="grid gap-2 text-sm text-amber-900">
              <p className="font-semibold">Nejdřív nastavte moje OSVČ údaje</p>
              <p>
                Odběratele jsou navázaní na váš profil. Po uložení údajů se sem
                můžete vrátit a spravovat klienty.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const clients = await getClients(profile.id);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Odběratelé</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            Adresář odběratelů
          </h1>
        </div>
        <Button asChild>
          <Link href="/clients/new">
            <UserPlus className="size-4" aria-hidden="true" />
            Přidat odběratele
          </Link>
        </Button>
      </div>

      {deletedMessage ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {deletedMessage}
        </section>
      ) : null}

      {clients === null ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Databáze není dostupná. Spusťte PostgreSQL a migrace, potom stránku
          obnovte.
        </section>
      ) : clients.length === 0 ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold">Zatím žádní odběratelé</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Přidejte prvního odběratele a budete ho mít k dispozici při fakturaci.
          </p>
          <Button asChild className="mt-5">
            <Link href="/clients/new">Přidat odběratele</Link>
          </Button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-zinc-100 text-left text-zinc-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Odběratel</th>
                  <th className="px-4 py-3 font-medium">IČO</th>
                  <th className="px-4 py-3 font-medium">Město</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Telefon</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr className="border-t border-zinc-200" key={client.id}>
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-zinc-950 underline-offset-4 hover:underline"
                      >
                        {client.companyName ?? client.fullName ?? "Bez názvu"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {client.ico || "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {client.city}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {client.email || "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {client.phone || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
