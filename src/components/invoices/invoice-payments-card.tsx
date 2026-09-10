import { Plus, Trash2, Wallet } from "lucide-react";

import { addInvoicePayment, deleteInvoicePayment } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { EmptyState } from "@/components/ui/empty-state";
import { InputField } from "@/components/ui/field";
import { InvoiceStatus } from "@/generated/prisma/enums";
import { formatCurrency, formatDate, formatDateInput } from "@/lib/format";
import {
  fromCents,
  getPaymentSummary,
  toCents,
  type MoneyLike,
} from "@/lib/invoice-payment";

type InvoicePaymentRow = {
  amount: MoneyLike;
  id: string;
  note: string | null;
  paidOn: Date;
};

type InvoicePaymentsCardProps = {
  invoiceId: string;
  paidAmount: MoneyLike;
  payments: InvoicePaymentRow[];
  status: InvoiceStatus;
  total: MoneyLike;
};

export function InvoicePaymentsCard({
  invoiceId,
  paidAmount,
  payments,
  status,
  total,
}: InvoicePaymentsCardProps) {
  const summary = getPaymentSummary({ paidAmount, total });
  const remaining = fromCents(summary.remainingCents);
  // Doplácet nejde na stornovaný ani plně uhrazený doklad. Historii plateb
  // ale ukazujeme vždy — je to jediné místo, odkud jde platba smazat.
  const canAddPayment =
    status !== InvoiceStatus.CANCELLED && summary.remainingCents > 0;

  return (
    <Card className="print-hidden">
      <CardHeader>
        <CardTitle>Úhrady</CardTitle>
        <CardDescription>
          Evidence přijatých plateb. Jakmile jejich součet pokryje celkovou
          částku, faktura se sama označí jako zaplacená.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Celkem", value: formatCurrency(total) },
            {
              label: "Uhrazeno",
              value: formatCurrency(fromCents(summary.paidCents)),
            },
            { label: "Zbývá", value: formatCurrency(remaining) },
          ].map((entry) => (
            <div
              className="rounded-lg border border-border bg-muted/40 p-3"
              key={entry.label}
            >
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {entry.label}
              </dt>
              <dd className="mt-1 text-sm font-medium">{entry.value}</dd>
            </div>
          ))}
        </dl>

        {payments.length === 0 ? (
          <EmptyState
            className="py-8"
            icon={Wallet}
            title="Zatím žádná úhrada"
            description={
              canAddPayment
                ? "Přijatou platbu zapíšete formulářem níže."
                : "K této faktuře není evidovaná žádná platba."
            }
          />
        ) : (
          <ul className="space-y-2">
            {payments.map((payment) => {
              // Vrácení peněz je záporná platba, ať se v příjmech odečte samo.
              const isRefund = toCents(payment.amount) < 0;

              return (
              <li
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3"
                key={payment.id}
              >
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      isRefund ? "text-destructive" : ""
                    }`}
                  >
                    {formatCurrency(payment.amount)}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {formatDate(payment.paidOn)}
                    </span>
                  </p>
                  {payment.note ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {payment.note}
                    </p>
                  ) : null}
                </div>
                <ConfirmForm
                  action={deleteInvoicePayment.bind(null, payment.id)}
                  message="Opravdu chcete úhradu smazat?"
                >
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Smazat ${
                      isRefund ? "vrácení" : "úhradu"
                    } z ${formatDate(payment.paidOn)}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </ConfirmForm>
              </li>
              );
            })}
          </ul>
        )}

        {canAddPayment ? (
          <form
            action={addInvoicePayment.bind(null, invoiceId)}
            className="space-y-4 border-t border-border pt-5"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <InputField
                label="Částka"
                name="amount"
                required
                inputMode="decimal"
                defaultValue={remaining.toFixed(2)}
                hint={`Nejvýš ${formatCurrency(remaining)}`}
              />
              <InputField
                label="Datum úhrady"
                name="paidOn"
                type="date"
                defaultValue={formatDateInput(new Date())}
              />
              <InputField
                label="Poznámka"
                name="note"
                placeholder="Např. bankovní převod"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm">
                <Plus className="size-4" aria-hidden="true" />
                Zaevidovat úhradu
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
