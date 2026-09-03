import Link from "next/link";
import Image from "next/image";
import { FilePlus2, Save, Trash2, Upload } from "lucide-react";

import {
  deleteInvoiceAsset,
  uploadInvoiceAsset,
  upsertProfile,
} from "@/app/actions";
import { CompanyLookup } from "@/components/ares/company-lookup";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InputField, SelectField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  ActivityType,
  InvoiceAssetType,
  VatPayerStatus,
} from "@/generated/prisma/enums";
import { getInvoiceAssetTypeLabel } from "@/lib/invoice-assets";
import {
  DEFAULT_INVOICE_NUMBER_FORMAT,
  INVOICE_NUMBER_FORMATS,
} from "@/lib/invoice-number";
import {
  FLAT_EXPENSE_LABELS,
  FLAT_EXPENSE_RATES,
} from "@/lib/tax-estimate";
import { prisma } from "@/lib/prisma";
import { validateBankProfile } from "@/lib/spayd";
import { getValidationMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function getProfile() {
  try {
    return await prisma.userProfile.findFirst({
      include: {
        assets: {
          orderBy: { createdAt: "desc" },
        },
        sequences: {
          orderBy: { createdAt: "asc" },
          take: 1,
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
  switch (error) {
    case "missing":
      return "Vyberte prosím soubor k nahrání.";
    case "type":
      return "Podporované formáty jsou PNG, JPG a WebP.";
    case "size":
      return "Soubor je příliš velký. Maximální velikost je 2 MB.";
    case "delete":
      return "Asset se nepodařilo smazat.";
    case "db":
      return "Asset se nepodařilo uložit, protože databáze nebo storage nejsou dostupné.";
    case "validation":
      return "Typ assetu není platný.";
    default:
      return null;
  }
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

  const sequence = profile?.sequences[0];
  const numberFormat = sequence?.format ?? DEFAULT_INVOICE_NUMBER_FORMAT;
  const knownFormat = INVOICE_NUMBER_FORMATS.some(
    (option) => option.value === numberFormat,
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        title="Moje údaje / OSVČ"
        description="Údaje dodavatele, bankovní spojení a číslování faktur."
        actions={
          <Button asChild variant="outline">
            <Link href="/invoices/new">
              <FilePlus2 className="size-4" aria-hidden="true" />
              Vytvořit fakturu
            </Link>
          </Button>
        }
      />

      {params?.missingProfile === "1" ? (
        <Alert
          variant="warning"
          title="Nejdřív vyplňte své údaje"
          // Sem se přesměrovává vystavení faktury i import, když profil chybí.
        >
          Bez profilu dodavatele nelze vystavit ani naimportovat fakturu.
        </Alert>
      ) : null}

      {params?.saved === "1" ? (
        <Alert variant="success" title="Údaje byly uloženy." />
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive" title={errorMessage} />
      ) : null}

      {assetErrorMessage ? (
        <Alert variant="destructive" title={assetErrorMessage} />
      ) : null}

      {assetFlashMessage ? (
        <Alert variant="success" title={assetFlashMessage} />
      ) : null}

      {bankValidation &&
      (bankValidation.issues.length > 0 ||
        bankValidation.warnings.length > 0) ? (
        <Alert variant="warning" title="Zkontrolujte bankovní údaje">
          <ul className="list-disc space-y-1 pl-5">
            {[...bankValidation.issues, ...bankValidation.warnings].map(
              (message) => (
                <li key={message}>{message}</li>
              ),
            )}
          </ul>
          <p className="mt-2">QR platba použije IBAN {bankValidation.paymentIban}.</p>
        </Alert>
      ) : null}

      <form action={upsertProfile}>
        <Card>
          <CardHeader>
            <CardTitle>Fakturační údaje</CardTitle>
            <CardDescription>
              Tyto údaje se tisknou na faktuře jako dodavatel.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <CompanyLookup
              label="Předvyplnit z ARES podle názvu"
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

            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Jméno / firma"
                name="displayName"
                required
                defaultValue={profile?.displayName ?? ""}
              />
              <InputField
                label="Obchodní název"
                name="companyName"
                defaultValue={profile?.companyName ?? ""}
              />
              <InputField
                label="Ulice a číslo"
                name="street"
                required
                defaultValue={profile?.street ?? ""}
              />
              <InputField
                label="Město"
                name="city"
                required
                defaultValue={profile?.city ?? ""}
              />
              <InputField
                label="PSČ"
                name="postalCode"
                required
                defaultValue={profile?.postalCode ?? ""}
              />
              <InputField
                label="Země"
                name="country"
                defaultValue={profile?.country ?? "Česká republika"}
              />
              <InputField
                label="IČO"
                name="ico"
                required
                inputMode="numeric"
                defaultValue={profile?.ico ?? ""}
              />
              <InputField
                label="DIČ"
                name="dic"
                hint="Nechte prázdné, pokud nejste plátce DPH."
                defaultValue={profile?.dic ?? ""}
              />
              <InputField
                className="md:col-span-2"
                label="Zápis v rejstříku"
                name="registryText"
                placeholder="Např. zapsán v živnostenském rejstříku…"
                defaultValue={profile?.registryText ?? ""}
              />
            </div>
          </CardContent>

          <CardHeader className="border-t border-b-0">
            <CardTitle>Platební údaje</CardTitle>
            <CardDescription>
              Z těchto údajů se skládá QR platba na faktuře.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Režim DPH"
                name="vatPayerStatus"
                defaultValue={profile?.vatPayerStatus ?? VatPayerStatus.NON_PAYER}
              >
                <option value={VatPayerStatus.NON_PAYER}>Neplátce DPH</option>
                <option value={VatPayerStatus.PAYER}>Plátce DPH</option>
              </SelectField>
              <InputField
                label="Číslo účtu"
                name="accountNumber"
                required
                placeholder="19-2000145399"
                defaultValue={profile?.accountNumber ?? ""}
              />
              <InputField
                label="Kód banky"
                name="bankCode"
                required
                inputMode="numeric"
                placeholder="0800"
                defaultValue={profile?.bankCode ?? ""}
              />
              <InputField
                label="IBAN"
                name="iban"
                hint="Nepovinné. Bez IBANu se dopočítá z čísla účtu."
                defaultValue={profile?.iban ?? ""}
              />
              <InputField
                label="SWIFT / BIC"
                name="swift"
                defaultValue={profile?.swift ?? ""}
              />
            </div>
          </CardContent>

          <CardHeader className="border-t border-b-0">
            <CardTitle>Odvody a daně</CardTitle>
            <CardDescription>
              Z těchto hodnot vychází orientační odhad na dashboardu.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Režim činnosti"
                name="activityType"
                defaultValue={profile?.activityType ?? ActivityType.MAIN}
                hint="Studium, zaměstnání, rodičovská i důchod znamenají vedlejší činnost."
              >
                <option value={ActivityType.MAIN}>Hlavní činnost</option>
                <option value={ActivityType.SECONDARY}>
                  Vedlejší činnost (student, zaměstnání, rodičovská, důchod)
                </option>
              </SelectField>

              <SelectField
                label="Paušální výdaje"
                name="flatExpenseRate"
                defaultValue={String(profile?.flatExpenseRate ?? 60)}
              >
                {FLAT_EXPENSE_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {FLAT_EXPENSE_LABELS[rate]}
                  </option>
                ))}
              </SelectField>

              <InputField
                label="Sleva na poplatníka za rok"
                name="taxpayerCredit"
                inputMode="numeric"
                defaultValue={String(profile?.taxpayerCredit ?? 30840)}
                hint="V Kč. Ověřte si aktuální hodnotu, mění se."
              />

              <InputField
                label="Rozhodná částka pro sociální"
                name="socialThreshold"
                inputMode="numeric"
                defaultValue={String(profile?.socialThreshold ?? 117521)}
                hint="V Kč. Do tohoto zisku se u vedlejší činnosti sociální neplatí."
              />
            </div>

            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                name="applyTaxpayerCredit"
                defaultChecked={profile?.applyTaxpayerCredit ?? true}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                Uplatňuji slevu na poplatníka
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Odečte se od vypočtené daně. Nechte zapnuté, pokud ji
                  neuplatňuje někdo jiný za vás.
                </span>
              </span>
            </label>

            <Alert variant="warning" title="Čísla si ověřte">
              Sazby i limity se mění každý rok a zdroje se občas rozcházejí.
              Aplikace je jen počítá, nehlídá jejich platnost — aktuální
              hodnoty najdete na ČSSZ a u své zdravotní pojišťovny. Odhad
              nenahrazuje účetní ani daňové poradenství.
            </Alert>
          </CardContent>

          <CardHeader className="border-t border-b-0">
            <CardTitle>Číslování faktur</CardTitle>
            <CardDescription>
              Pořadové číslo se resetuje vždy na začátku nového období.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <SelectField
              label="Formát čísla faktury"
              name="invoiceNumberFormat"
              defaultValue={knownFormat ? numberFormat : ""}
              hint={
                sequence
                  ? `Aktuálně: ${sequence.format}, další pořadí ${sequence.nextNumber}${
                      sequence.periodKey ? ` v období ${sequence.periodKey}` : ""
                    }.`
                  : "Řada se založí při vystavení první faktury."
              }
            >
              {INVOICE_NUMBER_FORMATS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.example} — {option.label}
                </option>
              ))}
              {knownFormat ? null : (
                <option value={numberFormat}>Vlastní: {numberFormat}</option>
              )}
            </SelectField>

            <p className="text-xs text-muted-foreground">
              Změna formátu se projeví až u další vystavené faktury. Existující
              doklady si své číslo ponechají.
            </p>
          </CardContent>

          <CardFooter className="justify-end">
            <Button type="submit">
              <Save className="size-4" aria-hidden="true" />
              Uložit moje údaje
            </Button>
          </CardFooter>
        </Card>
      </form>

      {profile ? (
        <Card>
          <CardHeader>
            <CardTitle>Logo, podpis a razítko</CardTitle>
            <CardDescription>
              Volitelné obrázky pro webovou fakturu i PDF export. PNG, JPG nebo
              WebP do 2 MB.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                InvoiceAssetType.LOGO,
                InvoiceAssetType.SIGNATURE,
                InvoiceAssetType.STAMP,
              ].map((assetType) => {
                const asset = profile.assets.find(
                  (item) => item.type === assetType,
                );

                return (
                  <div
                    className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4"
                    key={assetType}
                  >
                    <h3 className="text-sm font-medium">
                      {getInvoiceAssetTypeLabel(assetType)}
                    </h3>

                    {asset ? (
                      <>
                        <div className="grid h-28 place-items-center rounded-md border border-border bg-background p-2">
                          <Image
                            src={`/invoice-assets/${asset.id}`}
                            alt={getInvoiceAssetTypeLabel(asset.type)}
                            width={180}
                            height={96}
                            className="max-h-24 w-auto object-contain"
                            unoptimized
                          />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {asset.fileName}
                        </p>
                        <form action={deleteInvoiceAsset.bind(null, asset.id)}>
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            Smazat
                          </Button>
                        </form>
                      </>
                    ) : (
                      <div className="grid h-28 place-items-center rounded-md border border-dashed border-border bg-background text-xs text-muted-foreground">
                        Nenahráno
                      </div>
                    )}

                    <form
                      action={uploadInvoiceAsset}
                      className="mt-auto flex flex-col gap-2"
                    >
                      <input type="hidden" name="assetType" value={assetType} />
                      <Input
                        name="assetFile"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        required
                        className="h-auto py-1.5 text-xs"
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <Upload className="size-4" aria-hidden="true" />
                        Nahrát
                      </Button>
                    </form>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
