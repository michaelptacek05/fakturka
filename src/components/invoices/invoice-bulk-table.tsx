"use client";

import Link from "next/link";
import { Download, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { deleteInvoices } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import type { InvoiceVisualState } from "@/lib/invoice-payment";
import { cn } from "@/lib/utils";

type InvoiceBulkRow = {
  clientName: string;
  dueDate: string;
  href: string;
  id: string;
  issueDate: string;
  number: string;
  /** Jen u částečně uhrazené faktury — doplní se pod celkovou částku. */
  remaining?: string;
  statusLabel: string;
  total: string;
  visualState: InvoiceVisualState;
};

type InvoiceBulkTableProps = {
  invoices: InvoiceBulkRow[];
};

/** Barevný proužek na začátku řádku nese stav i bez čtení textu. */
const rowAccent: Record<InvoiceVisualState, string> = {
  cancelled: "before:bg-transparent opacity-60",
  default: "before:bg-transparent",
  overdue: "before:bg-destructive",
  paid: "before:bg-success",
  partial: "before:bg-warning",
  unpaid: "before:bg-warning",
};

const badgeVariant: Record<
  InvoiceVisualState,
  "default" | "success" | "warning" | "destructive" | "outline"
> = {
  cancelled: "outline",
  default: "default",
  overdue: "destructive",
  paid: "success",
  partial: "warning",
  unpaid: "warning",
};

export function InvoiceBulkTable({ invoices }: InvoiceBulkTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedCount = selectedIds.length;
  const allSelected = selectedCount > 0 && selectedCount === invoices.length;
  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();

    selectedIds.forEach((id) => params.append("ids", id));

    return `/invoices/export?${params.toString()}`;
  }, [selectedIds]);

  function toggleInvoice(invoiceId: string, checked: boolean) {
    setSelectedIds((currentIds) =>
      checked
        ? [...currentIds, invoiceId]
        : currentIds.filter((id) => id !== invoiceId),
    );
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? invoices.map((invoice) => invoice.id) : []);
  }

  return (
    <form
      action={deleteInvoices}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
      onSubmit={(event) => {
        if (selectedCount === 0) {
          event.preventDefault();
          return;
        }

        if (
          !window.confirm(
            `Opravdu chcete smazat vybrané faktury (${selectedCount})? Tato akce nejde vrátit zpět.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Vybráno{" "}
          <span className="font-medium text-foreground">{selectedCount}</span> z{" "}
          {invoices.length}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            aria-disabled={selectedCount === 0}
            className={selectedCount === 0 ? "pointer-events-none opacity-50" : ""}
          >
            <Link href={selectedCount > 0 ? exportUrl : "#"}>
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Link>
          </Button>
          <Button
            type="submit"
            variant="destructive"
            size="sm"
            disabled={selectedCount === 0}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Smazat vybrané
          </Button>
        </div>
      </div>

      <TableWrapper>
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                  aria-label="Vybrat všechny faktury"
                />
              </TableHead>
              <TableHead>Číslo</TableHead>
              <TableHead>Odběratel</TableHead>
              <TableHead>Vystaveno</TableHead>
              <TableHead>Splatnost</TableHead>
              <TableHead className="text-right">Celkem</TableHead>
              <TableHead>Stav</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow
                key={invoice.id}
                className={cn(
                  "relative before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
                  rowAccent[invoice.visualState],
                )}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    name="invoiceId"
                    value={invoice.id}
                    checked={selectedIds.includes(invoice.id)}
                    onChange={(event) =>
                      toggleInvoice(invoice.id, event.target.checked)
                    }
                    aria-label={`Vybrat fakturu ${invoice.number}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    href={invoice.href}
                    className="underline-offset-4 hover:underline"
                  >
                    {invoice.number}
                  </Link>
                </TableCell>
                <TableCell>{invoice.clientName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {invoice.issueDate}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {invoice.dueDate}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {invoice.total}
                  {invoice.remaining ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      zbývá {invoice.remaining}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge variant={badgeVariant[invoice.visualState]}>
                    {invoice.statusLabel}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>
    </form>
  );
}
