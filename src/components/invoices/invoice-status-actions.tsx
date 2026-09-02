"use client";

import { Ban, Check } from "lucide-react";

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
    <>
      {isPaid || isCancelled ? null : (
        <form action={markPaidAction}>
          <Button type="submit" variant="success" size="sm">
            <Check className="size-4" aria-hidden="true" />
            Označit jako zaplacené
          </Button>
        </form>
      )}

      {isCancelled ? null : (
        <form
          action={cancelAction}
          onSubmit={(event) => {
            if (!window.confirm("Opravdu chcete fakturu stornovat?")) {
              event.preventDefault();
            }
          }}
        >
          <Button type="submit" variant="outline" size="sm">
            <Ban className="size-4" aria-hidden="true" />
            Stornovat
          </Button>
        </form>
      )}
    </>
  );
}
