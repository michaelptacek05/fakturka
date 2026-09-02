import { NextResponse } from "next/server";

type AresAddress = {
  cisloDomovni?: number;
  cisloOrientacni?: number;
  nazevCastiObce?: string;
  nazevObce?: string;
  nazevStatu?: string;
  nazevUlice?: string;
  psc?: number;
  textovaAdresa?: string;
};

type AresSubject = {
  dic?: string;
  ico?: string;
  obchodniJmeno?: string;
  sidlo?: AresAddress;
};

type AresSearchResponse = {
  ekonomickeSubjekty?: AresSubject[];
};

function normalizeIco(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

function normalizeStreet(address?: AresAddress) {
  if (!address) {
    return "";
  }

  if (address.nazevUlice) {
    const houseNumber = [
      address.cisloDomovni,
      address.cisloOrientacni ? `/${address.cisloOrientacni}` : "",
    ]
      .filter(Boolean)
      .join("");

    return [address.nazevUlice, houseNumber].filter(Boolean).join(" ");
  }

  if (address.nazevCastiObce && address.cisloDomovni) {
    return `${address.nazevCastiObce} ${address.cisloDomovni}`;
  }

  return address.textovaAdresa ?? "";
}

const ARES_ENDPOINT =
  "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/vyhledat";
const ARES_TIMEOUT_MS = 8000;

/**
 * Jednoduché okno v paměti procesu. ARES je veřejná služba a endpoint je
 * dostupný komukoli přihlášenému, takže si hlídáme, ať ho nezahltíme.
 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;

let windowStartedAt = 0;
let requestsInWindow = 0;

function isRateLimited() {
  const now = Date.now();

  if (now - windowStartedAt > RATE_LIMIT_WINDOW_MS) {
    windowStartedAt = now;
    requestsInWindow = 0;
  }

  requestsInWindow += 1;

  return requestsInWindow > RATE_LIMIT_MAX_REQUESTS;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const icoParam = searchParams.get("ico")?.trim();
  const normalizedIco = normalizeIco(icoParam);
  const isIcoSearch = normalizedIco.length > 0;

  if (isIcoSearch) {
    if (normalizedIco.length < 8) {
      return NextResponse.json({ results: [] });
    }
  } else if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  if (isRateLimited()) {
    return NextResponse.json(
      { error: "Příliš mnoho dotazů na ARES. Zkuste to za chvíli." },
      { status: 429 },
    );
  }

  let data: AresSearchResponse;

  try {
    const response = await fetch(ARES_ENDPOINT, {
      body: JSON.stringify(
        isIcoSearch
          ? {
              ico: normalizedIco,
              pocet: 1,
              start: 0,
            }
          : {
              obchodniJmeno: query,
              pocet: 8,
              start: 0,
            },
      ),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(ARES_TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "ARES vyhledávání není momentálně dostupné." },
        { status: 502 },
      );
    }

    data = (await response.json()) as AresSearchResponse;
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "TimeoutError";

    return NextResponse.json(
      {
        error: isTimeout
          ? "ARES neodpověděl včas. Zkuste to prosím znovu."
          : "ARES vyhledávání není momentálně dostupné.",
      },
      { status: 504 },
    );
  }

  const results =
    data.ekonomickeSubjekty?.map((subject) => {
      const address = subject.sidlo;

      return {
        city: address?.nazevObce ?? "",
        country: address?.nazevStatu ?? "Česká republika",
        dic: subject.dic ?? "",
        ico: subject.ico ?? "",
        name: subject.obchodniJmeno ?? "",
        postalCode: address?.psc ? String(address.psc) : "",
        street: normalizeStreet(address),
        textAddress: address?.textovaAdresa ?? "",
      };
    }) ?? [];

  return NextResponse.json({ results });
}
