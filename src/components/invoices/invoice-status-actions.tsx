"use client";

import * as React from "react";
import { Ban, Check, Undo2 } from "lucide-react";

import { cancelInvoice, markInvoicePaid } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { InvoiceStatus } from "@/generated/prisma/enums";
import { formatCurrency } from "@/lib/format";
import { fromCents } from "@/lib/invoice-payment";

type InvoiceStatusActionsProps = {
  invoiceId: string;
  /** Uhrazeno v haléřích. Prisma Decimal přes hranici klienta neprojde. */
  paidCents: number;
  status: InvoiceStatus;
};

export function InvoiceStatusActions({
  invoiceId,
  paidCents,
  status,
}: InvoiceStatusActionsProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const markPaidAction = markInvoicePaid.bind(null, invoiceId);
  const cancelAction = cancelInvoice.bind(null, invoiceId);

  const isCancelled = status === InvoiceStatus.CANCELLED;
  const isPaid = status === InvoiceStatus.PAID;
  // Bez přijaté úhrady není co řešit, stačí prosté potvrzení.
  const hasPayment = paidCents > 0;

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

      {isCancelled ? null : hasPayment ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => dialogRef.current?.showModal()}
          >
            <Ban className="size-4" aria-hidden="true" />
            Stornovat
          </Button>

          <dialog
            ref={dialogRef}
            className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50"
            onClick={(event) => {
              // Kliknutí mimo panel dialog zavře, kliknutí uvnitř ne.
              if (event.target === dialogRef.current) {
                dialogRef.current?.close();
              }
            }}
          >
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  Stornovat fakturu
                </h2>
                <p className="text-sm text-muted-foreground">
                  Na faktuře je evidovaná úhrada{" "}
                  <strong className="text-foreground">
                    {formatCurrency(fromCents(paidCents))}
                  </strong>
                  . Storno zruší doklad, ale s penězi nic neudělá — proto
                  potřebujeme vědět, jestli jste je odběrateli vrátili.
                </p>
                <p className="text-sm text-muted-foreground">
                  Vrácení se zapíše jako záporná platba, takže se částka odečte
                  z příjmů. Pokud si peníze necháváte, zůstanou v příjmech
                  započítané.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => dialogRef.current?.close()}
                >
                  Zpět
                </Button>

                <form action={cancelAction}>
                  <input type="hidden" name="refund" value="0" />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <Ban className="size-4" aria-hidden="true" />
                    Peníze si necháváme
                  </Button>
                </form>

                <form action={cancelAction}>
                  <input type="hidden" name="refund" value="1" />
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    <Undo2 className="size-4" aria-hidden="true" />
                    Vrátili jsme je
                  </Button>
                </form>
              </div>
            </div>
          </dialog>
        </>
      ) : (
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
