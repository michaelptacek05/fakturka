/**
 * Mapování CSV exportu z Fakturoidu na datový model Fakturky.
 *
 * Fakturoid pojmenovává sloupce podle svého API (`name`, `registration_no`,
 * `issued_on`, `lines__line__unit_price` …). Kromě nich poznáme i běžné české
 * hlavičky, aby prošel i ručně sestavený soubor z Excelu.
 *
 * Modul je čistě funkční a bez závislostí na Node ani na Prismě — používá ho
 * jak náhled v prohlížeči, tak kontrola dat na serveru.
 */

import { findColumnIndex, getCell, parseCsv } from "@/lib/csv";

export type ImportedClient = {
  city: string;
  country: string;
  dic: string | null;
  email: string | null;
  ico: string | null;
  name: string;
  phone: string | null;
  postalCode: string;
  street: string;
};

export type ImportedInvoiceItem = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
};

export type ImportedInvoiceStatus = "CANCELLED" | "ISSUED" | "PAID";

export type ImportedInvoice = {
  client: ImportedClient;
  currency: string;
  dueDate: string | null;
  issueDate: string;
  items: ImportedInvoiceItem[];
  notes: string | null;
  number: string;
  paidAt: string | null;
  reportedTotal: number | null;
  status: ImportedInvoiceStatus;
  taxableSupplyDate: string | null;
  variableSymbol: string | null;
};

export type ImportIssue = {
  message: string;
  row: number | null;
};

export type ImportPreview<TRecord> = {
  issues: ImportIssue[];
  matchedColumns: string[];
  missingColumns: string[];
  records: TRecord[];
  skippedRows: number;
  totalRows: number;
};

/** Maximum, které pustíme do jednoho importu, ať nezahltíme server action. */
export const MAX_IMPORT_ROWS = 5000;

const CLIENT_COLUMNS = {
  city: ["city", "mesto", "obec"],
  country: ["country", "zeme", "stat"],
  dic: ["vat_no", "dic", "vat_number"],
  email: ["email", "e-mail"],
  ico: ["registration_no", "ico", "ic"],
  name: ["name", "nazev", "jmeno", "obchodni_jmeno", "firma", "client_name"],
  phone: ["phone", "telefon", "mobile"],
  postalCode: ["zip", "psc", "postal_code", "postcode"],
  street: ["street", "ulice", "adresa"],
} as const;

const INVOICE_COLUMNS = {
  city: ["client_city", "city", "mesto", "obec"],
  country: ["client_country", "country", "zeme", "stat"],
  currency: ["currency", "mena"],
  dic: ["client_vat_no", "vat_no", "dic"],
  dueDate: ["due_on", "due_date", "datum_splatnosti", "splatnost"],
  email: ["client_email", "email", "e-mail"],
  ico: ["client_registration_no", "registration_no", "ico", "ic"],
  issueDate: ["issued_on", "issue_date", "datum_vystaveni", "vystaveno"],
  itemName: ["lines__line__name", "line_name", "polozka", "nazev_polozky"],
  itemQuantity: ["lines__line__quantity", "line_quantity", "mnozstvi", "pocet"],
  itemUnit: ["lines__line__unit_name", "line_unit", "jednotka", "mj"],
  itemUnitPrice: [
    "lines__line__unit_price",
    "line_unit_price",
    "cena_za_jednotku",
    "jednotkova_cena",
  ],
  itemVatRate: ["lines__line__vat_rate", "line_vat_rate", "dph", "sazba_dph"],
  name: ["client_name", "subject_name", "odberatel", "nazev", "name"],
  notes: ["note", "poznamka", "text"],
  number: ["number", "invoice_number", "cislo", "cislo_faktury", "doklad"],
  paidAt: ["paid_on", "paid_at", "datum_uhrady", "uhrazeno", "zaplaceno"],
  postalCode: ["client_zip", "zip", "psc", "postal_code"],
  status: ["status", "stav"],
  street: ["client_street", "street", "ulice"],
  taxableSupplyDate: [
    "taxable_fulfillment_due",
    "duzp",
    "datum_zdanitelneho_plneni",
  ],
  total: ["total", "celkem", "celkem_s_dph", "castka"],
  variableSymbol: ["variable_symbol", "variabilni_symbol", "vs"],
} as const;

/**
 * Čísla přicházejí v české i anglické notaci ("1 234,56" i "1234.56").
 * Rozhoduje poslední oddělovač v řetězci.
 */
