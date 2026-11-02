export const MAX_IMPORT_ITEMS_PER_INVOICE = 500;
export const MAX_IMPORT_ITEMS = 5000;

/** Sdílené limity náhledu i serveru; existující doklady se nezapisují. */
export function getInvoiceImportLimitError(
  invoices: readonly { number: string; items: readonly unknown[] }[],
  existingNumbers: readonly string[] = [],
): string | null {
  const seen = new Set(existingNumbers);
  let itemCount = 0;

  for (const invoice of invoices) {
    const number = invoice.number.trim();
    if (seen.has(number)) continue;
    seen.add(number);

    if (invoice.items.length > MAX_IMPORT_ITEMS_PER_INVOICE) {
      return `Faktura ${number} má ${invoice.items.length} položek. Limit je ${MAX_IMPORT_ITEMS_PER_INVOICE} položek na fakturu. Rozdělte ji před importem.`;
    }
    itemCount += invoice.items.length;
    if (itemCount > MAX_IMPORT_ITEMS) {
      return `Soubor překračuje limit ${MAX_IMPORT_ITEMS} položek nových faktur. Rozdělte jej na menší soubory.`;
    }
  }

  return null;
}
