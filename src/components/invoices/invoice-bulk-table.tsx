"use client";

import Link from "next/link";
import { Download, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { deleteInvoices } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
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
  const [selection, setSelectedIds] = useState<string[]>([]);
  const selectedIds = useMemo(() => {
    const visibleIds = new Set(invoices.map((invoice) => invoice.id));
    return selection.filter((id) => visibleIds.has(id));
  }, [invoices, selection]);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectedCount = selectedIds.length;
  const allSelected = selectedCount > 0 && selectedCount === invoices.length;
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [allSelected, selectedCount]);
  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();

    selectedIds.forEach((id) => params.append("ids", id));

    return `/invoices/export?${params.toString()}`;
  }, [selectedIds]);

  function toggleInvoice(invoiceId: string, checked: boolean) {
    setSelectedIds((currentIds) =>
      checked
        ? Array.from(new Set([...currentIds, invoiceId]))
        : currentIds.filter((id) => id !== invoiceId),
    );
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? invoices.map((invoice) => invoice.id) : []);
  }

  return (
    <form
      action={deleteInvoices}
      className="overflow-hidden rounded-xl border border-border bg-card"
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
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="invoiceId" value={id} />
      ))}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm sm:min-h-9">
            <input
              ref={selectAllRef}
              type="checkbox"
              className="size-4 accent-primary"
              checked={allSelected}
              onChange={(event) => toggleAll(event.target.checked)}
              aria-label="Vybrat všechny faktury"
            />
            Vybrat vše
          </label>
          <p className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
            {selectedCount > 0 ? (
              <>Vybráno <span className="font-medium text-foreground">{selectedCount}</span> z {invoices.length}</>
            ) : (
              <>{invoices.length} faktur</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedCount > 0 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={exportUrl}>
                <Download className="size-4" aria-hidden="true" />
                Export CSV
              </Link>
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled>
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Button>
          )}
          {/* Plná destruktivní barva až ve chvíli, kdy je co mazat. */}
          <SubmitButton
            type="submit"
            variant="destructive-outline"
            pendingLabel="Mažu…"
            size="sm"
            disabled={selectedCount === 0}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Smazat vybrané
          </SubmitButton>
        </div>
      </div>

      <ul className="divide-y divide-border md:hidden" aria-label="Seznam faktur">
        {invoices.map((invoice) => (
          <li key={invoice.id} className={cn("flex gap-2 p-4", selectedIds.includes(invoice.id) && "bg-accent/40")}>
            <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selectedIds.includes(invoice.id)}
                onChange={(event) => toggleInvoice(invoice.id, event.target.checked)}
                aria-label={`Vybrat fakturu ${invoice.number}`}
              />
            </label>
            <div className="min-w-0 flex-1 space-y-2">
              <Link href={invoice.href} className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 font-semibold">
                  <span>{invoice.number}</span>
                  <span className="tabular-nums">{invoice.total}</span>
                </div>
                <p className="mt-1 break-words text-sm text-muted-foreground">{invoice.clientName}</p>
              </Link>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge dot variant={badgeVariant[invoice.visualState]}>{invoice.statusLabel}</Badge>
                <span className="text-xs text-muted-foreground">Splatnost {invoice.dueDate}</span>
              </div>
              {invoice.remaining ? <p className="text-xs text-muted-foreground">Zbývá {invoice.remaining}</p> : null}
            </div>
          </li>
        ))}
      </ul>

      <TableWrapper className="hidden md:block">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12"><span className="sr-only">Výběr</span></TableHead>
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
                  selectedIds.includes(invoice.id) && "bg-accent/40",
                )}
              >
                <TableCell>
                  <label className="flex size-9 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selectedIds.includes(invoice.id)}
                    onChange={(event) =>
                      toggleInvoice(invoice.id, event.target.checked)
                    }
                    aria-label={`Vybrat fakturu ${invoice.number}`}
                  />
                  </label>
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
                <TableCell className="tabular-nums text-muted-foreground">
                  {invoice.issueDate}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {invoice.dueDate}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {invoice.total}
                  {invoice.remaining ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      zbývá {invoice.remaining}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>
                  <Badge dot variant={badgeVariant[invoice.visualState]}>
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
