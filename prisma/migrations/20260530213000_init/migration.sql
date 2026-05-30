CREATE TYPE "VatPayerStatus" AS ENUM ('NON_PAYER', 'PAYER');

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'OVERDUE');

CREATE TYPE "InvoiceAssetType" AS ENUM ('LOGO', 'SIGNATURE', 'STAMP');

CREATE TABLE "UserProfile" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "companyName" TEXT,
  "street" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'Česká republika',
  "ico" VARCHAR(16) NOT NULL,
  "dic" VARCHAR(20),
  "registryText" TEXT,
  "vatPayerStatus" "VatPayerStatus" NOT NULL DEFAULT 'NON_PAYER',
  "accountNumber" TEXT NOT NULL,
  "bankCode" VARCHAR(10) NOT NULL,
  "iban" TEXT,
  "swift" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "companyName" TEXT,
  "fullName" TEXT,
  "street" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'Česká republika',
  "ico" VARCHAR(16),
  "dic" VARCHAR(20),
  "email" TEXT,
  "phone" TEXT,
  "aresSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceSequence" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Výchozí',
  "format" TEXT NOT NULL DEFAULT 'YYYYMM###',
  "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "sequenceId" TEXT,
  "number" TEXT NOT NULL,
  "variableSymbol" TEXT NOT NULL,
  "constantSymbol" TEXT,
  "specificSymbol" TEXT,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "issueDate" TIMESTAMP(3) NOT NULL,
  "taxableSupplyDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'CZK',
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vatTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "qrPaymentPayload" TEXT,
  "pdfPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'ks',
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "lineSubtotal" DECIMAL(12,2) NOT NULL,
  "lineVat" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(12,2) NOT NULL,

  CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceAsset" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "type" "InvoiceAssetType" NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InvoiceAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Client_profileId_idx" ON "Client"("profileId");
CREATE INDEX "Client_ico_idx" ON "Client"("ico");
CREATE INDEX "InvoiceSequence_profileId_idx" ON "InvoiceSequence"("profileId");
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");
CREATE INDEX "Invoice_profileId_status_idx" ON "Invoice"("profileId", "status");
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");
CREATE UNIQUE INDEX "Invoice_profileId_number_key" ON "Invoice"("profileId", "number");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceAsset_profileId_type_idx" ON "InvoiceAsset"("profileId", "type");

ALTER TABLE "Client" ADD CONSTRAINT "Client_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "InvoiceSequence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceAsset" ADD CONSTRAINT "InvoiceAsset_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
