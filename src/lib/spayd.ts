type SpaydPaymentInput = {
  accountNumber: string;
  amount: number | string | { toString(): string };
  bankCode: string;
  currency?: string;
  dueDate?: Date | string | null;
  iban?: string | null;
  includeBic?: boolean;
  message?: string | null;
  swift?: string | null;
  variableSymbol?: string | null;
};

type BankProfileInput = {
  accountNumber: string;
  bankCode: string;
  iban?: string | null;
  swift?: string | null;
};

const CZECH_ACCOUNT_WEIGHTS = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];
const CZECH_BANK_BIC: Record<string, string> = {
  "0100": "KOMBCZPP",
  "0300": "CEKOCZPP",
  "0600": "AGBACZPP",
  "0710": "CNBACZPP",
  "0800": "GIBACZPX",
  "2010": "FIOBCZPP",
  "2020": "BOTKCZPP",
  "2030": "MIDLGB22",
  "2060": "CITFCZPP",
  "2070": "MPUBCZPP",
  "2100": "BPPFCZP1",
  "2200": "ABNACZPP",
  "2250": "CTASCZ22",
  "2260": "ZUNOCZPP",
  "2600": "CITICZPX",
  "2700": "BACXCZPP",
  "3030": "AIRACZPP",
  "3050": "BPKOCZPP",
  "3060": "BPKOCZPP",
  "3500": "INGBCZPP",
  "4000": "EXPNCZPP",
  "4300": "CMZRCZP1",
  "5500": "RZBCCZPP",
  "5800": "JTBPCZPP",
  "6000": "PMBPCZPP",
  "6100": "EQBKCZPP",
  "6210": "BREXCZPP",
  "6300": "GEBACZPP",
  "6700": "SUBACZPP",
  "6800": "VBOECZ2X",
  "7910": "DEUTCZPX",
  "7940": "SPWTCZ21",
  "7950": "SIDTCZPP",
  "7960": "GENOCZ21",
  "7970": "WBPCCZPP",
  "7980": "GRESCZPP",
  "8030": "GENOCZ21",
  "8040": "OBKLCZ2X",
  "8060": "STENCZPP",
  "8090": "CZEECZPP",
  "8150": "MIDLCZPP",
  "8198": "FFCSCZP1",
  "8199": "FFCSCZP1",
  "8200": "POBNCZPP",
  "8250": "BKCHCZPP",
};

function normalizeAccountPart(value: string, length: number) {
  return value.replace(/\D/g, "").padStart(length, "0").slice(-length);
}

function mod97(value: string) {
  let remainder = 0;

  for (const char of value) {
    remainder = (remainder * 10 + Number(char)) % 97;
  }

  return remainder;
}

function formatCzechIban(accountNumber: string, bankCode: string) {
  const [prefix = "", number = ""] = accountNumber.includes("-")
    ? accountNumber.split("-", 2)
    : ["", accountNumber];
  const bban = `${normalizeAccountPart(bankCode, 4)}${normalizeAccountPart(
    prefix,
    6,
  )}${normalizeAccountPart(number, 10)}`;
  const checksum = String(98 - mod97(`${bban}123500`)).padStart(2, "0");

  return `CZ${checksum}${bban}`;
}

export function getExpectedCzechBic(bankCode: string) {
  return CZECH_BANK_BIC[bankCode.replace(/\D/g, "")] ?? null;
}

function normalizeBic(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s/g, "").toUpperCase();

  return /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(normalized)
    ? normalized
    : null;
}

function validateCzechAccountPart(value: string, length: number) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return true;
  }

  if (digits.length > length) {
    return false;
  }

  const padded = digits.padStart(length, "0");
  const weights = CZECH_ACCOUNT_WEIGHTS.slice(10 - length);
  const sum = padded
    .split("")
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);

  return sum % 11 === 0;
}

export function isValidCzechAccountNumber(
  accountNumber: string,
  bankCode: string,
) {
  const normalizedBankCode = bankCode.replace(/\D/g, "");
  const [prefix = "", number = ""] = accountNumber.includes("-")
    ? accountNumber.split("-", 2)
    : ["", accountNumber];
  const normalizedNumber = number.replace(/\D/g, "");

  return (
    /^\d{4}$/.test(normalizedBankCode) &&
    normalizedNumber.length >= 2 &&
    normalizedNumber.length <= 10 &&
    validateCzechAccountPart(prefix, 6) &&
    validateCzechAccountPart(number, 10)
  );
}

