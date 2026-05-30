import Link from "next/link";
import { Save } from "lucide-react";

import { upsertProfile } from "@/app/actions";
import { CompanyLookup } from "@/components/ares/company-lookup";
import { Button } from "@/components/ui/button";
import { VatPayerStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { validateBankProfile } from "@/lib/spayd";

export const dynamic = "force-dynamic";

const inputClass =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";
const labelClass = "grid gap-1.5 text-sm font-medium text-zinc-700";

async function getProfile() {
  try {
    return await prisma.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return null;
  }
}

function getErrorMessage(error?: string | string[]) {
  if (error === "db") {
    return "Databáze není dostupná. Spusťte PostgreSQL, aplikujte migrace a zkuste uložit údaje znovu.";
  }

  if (error === "validation") {
    return "Zkontrolujte prosím povinné údaje: jméno nebo firmu, adresu, IČO, číslo účtu a kód banky.";
  }

  return null;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const profile = await getProfile();
  const errorMessage = getErrorMessage(params?.error);
  const bankValidation = profile
    ? validateBankProfile({
        accountNumber: profile.accountNumber,
        bankCode: profile.bankCode,
        iban: profile.iban,
        swift: profile.swift,
      })
    : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Nastavení</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal">
            Moje údaje / OSVČ
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/invoices/new">Vytvořit fakturu</Link>
        </Button>
      </div>

      {errorMessage ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {errorMessage}
        </section>
      ) : null}

      {bankValidation &&
      (bankValidation.issues.length > 0 || bankValidation.warnings.length > 0) ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="font-semibold">Zkontrolujte bankovní údaje</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {[...bankValidation.issues, ...bankValidation.warnings].map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <p className="mt-2 text-amber-800">
            QR platba použije IBAN {bankValidation.paymentIban}.
          </p>
        </section>
      ) : null}

      <form
        action={upsertProfile}
        className="grid gap-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
      >
        <CompanyLookup
          label="Předvyplnit moje OSVČ údaje z ARES podle názvu"
          fieldNames={{
            city: "city",
            country: "country",
            dic: "dic",
            ico: "ico",
            name: "displayName",
            postalCode: "postalCode",
            street: "street",
          }}
        />

        <section className="grid gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Jméno / firma *
            <input
              className={inputClass}
              name="displayName"
              required
              defaultValue={profile?.displayName ?? ""}
            />
          </label>
          <label className={labelClass}>
            Obchodní název
            <input
              className={inputClass}
              name="companyName"
              defaultValue={profile?.companyName ?? ""}
            />
          </label>
          <label className={labelClass}>
            Ulice a číslo *
            <input
              className={inputClass}
              name="street"
              required
              defaultValue={profile?.street ?? ""}
            />
          </label>
          <label className={labelClass}>
            Město *
            <input
              className={inputClass}
              name="city"
              required
              defaultValue={profile?.city ?? ""}
            />
          </label>
          <label className={labelClass}>
            PSČ *
            <input
              className={inputClass}
              name="postalCode"
              required
              defaultValue={profile?.postalCode ?? ""}
            />
          </label>
          <label className={labelClass}>
            Země
            <input
              className={inputClass}
              name="country"
              defaultValue={profile?.country ?? "Česká republika"}
            />
          </label>
          <label className={labelClass}>
            IČO *
            <input
              className={inputClass}
              name="ico"
              required
              inputMode="numeric"
              defaultValue={profile?.ico ?? ""}
            />
          </label>
          <label className={labelClass}>
            DIČ
            <input
              className={inputClass}
              name="dic"
              defaultValue={profile?.dic ?? ""}
            />
          </label>
          <label className={`${labelClass} md:col-span-2`}>
            Zápis v rejstříku
            <input
              className={inputClass}
              name="registryText"
              defaultValue={profile?.registryText ?? ""}
              placeholder="Např. zapsán v živnostenském rejstříku..."
            />
          </label>
        </section>

        <section className="grid gap-4 border-t border-zinc-200 pt-5 md:grid-cols-2">
          <label className={labelClass}>
            Režim DPH
            <select
              className={inputClass}
              name="vatPayerStatus"
              defaultValue={profile?.vatPayerStatus ?? VatPayerStatus.NON_PAYER}
            >
              <option value={VatPayerStatus.NON_PAYER}>Neplátce DPH</option>
              <option value={VatPayerStatus.PAYER}>Plátce DPH</option>
            </select>
          </label>
          <label className={labelClass}>
            Číslo účtu *
            <input
              className={inputClass}
              name="accountNumber"
              required
              defaultValue={profile?.accountNumber ?? ""}
            />
          </label>
          <label className={labelClass}>
            Kód banky *
            <input
              className={inputClass}
              name="bankCode"
              required
              inputMode="numeric"
              defaultValue={profile?.bankCode ?? ""}
            />
          </label>
          <label className={labelClass}>
            IBAN
            <input
              className={inputClass}
              name="iban"
              defaultValue={profile?.iban ?? ""}
            />
          </label>
          <label className={labelClass}>
            SWIFT
            <input
              className={inputClass}
              name="swift"
              defaultValue={profile?.swift ?? ""}
            />
          </label>
        </section>

        <div className="flex justify-end">
          <Button type="submit">
            <Save className="size-4" aria-hidden="true" />
            Uložit moje údaje
          </Button>
        </div>
      </form>
    </main>
  );
}
