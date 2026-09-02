-- Snapshot odběratele přímo na faktuře.
-- Vystavený doklad se nesmí měnit, když se později upraví adresář odběratelů.
ALTER TABLE "Invoice"
  ADD COLUMN "clientName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "clientStreet" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "clientCity" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "clientPostalCode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "clientCountry" TEXT NOT NULL DEFAULT 'Česká republika',
  ADD COLUMN "clientIco" VARCHAR(16),
  ADD COLUMN "clientDic" VARCHAR(20),
  ADD COLUMN "clientEmail" TEXT;

-- Existující faktury naplníme z aktuálního stavu odběratele.
UPDATE "Invoice" AS i
SET
  "clientName" = COALESCE(NULLIF(c."companyName", ''), NULLIF(c."fullName", ''), ''),
  "clientStreet" = c."street",
  "clientCity" = c."city",
  "clientPostalCode" = c."postalCode",
  "clientCountry" = c."country",
  "clientIco" = c."ico",
  "clientDic" = c."dic",
  "clientEmail" = c."email"
FROM "Client" AS c
WHERE c."id" = i."clientId";

-- Číselná řada se resetuje na začátku každého období podle formátu čísla.
ALTER TABLE "InvoiceSequence"
  ADD COLUMN "periodKey" TEXT NOT NULL DEFAULT '';

-- Období odvodíme z poslední vystavené faktury, aby upgrade nezpůsobil
-- nechtěný reset uprostřed rozjeté řady.
UPDATE "InvoiceSequence" AS s
SET "periodKey" = CASE
    WHEN s."format" LIKE '%MM%' THEN to_char(latest."issueDate", 'YYYYMM')
    WHEN s."format" LIKE '%YYYY%' THEN to_char(latest."issueDate", 'YYYY')
    ELSE ''
  END
FROM (
  SELECT "sequenceId", MAX("issueDate") AS "issueDate"
  FROM "Invoice"
  WHERE "sequenceId" IS NOT NULL
  GROUP BY "sequenceId"
) AS latest
WHERE latest."sequenceId" = s."id";
