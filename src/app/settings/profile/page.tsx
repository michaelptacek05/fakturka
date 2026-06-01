import Link from "next/link";
import Image from "next/image";
import { Save, Trash2, Upload } from "lucide-react";

import {
  deleteInvoiceAsset,
  uploadInvoiceAsset,
  upsertProfile,
} from "@/app/actions";
import { CompanyLookup } from "@/components/ares/company-lookup";
import { Button } from "@/components/ui/button";
import { InvoiceAssetType, VatPayerStatus } from "@/generated/prisma/enums";
import { getInvoiceAssetTypeLabel } from "@/lib/invoice-assets";
import { prisma } from "@/lib/prisma";
import { validateBankProfile } from "@/lib/spayd";
import { getValidationMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

const inputClass =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";
const labelClass = "grid gap-1.5 text-sm font-medium text-zinc-700";

async function getProfile() {
  try {
    return await prisma.userProfile.findFirst({
      include: {
        assets: {
          orderBy: { createdAt: "desc" },
        },
      },
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

  return getValidationMessage(error);
}

function getAssetErrorMessage(error?: string | string[]) {
  if (error === "missing") {
    return "Vyberte prosím soubor k nahrání.";
  }

  if (error === "type") {
    return "Podporované formáty jsou PNG, JPG a WebP.";
  }

  if (error === "size") {
    return "Soubor je příliš velký. Maximální velikost je 2 MB.";
  }

  if (error === "delete") {
    return "Asset se nepodařilo smazat.";
  }

  if (error === "db") {
    return "Asset se nepodařilo uložit, protože databáze nebo storage nejsou dostupné.";
  }

  if (error === "validation") {
    return "Typ assetu není platný.";
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
  const assetErrorMessage = getAssetErrorMessage(params?.assetError);
  const assetFlashMessage =
    params?.assetSaved === "1"
      ? "Asset byl uložen."
      : params?.assetDeleted === "1"
        ? "Asset byl smazán."
        : null;
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

      {assetErrorMessage ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {assetErrorMessage}
        </section>
      ) : null}

      {assetFlashMessage ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          {assetFlashMessage}
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

      {profile ? (
        <section className="grid gap-5 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-semibold">Logo a podpis</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Nahrajte volitelné obrázky pro webovou fakturu a PDF export.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              InvoiceAssetType.LOGO,
              InvoiceAssetType.SIGNATURE,
              InvoiceAssetType.STAMP,
            ].map((assetType) => {
              const asset = profile.assets.find((item) => item.type === assetType);

              return (
                <div
                  className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4"
                  key={assetType}
                >
                  <div>
                    <h3 className="font-medium">
                      {getInvoiceAssetTypeLabel(assetType)}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      PNG, JPG nebo WebP do 2 MB.
                    </p>
                  </div>

                  {asset ? (
                    <div className="grid gap-3">
                      <div className="grid h-32 place-items-center rounded-md border border-zinc-200 bg-white p-2">
                        <Image
                          src={`/invoice-assets/${asset.id}`}
                          alt={getInvoiceAssetTypeLabel(asset.type)}
                          width={180}
                          height={96}
                          className="max-h-24 w-auto object-contain"
                          unoptimized
                        />
                      </div>
                      <p className="truncate text-xs text-zinc-500">
                        {asset.fileName}
                      </p>
                      <form action={deleteInvoiceAsset.bind(null, asset.id)}>
                        <Button type="submit" variant="outline" className="w-full">
                          <Trash2 className="size-4" aria-hidden="true" />
                          Smazat
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <div className="grid h-32 place-items-center rounded-md border border-dashed border-zinc-300 bg-white text-xs text-zinc-500">
                      Nenahráno
                    </div>
                  )}

                  <form action={uploadInvoiceAsset} className="grid gap-3">
                    <input type="hidden" name="assetType" value={assetType} />
                    <input
                      className="block w-full text-xs text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white"
                      name="assetFile"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      required
                    />
                    <Button type="submit" variant="outline" className="w-full">
                      <Upload className="size-4" aria-hidden="true" />
                      Nahrát
                    </Button>
                  </form>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
