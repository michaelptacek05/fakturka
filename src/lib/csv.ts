/**
 * Malý CSV parser bez závislostí. Běží v prohlížeči (náhled importu)
 * i na serveru (kontrola dat před uložením), takže nesmí sahat na Node API.
 */

export type CsvTable = {
  delimiter: string;
  header: string[];
  rows: string[][];
};

const SUPPORTED_DELIMITERS = [";", ",", "\t", "|"];

/** Oddělovač poznáme podle toho, který dává nejvíc sloupců na prvním řádku. */
function detectDelimiter(sample: string) {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";

  let best = SUPPORTED_DELIMITERS[0];
  let bestCount = 0;

  for (const delimiter of SUPPORTED_DELIMITERS) {
    // Uvozovkované hodnoty můžou oddělovač obsahovat, tak je pro odhad vynecháme.
    const withoutQuoted = firstLine.replace(/"[^"]*"/g, "");
    const count = withoutQuoted.split(delimiter).length - 1;

    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return best;
}

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Fakturoid exportuje v UTF-8, ale ručně upravené soubory z Excelu bývají
 * ve Windows-1250. Když UTF-8 dekódování vyrobí náhradní znaky, zkusíme to znovu.
 */
export function decodeCsvBytes(bytes: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8").decode(bytes);

  if (!utf8.includes("�")) {
    return stripBom(utf8);
  }

  try {
    return stripBom(new TextDecoder("windows-1250").decode(bytes));
  } catch {
    return stripBom(utf8);
  }
}

export function parseCsv(input: string): CsvTable {
  const text = stripBom(input);
  const delimiter = detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (insideQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          insideQuotes = false;
        }
      } else {
        value += char;
      }

      continue;
    }

    if (char === '"') {
      insideQuotes = true;
      continue;
    }

    if (char === delimiter) {
      row.push(value);
      value = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }

  const nonEmptyRows = rows.filter((entry) =>
    entry.some((cell) => cell.trim().length > 0),
  );

  const [header = [], ...dataRows] = nonEmptyRows;

  return {
    delimiter,
    header: header.map((cell) => cell.trim()),
    rows: dataRows,
  };
}

/** Hlavičky porovnáváme bez diakritiky, velikosti písmen a oddělovačů. */
export function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s._-]+/g, "");
}

/**
 * Najde index sloupce podle seznamu přijatelných názvů. Pořadí názvů určuje
 * prioritu, takže první shoda vyhrává.
 */
export function findColumnIndex(header: string[], candidates: string[]) {
  const normalizedHeader = header.map(normalizeHeader);

  for (const candidate of candidates) {
    const index = normalizedHeader.indexOf(normalizeHeader(candidate));

    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

export function getCell(row: string[], index: number) {
  if (index < 0) {
    return "";
  }

  return (row[index] ?? "").trim();
}

/** Escapování pro zápis CSV — používá ho export přehledů. */
export function toCsvValue(value: string) {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
