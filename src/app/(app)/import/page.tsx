import type { Metadata } from "next";
import Link from "next/link";

import { importClients, importInvoices } from "@/app/(app)/import/actions";
import { CsvImportCard } from "@/components/import/csv-import-card";
import { Alert } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Import dat — Fakturka",
};

type ImportPageProps = {
  searchParams: Promise<{
    clientsCreated?: string;
    clientsUpdated?: string;
    error?: string;
    invoicesCreated?: string;
    invoicesSkipped?: string;
  }>;
};

function getErrorMessage(error: string | undefined) {
  switch (error) {
    case "db":
      return "Import se nepodařilo dokončit, databáze nebyla dostupná.";
    case "empty":
      return "Nebyly předány žádné záznamy k importu.";
    default:
      return null;
  }
}

export default async function ImportPage({ searchParams }: ImportPageProps) {
  const params = await searchParams;
  const errorMessage = getErrorMessage(params.error);

  const clientsCreated = Number.parseInt(params.clientsCreated ?? "", 10);
  const clientsUpdated = Number.parseInt(params.clientsUpdated ?? "", 10);
  const invoicesCreated = Number.parseInt(params.invoicesCreated ?? "", 10);
  const invoicesSkipped = Number.parseInt(params.invoicesSkipped ?? "", 10);

  const hasClientResult =
    Number.isFinite(clientsCreated) || Number.isFinite(clientsUpdated);
  const hasInvoiceResult =
    Number.isFinite(invoicesCreated) || Number.isFinite(invoicesSkipped);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Import dat"
        description="Přeneste odběratele a faktury z Fakturoidu nebo z jiného CSV."
      />

      {errorMessage ? (
        <Alert variant="destructive" title={errorMessage} />
      ) : null}

      {hasClientResult ? (
        <Alert variant="success" title="Import odběratelů dokončen">
          Nově založeno: {Number.isFinite(clientsCreated) ? clientsCreated : 0},
          aktualizováno:{" "}
          {Number.isFinite(clientsUpdated) ? clientsUpdated : 0}. Výsledek
          najdete v <Link href="/clients">adresáři odběratelů</Link>.
        </Alert>
      ) : null}

      {hasInvoiceResult ? (
        <Alert variant="success" title="Import faktur dokončen">
          Nově založeno:{" "}
          {Number.isFinite(invoicesCreated) ? invoicesCreated : 0}, přeskočeno:{" "}
          {Number.isFinite(invoicesSkipped) ? invoicesSkipped : 0}. Doklady
          najdete v <Link href="/invoices">seznamu faktur</Link>.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Jak dostat data z Fakturoidu</CardTitle>
          <CardDescription>
            Fakturoid pojmenovává sloupce podle svého API, import je pozná
            automaticky.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Odběratele vyexportujte přes <strong>Kontakty → Exportovat →
              CSV</strong>.
            </li>
            <li>
              Faktury přes <strong>Faktury → Exportovat</strong>. Pokud chcete
              i rozpis položek, zvolte export včetně položek — každá položka je
              samostatný řádek se stejným číslem faktury.
            </li>
            <li>
              Soubor sem nahrajte. Před uložením uvidíte náhled a upozornění,
              nic se neuloží bez potvrzení.
            </li>
          </ol>
          <p>
            Import je bezpečné spustit opakovaně: faktura s již existujícím
            číslem se přeskočí a odběratel se stejným IČO se jen aktualizuje.
            Importované faktury si ponechají původní čísla a číselná řada se
            podle nich posune.
          </p>
        </CardContent>
      </Card>

      <CsvImportCard
        action={importClients}
        kind="clients"
        title="Odběratelé"
        description="Adresář odběratelů z exportu kontaktů."
        expectedColumns="name, registration_no, vat_no, street, city, zip, country, email, phone (nebo české ekvivalenty)"
      />

      <CsvImportCard
        action={importInvoices}
        kind="invoices"
        title="Faktury"
        description="Vystavené faktury včetně položek, pokud je export obsahuje."
        expectedColumns="number, client_name, issued_on, due_on, total, status, lines__line__name, lines__line__quantity, lines__line__unit_price, lines__line__vat_rate"
      />
    </div>
  );
}
