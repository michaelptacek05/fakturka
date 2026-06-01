"use client";

import Link from "next/link";
import { Download, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { deleteInvoices } from "@/app/actions";
import { Button } from "@/components/ui/button";

type InvoiceBulkRow = {
  clientName: string;
  dueDate: string;
  href: string;
  id: string;
  issueDate: string;
  number: string;
  statusLabel: string;
  total: string;
};

type InvoiceBulkTableProps = {
  invoices: InvoiceBulkRow[];
};

export function InvoiceBulkTable({ invoices }: InvoiceBulkTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedCount = selectedIds.length;
  const allSelected = selectedCount === invoices.length;
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
      className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
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
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-600">
          Vybráno <span className="font-medium text-zinc-950">{selectedCount}</span>{" "}
          z {invoices.length}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" aria-disabled={selectedCount === 0}>
            <Link
              href={selectedCount > 0 ? exportUrl : "#"}
              onClick={(event) => {
                if (selectedCount === 0) {
                  event.preventDefault();
                }
              }}
            >
              <Download className="size-4" aria-hidden="true" />
              Export CSV
            </Link>
          </Button>
          <Button type="submit" variant="destructive" disabled={selectedCount === 0}>
            <Trash2 className="size-4" aria-hidden="true" />
            Smazat vybrané
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead className="bg-zinc-100 text-left text-zinc-600">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                  aria-label="Vybrat všechny faktury"
                />
              </th>
              <th className="px-4 py-3 font-medium">Číslo</th>
              <th className="px-4 py-3 font-medium">Odběratel</th>
              <th className="px-4 py-3 font-medium">Vystaveno</th>
              <th className="px-4 py-3 font-medium">Splatnost</th>
              <th className="px-4 py-3 text-right font-medium">Celkem</th>
              <th className="px-4 py-3 font-medium">Stav</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const checked = selectedIds.includes(invoice.id);

              return (
                <tr className="border-t border-zinc-200" key={invoice.id}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      name="invoiceId"
                      value={invoice.id}
                      checked={checked}
                      onChange={(event) =>
                        toggleInvoice(invoice.id, event.target.checked)
                      }
                      aria-label={`Vybrat fakturu ${invoice.number}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={invoice.href}
                      className="text-zinc-950 underline-offset-4 hover:underline"
                    >
                      {invoice.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {invoice.clientName}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {invoice.issueDate}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{invoice.dueDate}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {invoice.total}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700">
                      {invoice.statusLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
