import Link from "next/link";
import { Download, Search, UserPlus } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputField } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
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

async function getClients(profileId: string, query: string) {
  try {
    return await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
      where: {
        profileId,
        ...(query ? { OR: [
          { companyName: { contains: query, mode: "insensitive" as const } },
          { fullName: { contains: query, mode: "insensitive" as const } },
          { ico: { contains: query } },
          { email: { contains: query, mode: "insensitive" as const } },
          { city: { contains: query, mode: "insensitive" as const } },
        ] } : {}),
      },
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
  const query = typeof params?.q === "string" ? params.q.trim() : "";
  const profile = await getProfile();

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Odběratelé"
          description="Adresář firem a osob, kterým fakturujete."
          actions={
            <Button asChild variant="outline">
              <Link href="/settings/profile">Nastavit moje údaje</Link>
            </Button>
          }
        />

        <Alert variant="warning" title="Nejdřív nastavte své OSVČ údaje">
          Odběratelé jsou navázaní na váš profil. Po uložení údajů se sem můžete
          vrátit a spravovat je.
        </Alert>
      </div>
    );
  }

  const clients = await getClients(profile.id, query);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Odběratelé"
        description="Adresář firem a osob, kterým fakturujete."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/import">
                <Download className="size-4" aria-hidden="true" />
                Import z CSV
              </Link>
            </Button>
            <Button asChild>
              <Link href="/clients/new">
                <UserPlus className="size-4" aria-hidden="true" />
                Přidat odběratele
              </Link>
            </Button>
          </>
        }
      />

      {params?.deleted === "1" ? (
        <Alert variant="success" title="Odběratel byl smazán." />
      ) : null}

      {clients !== null ? (
        <Card>
          <CardContent className="p-4">
            <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <InputField name="q" label="Hledat odběratele" placeholder="Jméno, IČO, e-mail nebo město" defaultValue={query} className="flex-1 sm:max-w-sm" />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="outline"><Search aria-hidden="true" />Hledat</Button>
                {query ? <Button asChild variant="ghost"><Link href="/clients">Zrušit hledání</Link></Button> : null}
              </div>
              <p className="text-sm text-muted-foreground sm:ml-auto sm:pb-2">{clients.length} odběratelů</p>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {clients === null ? (
        <Alert variant="destructive" title="Databáze není dostupná">
          Spusťte PostgreSQL a migrace, potom stránku obnovte.
        </Alert>
      ) : clients.length === 0 ? (
        <Card>
          <EmptyState
            title={query ? "Žádný odběratel neodpovídá hledání" : "Zatím žádní odběratelé"}
            description={query ? "Zkuste kratší název nebo jiné IČO." : "Přidejte prvního odběratele ručně, nebo naimportujte adresář z Fakturoidu."}
            action={
              query ? <Button asChild variant="outline"><Link href="/clients">Zrušit hledání</Link></Button> : <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/clients/new">Přidat odběratele</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/import">Importovat z CSV</Link>
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border md:hidden" aria-label="Seznam odběratelů">
            {clients.map((client) => (
              <li key={client.id} className="p-5">
                <Link href={`/clients/${client.id}`} className="block break-words text-base font-semibold underline-offset-4 hover:underline">{client.companyName ?? client.fullName ?? "Bez názvu"}</Link>
                <p className="mt-1 text-sm text-muted-foreground">{client.ico ? `IČO ${client.ico}` : "Bez IČO"}{client.city ? ` · ${client.city}` : ""}</p>
                {client.email ? <a className="mt-2 inline-flex min-h-11 items-center break-all text-sm text-primary underline-offset-4 hover:underline" href={`mailto:${client.email}`}>{client.email}</a> : null}
                {client.phone ? <a className="flex min-h-11 items-center text-sm text-primary" href={`tel:${client.phone}`}>{client.phone}</a> : null}
              </li>
            ))}
          </ul>
          <TableWrapper className="hidden md:block">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Odběratel</TableHead>
                  <TableHead>IČO</TableHead>
                  <TableHead>Město</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/clients/${client.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {client.companyName ?? client.fullName ?? "Bez názvu"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.ico || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.city || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.email || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {client.phone || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </Card>
      )}
    </div>
  );
}
