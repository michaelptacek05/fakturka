-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoicePayment_invoiceId_paidOn_idx" ON "InvoicePayment"("invoiceId", "paidOn");

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: dosud zaplacené faktury dostanou jednu úhradu na celou částku,
-- aby historie plateb odpovídala stavu dokladu i u starých dat.
INSERT INTO "InvoicePayment" ("id", "invoiceId", "amount", "paidOn", "note", "createdAt")
SELECT
    gen_random_uuid()::text,
    "id",
    "total",
    COALESCE("paidAt", "issueDate"),
    NULL,
    CURRENT_TIMESTAMP
FROM "Invoice"
WHERE "status" = 'PAID' AND "total" > 0;

UPDATE "Invoice"
SET "paidAmount" = "total"
WHERE "status" = 'PAID';
