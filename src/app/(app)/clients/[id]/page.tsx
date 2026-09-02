import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FolderPlus } from "lucide-react";

import { ClientForm } from "@/components/clients/client-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { getValidationMessage } from "@/lib/validation";

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
      include: {
        _count: {
          select: { invoices: true, projects: true },
        },
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

  if (error === "delete") {
    return "Odběratele se nepodařilo smazat. Zkontrolujte, zda nemá vystavené faktury.";
  }

  return getValidationMessage(error);
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: ClientDetailPageProps) {
  const { id } = await params;
  const client = await getClient(id);
  const query = await searchParams;
  const errorMessage = getErrorMessage(query?.error);

  if (!client) {
    notFound();
  }

  const invoiceCount = client._count.invoices;
  const projectCount = client._count.projects;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title={client.companyName ?? client.fullName ?? "Detail odběratele"}
        description={[
          invoiceCount === 0
            ? "Zatím bez vystavených faktur."
            : `Vystavených faktur: ${invoiceCount}.`,
          projectCount > 0 ? `Projektů: ${projectCount}.` : null,
        ]
          .filter(Boolean)
          .join(" ")}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/projects/new?clientId=${client.id}`}>
                <FolderPlus className="size-4" aria-hidden="true" />
                Nový projekt
              </Link>
            </Button>
            {invoiceCount > 0 ? (
              <Button asChild variant="outline">
                <Link
                  href={`/invoices?q=${encodeURIComponent(
                    client.companyName ?? client.fullName ?? "",
                  )}`}
                >
                  Zobrazit faktury
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/clients">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Zpět na adresář
              </Link>
            </Button>
          </>
        }
      />

      {query?.saved === "1" ? (
        <Alert variant="success" title="Změny odběratele byly uloženy." />
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive" title={errorMessage} />
      ) : null}

      {invoiceCount > 0 ? (
        <Alert variant="info" title="Změna se nepromítne do vystavených faktur">
          Doklady si drží údaje odběratele z okamžiku vystavení, takže úprava
          adresáře nezmění už vytištěné faktury.
        </Alert>
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
    </div>
  );
}
