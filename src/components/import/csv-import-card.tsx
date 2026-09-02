"use client";

import { useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileUp, Loader2, Upload } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { decodeCsvBytes } from "@/lib/csv";
import {
  previewClientImport,
  previewInvoiceImport,
  type ImportedClient,
  type ImportedInvoice,
  type ImportPreview,
} from "@/lib/fakturoid-import";
import { formatCurrency, formatDate } from "@/lib/format";

const PREVIEW_ROW_LIMIT = 8;

type ClientPreview = ImportPreview<ImportedClient>;
type InvoicePreview = ImportPreview<ImportedInvoice>;

type CsvImportCardProps = {
  action: (formData: FormData) => void | Promise<void>;
  description: string;
  expectedColumns: string;
  kind: "clients" | "invoices";
  title: string;
};

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || count === 0}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Upload className="size-4" aria-hidden="true" />
      )}
      {pending ? "Importuji…" : `Importovat ${count}`}
    </Button>
  );
}

function invoiceTotal(invoice: ImportedInvoice) {
  return invoice.items.reduce((sum, item) => {
    const subtotal = item.quantity * item.unitPrice;

    return sum + subtotal + subtotal * (item.vatRate / 100);
  }, 0);
}

export function CsvImportCard({
  action,
  description,
  expectedColumns,
  kind,
  title,
}: CsvImportCardProps) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ClientPreview | InvoicePreview | null>(
    null,
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setPreview(null);
    setReadError(null);
    setFileName(file?.name ?? null);

    if (!file) {
      return;
    }

    try {
      const text = decodeCsvBytes(await file.arrayBuffer());

      setPreview(
        kind === "clients"
          ? previewClientImport(text)
          : previewInvoiceImport(text),
      );
    } catch {
      setReadError("Soubor se nepodařilo přečíst. Zkontrolujte, že jde o CSV.");
    }
  }

  const recordCount = preview?.records.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>Soubor CSV</Label>
          <Input
            id={inputId}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={handleFileChange}
            className="h-auto py-2"
          />
          <p className="text-xs text-muted-foreground">
            Očekávané sloupce: {expectedColumns}
          </p>
        </div>

        {readError ? <Alert variant="destructive" title={readError} /> : null}

        {preview ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                <span className="text-muted-foreground">Soubor: </span>
                {fileName}
              </span>
              <span>
                <span className="text-muted-foreground">Načteno: </span>
                {recordCount}
              </span>
              {preview.skippedRows > 0 ? (
                <span>
                  <span className="text-muted-foreground">Přeskočeno: </span>
                  {preview.skippedRows}
                </span>
              ) : null}
            </div>

            {preview.matchedColumns.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Rozpoznané sloupce: {preview.matchedColumns.join(", ")}
              </p>
            ) : null}

            {preview.issues.length > 0 ? (
              <Alert
                variant={recordCount === 0 ? "destructive" : "warning"}
                title={`Upozornění (${preview.issues.length})`}
              >
                <ul className="list-disc space-y-0.5 pl-4">
                  {preview.issues.slice(0, 5).map((issue, index) => (
                    <li key={`${issue.row ?? "x"}-${index}`}>
                      {issue.row ? `Řádek ${issue.row}: ` : ""}
                      {issue.message}
                    </li>
                  ))}
                  {preview.issues.length > 5 ? (
                    <li>a dalších {preview.issues.length - 5}…</li>
                  ) : null}
                </ul>
              </Alert>
            ) : null}

            {recordCount > 0 ? (
              <div className="rounded-lg border border-border">
                <TableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {kind === "clients" ? (
                          <>
                            <TableHead>Název</TableHead>
                            <TableHead>IČO</TableHead>
                            <TableHead>Adresa</TableHead>
                            <TableHead>E-mail</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead>Číslo</TableHead>
                            <TableHead>Odběratel</TableHead>
                            <TableHead>Vystaveno</TableHead>
                            <TableHead>Položek</TableHead>
                            <TableHead className="text-right">Celkem</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kind === "clients"
                        ? (preview as ClientPreview).records
                            .slice(0, PREVIEW_ROW_LIMIT)
                            .map((record, index) => (
                              <TableRow key={`${record.name}-${index}`}>
                                <TableCell className="font-medium">
                                  {record.name}
                                </TableCell>
                                <TableCell>{record.ico ?? "—"}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {[
                                    record.street,
                                    [record.postalCode, record.city]
                                      .filter(Boolean)
                                      .join(" "),
                                  ]
                                    .filter(Boolean)
                                    .join(", ") || "—"}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {record.email ?? "—"}
                                </TableCell>
                              </TableRow>
                            ))
                        : (preview as InvoicePreview).records
                            .slice(0, PREVIEW_ROW_LIMIT)
                            .map((record) => (
                              <TableRow key={record.number}>
                                <TableCell className="font-medium">
                                  {record.number}
                                </TableCell>
                                <TableCell>{record.client.name}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {formatDate(record.issueDate)}
                                </TableCell>
                                <TableCell>{record.items.length}</TableCell>
                                <TableCell className="text-right">
                                  {formatCurrency(invoiceTotal(record))}
                                </TableCell>
                              </TableRow>
                            ))}
                    </TableBody>
                  </Table>
                </TableWrapper>

                {recordCount > PREVIEW_ROW_LIMIT ? (
                  <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
                    Náhled ukazuje prvních {PREVIEW_ROW_LIMIT} z {recordCount}{" "}
                    záznamů.
                  </p>
                ) : null}
              </div>
            ) : (
              <Alert
                variant="destructive"
                title="V souboru nejsou žádné použitelné řádky."
              />
            )}

            <form action={action} className="flex items-center gap-3">
              <input
                type="hidden"
                name="payload"
                value={JSON.stringify(preview.records)}
              />
              <SubmitButton count={recordCount} />
              <span className="text-xs text-muted-foreground">
                {kind === "invoices"
                  ? "Faktury s již existujícím číslem se přeskočí."
                  : "Odběratel se stejným IČO se aktualizuje."}
              </span>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            <FileUp className="size-4 shrink-0" aria-hidden="true" />
            Vyberte soubor a zobrazí se náhled ještě před uložením.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