export function parseImportedNumber(value: string) {
  const cleaned = value.replace(/[\s '"]/g, "").replace(/[A-Za-zČčKk]+$/, "");

  if (cleaned.length === 0) {
    return null;
  }

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma !== -1 && lastDot !== -1) {
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

/** Vrací datum jako ISO řetězec `YYYY-MM-DD`, nebo null. */
export function parseImportedDate(value: string) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const czechMatch = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(trimmed);

  if (czechMatch) {
    const day = czechMatch[1].padStart(2, "0");
    const month = czechMatch[2].padStart(2, "0");

    return `${czechMatch[3]}-${month}-${day}`;
  }

  return null;
}

function parseStatus(value: string, paidAt: string | null): ImportedInvoiceStatus {
  const normalized = value.trim().toLowerCase();

  if (normalized === "cancelled" || normalized === "canceled" || normalized === "storno") {
    return "CANCELLED";
  }

  if (normalized === "paid" || normalized === "zaplaceno" || normalized === "uhrazeno") {
    return "PAID";
  }

  return paidAt ? "PAID" : "ISSUED";
}

function normalizeCountry(value: string) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "Česká republika";
  }

  // Fakturoid ukládá zemi jako ISO kód.
  if (/^cz$/i.test(trimmed)) {
    return "Česká republika";
  }

  if (/^sk$/i.test(trimmed)) {
    return "Slovensko";
  }

  return trimmed;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

type ColumnMap<TKeys extends string> = Record<TKeys, number>;

function resolveColumns<TKeys extends string>(
  header: string[],
  definition: Record<TKeys, readonly string[]>,
) {
  const map = {} as ColumnMap<TKeys>;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const key of Object.keys(definition) as TKeys[]) {
    const index = findColumnIndex(header, [...definition[key]]);

    map[key] = index;

    if (index === -1) {
      missing.push(key);
    } else {
      matched.push(header[index]);
    }
  }

  return { map, matched, missing };
}

export function previewClientImport(
  csvText: string,
): ImportPreview<ImportedClient> {
  const table = parseCsv(csvText);
  const issues: ImportIssue[] = [];

  if (table.header.length === 0) {
    return {
      issues: [{ message: "Soubor neobsahuje hlavičku se sloupci.", row: null }],
      matchedColumns: [],
      missingColumns: [],
      records: [],
      skippedRows: 0,
      totalRows: 0,
    };
  }

  const { map, matched, missing } = resolveColumns(table.header, CLIENT_COLUMNS);

  if (map.name === -1) {
    issues.push({
      message:
        "Chybí sloupec s názvem odběratele. Očekává se 'name' nebo 'nazev'.",
      row: null,
    });
  }

  const records: ImportedClient[] = [];
  let skippedRows = 0;

  table.rows.forEach((row, index) => {
    const rowNumber = index + 2;

    if (records.length >= MAX_IMPORT_ROWS) {
      skippedRows += 1;
      return;
    }

    const name = getCell(row, map.name);

    if (name.length === 0) {
      skippedRows += 1;
      issues.push({ message: "Řádek nemá název odběratele.", row: rowNumber });
      return;
    }

    records.push({
      city: getCell(row, map.city),
      country: normalizeCountry(getCell(row, map.country)),
      dic: emptyToNull(getCell(row, map.dic)),
      email: emptyToNull(getCell(row, map.email)),
      ico: emptyToNull(getCell(row, map.ico).replace(/\D/g, "")),
      name,
      phone: emptyToNull(getCell(row, map.phone)),
      postalCode: getCell(row, map.postalCode),
      street: getCell(row, map.street),
    });
  });

  return {
    issues,
    matchedColumns: matched,
    missingColumns: missing,
    records,
    skippedRows,
    totalRows: table.rows.length,
  };
}

