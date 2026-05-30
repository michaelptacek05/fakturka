"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";

type CompanyResult = {
  city: string;
  country: string;
  dic: string;
  ico: string;
  name: string;
  postalCode: string;
  street: string;
  textAddress: string;
};

type FieldNames = {
  city: string;
  country: string;
  dic: string;
  ico: string;
  name: string;
  street: string;
  postalCode: string;
};

type SearchState = "idle" | "loading" | "ready" | "error";

const inputClass =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";

function setFieldValue(name: string, value: string) {
  const field = document.querySelector<HTMLInputElement | HTMLSelectElement>(
    `[name="${name}"]`,
  );

  if (!field || value.length === 0) {
    return;
  }

  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

export function CompanyLookup({
  fieldNames,
  label,
  searchType = "name",
}: {
  fieldNames: FieldNames;
  label?: string;
  searchType?: "name" | "ico";
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const resolvedLabel =
    label ??
    (searchType === "ico"
      ? "Vyhledat v ARES podle IČO"
      : "Vyhledat v ARES podle názvu");
  const placeholder =
    searchType === "ico" ? "Např. 27082440" : "Např. Škoda Auto, ČEZ, Alza";

  async function searchCompanies() {
    const trimmedQuery = query.trim();
    const normalizedIco = trimmedQuery.replace(/\D/g, "");

    if (searchType === "ico" ? normalizedIco.length < 8 : trimmedQuery.length < 2) {
      setResults([]);
      setState("idle");
      return;
    }

    setState("loading");

    try {
      const response = await fetch(
        searchType === "ico"
          ? `/api/ares/search?ico=${encodeURIComponent(normalizedIco)}`
          : `/api/ares/search?q=${encodeURIComponent(trimmedQuery)}`,
      );

      if (!response.ok) {
        throw new Error("ARES request failed");
      }

      const data = (await response.json()) as { results: CompanyResult[] };
      setResults(data.results);
      setState("ready");
    } catch {
      setResults([]);
      setState("error");
    }
  }

  function selectCompany(company: CompanyResult) {
    setFieldValue(fieldNames.name, company.name);
    setFieldValue(fieldNames.ico, company.ico);
    setFieldValue(fieldNames.dic, company.dic);
    setFieldValue(fieldNames.street, company.street);
    setFieldValue(fieldNames.city, company.city);
    setFieldValue(fieldNames.postalCode, company.postalCode);
    setFieldValue(fieldNames.country, company.country);
    setQuery(company.name);
    setResults([]);
    setState("idle");
  }

  return (
    <section className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-zinc-700" htmlFor="ares-query">
          {resolvedLabel}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={inputClass}
            id="ares-query"
            inputMode={searchType === "ico" ? "numeric" : "text"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchCompanies();
              }
            }}
            placeholder={placeholder}
          />
          <Button type="button" variant="outline" onClick={searchCompanies}>
            <Search className="size-4" aria-hidden="true" />
            Vyhledat
          </Button>
        </div>
      </div>

      {state === "error" ? (
        <p className="text-sm text-red-700">
          ARES teď neodpovídá. Údaje můžete vyplnit ručně.
        </p>
      ) : null}

      {state === "ready" && results.length === 0 ? (
        <p className="text-sm text-zinc-500">Nic jsem nenašel.</p>
      ) : null}

      {results.length > 0 ? (
        <div className="grid gap-2">
          {results.map((company) => (
            <button
              className="rounded-lg border border-zinc-200 bg-white p-3 text-left text-sm transition-colors hover:bg-zinc-100"
              key={company.ico}
              type="button"
              onClick={() => selectCompany(company)}
            >
              <span className="block font-medium text-zinc-950">
                {company.name}
              </span>
              <span className="mt-1 block text-zinc-500">
                IČO {company.ico}
                {company.dic ? `, DIČ ${company.dic}` : ""}
              </span>
              <span className="mt-1 block text-zinc-500">
                {company.textAddress || [company.street, company.city].filter(Boolean).join(", ")}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {state === "loading" ? (
        <p className="text-sm text-zinc-500">Hledám v ARES...</p>
      ) : null}
    </section>
  );
}
