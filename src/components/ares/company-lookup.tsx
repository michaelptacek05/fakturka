"use client";

import { useId, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    if (
      searchType === "ico" ? normalizedIco.length < 8 : trimmedQuery.length < 2
    ) {
      setResults([]);
      setState("idle");
      return;
    }

    setState("loading");
    setErrorMessage(null);

    try {
      const response = await fetch(
        searchType === "ico"
          ? `/api/ares/search?ico=${encodeURIComponent(normalizedIco)}`
          : `/api/ares/search?q=${encodeURIComponent(trimmedQuery)}`,
      );

      const data = (await response.json()) as {
        error?: string;
        results?: CompanyResult[];
      };

      if (!response.ok) {
        // Endpoint vrací srozumitelnou hlášku pro timeout i pro rate limit.
        throw new Error(data.error ?? "ARES request failed");
      }

      setResults(data.results ?? []);
      setState("ready");
    } catch (error) {
      setResults([]);
      setErrorMessage(
        error instanceof Error && error.message !== "ARES request failed"
          ? error.message
          : "ARES teď neodpovídá. Údaje můžete vyplnit ručně.",
      );
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
    <section className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>{resolvedLabel}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={inputId}
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
          <Button
            type="button"
            variant="outline"
            onClick={searchCompanies}
            disabled={state === "loading"}
          >
            {state === "loading" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="size-4" aria-hidden="true" />
            )}
            Vyhledat
          </Button>
        </div>
      </div>

      {state === "error" && errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}

      {state === "ready" && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nic jsem nenašel.</p>
      ) : null}

      {results.length > 0 ? (
        <ul className="space-y-2">
          {results.map((company) => (
            <li key={company.ico}>
              <button
                className="w-full rounded-lg border border-border bg-background p-3 text-left text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/45"
                type="button"
                onClick={() => selectCompany(company)}
              >
                <span className="block font-medium">{company.name}</span>
                <span className="mt-1 block text-muted-foreground">
                  IČO {company.ico}
                  {company.dic ? `, DIČ ${company.dic}` : ""}
                </span>
                <span className="mt-0.5 block text-muted-foreground">
                  {company.textAddress ||
                    [company.street, company.city].filter(Boolean).join(", ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
