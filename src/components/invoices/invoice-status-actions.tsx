"use client";

import { cancelInvoice, markInvoicePaid } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { InvoiceStatus } from "@/generated/prisma/enums";

type InvoiceStatusActionsProps = {
  invoiceId: string;
  status: InvoiceStatus;
};

export function InvoiceStatusActions({
  invoiceId,
  status,
}: InvoiceStatusActionsProps) {
  const markPaidAction = markInvoicePaid.bind(null, invoiceId);
  const cancelAction = cancelInvoice.bind(null, invoiceId);

  const isCancelled = status === InvoiceStatus.CANCELLED;
  const isPaid = status === InvoiceStatus.PAID;

  return (
    <div className="flex flex-wrap gap-2">
      {isPaid ? (
        <Button type="button" variant="outline" disabled>
          Označeno jako zaplacené
        </Button>
      ) : isCancelled ? (
        <Button type="button" variant="outline" disabled>
          Nelze označit jako zaplacené
        </Button>
      ) : (
        <form action={markPaidAction}>
          <Button type="submit">Označit jako zaplacené</Button>
        </form>
      )}

      {isCancelled ? (
        <Button type="button" variant="outline" disabled>
          Stornováno
        </Button>
      ) : (
        <form
          action={cancelAction}
          onSubmit={(event) => {
            if (!window.confirm("Opravdu chcete fakturu stornovat?")) {
              event.preventDefault();
            }
          }}
        >
          <Button type="submit" variant="destructive">
            Stornovat
          </Button>
        </form>
      )}
    </div>
  );
}