function normalizeIban(iban: string) {
  return iban.replace(/\s/g, "").toUpperCase();
}

export function getPaymentIban({
  accountNumber,
  bankCode,
  iban,
}: BankProfileInput) {
  return isValidIban(iban)
    ? normalizeIban(iban ?? "")
    : formatCzechIban(accountNumber, bankCode);
}

function ibanToNumber(value: string) {
  return value
    .slice(4)
    .concat(value.slice(0, 4))
    .replace(/[A-Z]/g, (char) => String(char.charCodeAt(0) - 55));
}

export function isValidIban(iban: string | null | undefined) {
  if (!iban) {
    return false;
  }

  const normalized = normalizeIban(iban);

  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalized)) {
    return false;
  }

  if (normalized.startsWith("CZ") && normalized.length !== 24) {
    return false;
  }

  return mod97(ibanToNumber(normalized)) === 1;
}

function normalizeSpaydText(value: string, maxLength: number) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^0-9A-Z $%*+\-./:]/g, " ")
    .replace(/\*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeSpaydPayload(payload: string) {
  return payload
    .replace(/[\r\n\t]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function formatSpaydDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

export function buildSpaydPayload({
  accountNumber,
  amount,
  bankCode,
  currency = "CZK",
  dueDate,
  iban,
  includeBic = false,
  message,
  swift,
  variableSymbol,
}: SpaydPaymentInput) {
  const ibanAccount = getPaymentIban({ accountNumber, bankCode, iban });
  const bic = includeBic
    ? getExpectedCzechBic(bankCode) ?? normalizeBic(swift)
    : null;
  const account = bic ? `${ibanAccount}+${bic}` : ibanAccount;
  const amountValue = Number(amount.toString());
  const parts = [
    "SPD",
    "1.0",
    `ACC:${account}`,
    `AM:${amountValue.toFixed(2)}`,
    `CC:${currency.toUpperCase()}`,
  ];
  const normalizedVariableSymbol = variableSymbol?.replace(/\D/g, "");

  if (dueDate) {
    const formattedDueDate = formatSpaydDate(dueDate);

    if (formattedDueDate) {
      parts.push(`DT:${formattedDueDate}`);
    }
  }

  if (message) {
    const normalizedMessage = normalizeSpaydText(message, 60);

    if (normalizedMessage) {
      parts.push(`MSG:${normalizedMessage}`);
    }
  }

  if (normalizedVariableSymbol) {
    parts.push(`X-VS:${normalizedVariableSymbol}`);
  }

  return sanitizeSpaydPayload(parts.join("*"));
}

export function validateBankProfile({
  accountNumber,
  bankCode,
  iban,
  swift,
}: BankProfileInput) {
  const issues: string[] = [];
  const warnings: string[] = [];
  const expectedBic = getExpectedCzechBic(bankCode);
  const normalizedSwift = normalizeBic(swift);
  const computedIban = formatCzechIban(accountNumber, bankCode);
  const paymentIban = getPaymentIban({ accountNumber, bankCode, iban });

  if (!isValidCzechAccountNumber(accountNumber, bankCode)) {
    issues.push("Číslo účtu nebo kód banky neprochází českou kontrolou.");
  }

  if (iban?.trim() && !isValidIban(iban)) {
    issues.push("Zadaný IBAN není platný, QR použije dopočtený IBAN z čísla účtu.");
  }

  if (
    iban?.trim() &&
    isValidIban(iban) &&
    normalizeIban(iban) !== computedIban
  ) {
    warnings.push("Zadaný IBAN neodpovídá číslu účtu a kódu banky.");
  }

  if (swift?.trim() && !normalizedSwift) {
    issues.push("SWIFT/BIC nemá platný formát.");
  }

  if (expectedBic && normalizedSwift && expectedBic !== normalizedSwift) {
    warnings.push(
      `SWIFT/BIC neodpovídá kódu banky ${bankCode}; očekává se ${expectedBic}.`,
    );
  }

  return {
    computedIban,
    expectedBic,
    issues,
    paymentIban,
    warnings,
  };
}