export function previewInvoiceImport(
  csvText: string,
): ImportPreview<ImportedInvoice> {
  const table = parseCsv(csvText);
  const issues: ImportIssue[] = [];

  if (table.header.length === 0) {
    return {
      issues: [{ message: "Soubor neobsahuje hlavičku se sloupci.", row: null }],
      matchedColumns: [],
      missingColumns: [],
      records: [],
      skippedRows: 0,
      totalRows: 0,
    };
  }

  const { map, matched, missing } = resolveColumns(table.header, INVOICE_COLUMNS);

  if (map.number === -1) {
    issues.push({
      message: "Chybí sloupec s číslem faktury. Očekává se 'number' nebo 'cislo'.",
      row: null,
    });
  }

  if (map.issueDate === -1) {
    issues.push({
      message:
        "Chybí sloupec s datem vystavení. Očekává se 'issued_on' nebo 'datum_vystaveni'.",
      row: null,
    });
  }

  const hasLineColumns = map.itemName !== -1 || map.itemUnitPrice !== -1;
  const byNumber = new Map<string, ImportedInvoice>();
  let lastNumber = "";
  let skippedRows = 0;

  table.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const cellNumber = getCell(row, map.number);
    // Položkové exporty opakují číslo jen na prvním řádku faktury.
    const number = cellNumber.length > 0 ? cellNumber : lastNumber;

    if (number.length === 0) {
      skippedRows += 1;
      issues.push({ message: "Řádek nemá číslo faktury.", row: rowNumber });
      return;
    }

    lastNumber = number;

    let invoice = byNumber.get(number);

    if (!invoice) {
      if (byNumber.size >= MAX_IMPORT_ROWS) {
        skippedRows += 1;
        return;
      }

      const issueDate = parseImportedDate(getCell(row, map.issueDate));

      if (!issueDate) {
        skippedRows += 1;
        issues.push({
          message: `Faktura ${number} nemá čitelné datum vystavení.`,
          row: rowNumber,
        });
        return;
      }

      const paidAt = parseImportedDate(getCell(row, map.paidAt));
      const currency = getCell(row, map.currency).toUpperCase() || "CZK";

      if (currency !== "CZK") {
        issues.push({
          message: `Faktura ${number} je v měně ${currency}. Přehledy a QR platba počítají s CZK.`,
          row: rowNumber,
        });
      }

      invoice = {
        client: {
          city: getCell(row, map.city),
          country: normalizeCountry(getCell(row, map.country)),
          dic: emptyToNull(getCell(row, map.dic)),
          email: emptyToNull(getCell(row, map.email)),
          ico: emptyToNull(getCell(row, map.ico).replace(/\D/g, "")),
          name: getCell(row, map.name),
          phone: null,
          postalCode: getCell(row, map.postalCode),
          street: getCell(row, map.street),
        },
        currency,
        dueDate: parseImportedDate(getCell(row, map.dueDate)),
        issueDate,
        items: [],
        notes: emptyToNull(getCell(row, map.notes)),
        number,
        paidAt,
        reportedTotal: parseImportedNumber(getCell(row, map.total)),
        status: parseStatus(getCell(row, map.status), paidAt),
        taxableSupplyDate: parseImportedDate(
          getCell(row, map.taxableSupplyDate),
        ),
        variableSymbol: emptyToNull(
          getCell(row, map.variableSymbol).replace(/\D/g, ""),
        ),
      };

      byNumber.set(number, invoice);
    }

    if (!hasLineColumns) {
      return;
    }

    const itemName = getCell(row, map.itemName);
    const unitPrice = parseImportedNumber(getCell(row, map.itemUnitPrice));

    if (itemName.length === 0 && unitPrice === null) {
      return;
    }

    const quantity = parseImportedNumber(getCell(row, map.itemQuantity));

    invoice.items.push({
      name: itemName.length > 0 ? itemName : "Fakturovaná položka",
      quantity: quantity && quantity > 0 ? quantity : 1,
      unit: getCell(row, map.itemUnit) || "ks",
      unitPrice: unitPrice ?? 0,
      vatRate: parseImportedNumber(getCell(row, map.itemVatRate)) ?? 0,
    });
  });

  const records: ImportedInvoice[] = [];

  for (const invoice of byNumber.values()) {
    if (invoice.client.name.length === 0) {
      invoice.client.name = "Neznámý odběratel";
      issues.push({
        message: `Faktura ${invoice.number} nemá odběratele, doplní se zástupný název.`,
        row: null,
      });
    }

    // Bez položkových sloupců uděláme z celkové částky jednu položku,
    // aby faktura seděla součtem i bez detailního rozpisu.
    if (invoice.items.length === 0) {
      if (invoice.reportedTotal === null) {
        issues.push({
          message: `Faktura ${invoice.number} nemá položky ani celkovou částku, přeskočena.`,
          row: null,
        });
        continue;
      }

      invoice.items.push({
        name: invoice.notes ?? `Fakturace ${invoice.number}`,
        quantity: 1,
        unit: "ks",
        unitPrice: invoice.reportedTotal,
        vatRate: 0,
      });
    }

    records.push(invoice);
  }

  return {
    issues,
    matchedColumns: matched,
    missingColumns: missing,
    records,
    skippedRows,
    totalRows: table.rows.length,
  };
}
