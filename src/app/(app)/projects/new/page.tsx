import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ProjectForm } from "@/components/projects/project-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { getValidationMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function getClients() {
  try {
    return await prisma.client.findMany({
      orderBy: { companyName: "asc" },
      select: { companyName: true, fullName: true, id: true },
    });
  } catch {
    return [];
  }
}

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const clients = await getClients();
  const errorMessage =
    params?.error === "db"
      ? "Projekt se nepodařilo uložit, protože databáze není dostupná."
      : getValidationMessage(params?.error);

  const clientParam =
    typeof params?.clientId === "string" ? params.clientId : "";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Nový projekt"
        description="Projekt sdružuje úkoly pro jednoho odběratele."
        actions={
          <Button asChild variant="outline">
            <Link href="/projects">
              <ArrowLeft className="size-4" aria-hidden="true" />
              Zpět na projekty
            </Link>
          </Button>
        }
      />

      {errorMessage ? (
        <Alert variant="destructive" title={errorMessage} />
      ) : null}

      <ProjectForm
        clients={clients.map((client) => ({
          id: client.id,
          name: client.companyName ?? client.fullName ?? "Bez názvu",
        }))}
        defaultValues={{ clientId: clientParam }}
      />
    </div>
  );
}
