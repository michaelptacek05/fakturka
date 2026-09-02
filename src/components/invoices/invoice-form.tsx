"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { CompanyLookup } from "@/components/ares/company-lookup";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, InputField, TextareaField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type InvoiceRow = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: string;
};

type InvoiceItemInput = Omit<InvoiceRow, "id">;

type InvoiceFormValues = {
  clientCity: string;
  clientCountry: string;
  clientDic: string;
  clientEmail: string;
  clientIco: string;
  clientName: string;
  clientPhone: string;
  clientPostalCode: string;
  clientStreet: string;
  constantSymbol: string;
  notes: string;
  specificSymbol: string;
};

type InvoiceFormProps = {
  action: (formData: FormData) => void;
  defaultDueDate: string;
  defaultIssueDate: string;
  defaultTaxableSupplyDate?: string;
  defaultValues?: Partial<InvoiceFormValues>;
  initialItems?: InvoiceItemInput[];
  isVatPayer: boolean;
  readOnly?: boolean;
  submitLabel?: string;
};

const dueDatePresets = [
  { label: "Ihned", value: "0" },
  { label: "7 dní", value: "7" },
  { label: "10 dní", value: "10" },
  { label: "14 dní", value: "14" },
  { label: "30 dní", value: "30" },
  { label: "Vlastní…", value: "custom" },
] as const;

type DueDatePreset = (typeof dueDatePresets)[number]["value"];

/** Běžné české sazby DPH pro rychlé nastavení položky. */
const vatRatePresets = ["0", "12", "21"];

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));

  return Number.isFinite(parsed) ? parsed : 0;
}

const currencyFormatter = new Intl.NumberFormat("cs-CZ", {
  currency: "CZK",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "currency",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function parseDateInput(value: string) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDaysToInputDate(value: string, days: number) {
  const date = parseDateInput(value);

  if (!date) {
    return value;
  }

  date.setDate(date.getDate() + days);

  return formatDateInput(date);
}

function getDayDiff(startValue: string, endValue: string) {
  const start = parseDateInput(startValue);
  const end = parseDateInput(endValue);

  if (!start || !end) {
    return null;
  }

  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function getInitialDueDatePreset(
  issueDate: string,
  dueDate: string,
): DueDatePreset {
  const diff = getDayDiff(issueDate, dueDate);
  const preset = dueDatePresets.find((item) => item.value === String(diff));

  return preset?.value ?? "custom";
}

function createEmptyRow(): InvoiceRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    quantity: "1",
    unit: "ks",
    unitPrice: "",
    vatRate: "21",
  };
}

function getRowTotal(row: InvoiceRow, isVatPayer: boolean) {
  const subtotal =
    Math.round(parseNumber(row.quantity) * parseNumber(row.unitPrice) * 100) /
    100;
  const vatRate = isVatPayer ? parseNumber(row.vatRate) : 0;

  return subtotal + Math.round(subtotal * (vatRate / 100) * 100) / 100;
}

export function InvoiceForm({
  action,
  defaultDueDate,
  defaultIssueDate,
  defaultTaxableSupplyDate,
  defaultValues,
  initialItems,
  isVatPayer,
  readOnly = false,
  submitLabel = "Vystavit fakturu",
}: InvoiceFormProps) {
  // ID prvků musí být stejné na serveru i v prohlížeči, jinak React
  // nahlásí neshodu při hydrataci. Náhodné row.id slouží jen jako React key.
  const fieldPrefix = useId();
  const [rows, setRows] = useState<InvoiceRow[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((item) => ({
        id: crypto.randomUUID(),
        ...item,
      }));
    }

    return [createEmptyRow()];
  });
  const [issueDate, setIssueDate] = useState(defaultIssueDate);
  const [taxableSupplyDate, setTaxableSupplyDate] = useState(
    defaultTaxableSupplyDate ?? defaultIssueDate,
  );
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [dueDatePreset, setDueDatePreset] = useState<DueDatePreset>(() =>
    getInitialDueDatePreset(defaultIssueDate, defaultDueDate),
  );

  const values: InvoiceFormValues = {
    clientCity: defaultValues?.clientCity ?? "",
    clientCountry: defaultValues?.clientCountry ?? "Česká republika",
    clientDic: defaultValues?.clientDic ?? "",
    clientEmail: defaultValues?.clientEmail ?? "",
    clientIco: defaultValues?.clientIco ?? "",
    clientName: defaultValues?.clientName ?? "",
    clientPhone: defaultValues?.clientPhone ?? "",
    clientPostalCode: defaultValues?.clientPostalCode ?? "",
    clientStreet: defaultValues?.clientStreet ?? "",
    constantSymbol: defaultValues?.constantSymbol ?? "",
    notes: defaultValues?.notes ?? "",
    specificSymbol: defaultValues?.specificSymbol ?? "",
  };
  const isEditable = !readOnly;

  const totals = useMemo(
    () =>
      rows.reduce(
        (sum, row) => {
          const quantity = parseNumber(row.quantity);
          const unitPrice = parseNumber(row.unitPrice);
          const vatRate = isVatPayer ? parseNumber(row.vatRate) : 0;
          const subtotal = Math.round(quantity * unitPrice * 100) / 100;
          const vat = Math.round(subtotal * (vatRate / 100) * 100) / 100;

          return {
            subtotal: sum.subtotal + subtotal,
            total: sum.total + subtotal + vat,
            vat: sum.vat + vat,
          };
        },
        { subtotal: 0, total: 0, vat: 0 },
      ),
    [isVatPayer, rows],
  );

  function updateRow(id: string, patch: Partial<InvoiceRow>) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(id: string) {
    setRows((currentRows) =>
      currentRows.length === 1
        ? currentRows
        : currentRows.filter((row) => row.id !== id),
    );
  }

  function updateDueDateFromInput(nextDueDate: string) {
    const diff = getDayDiff(issueDate, nextDueDate);
    const preset = dueDatePresets.find((item) => item.value === String(diff));

    setDueDate(nextDueDate);
    setDueDatePreset(preset?.value ?? "custom");
  }

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Termíny</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Datum vystavení" htmlFor="issueDate">
              <Input
                id="issueDate"
                type="date"
                name="issueDate"
                value={issueDate}
                onChange={(event) => {
                  const nextIssueDate = event.target.value;

                  setIssueDate(nextIssueDate);

                  if (dueDatePreset !== "custom") {
                    setDueDate(
                      addDaysToInputDate(nextIssueDate, Number(dueDatePreset)),
                    );
                  }
                }}
                disabled={!isEditable}
              />
            </Field>

            <Field
              label="DUZP"
              htmlFor="taxableSupplyDate"
              hint="Datum zdanitelného plnění"
            >
              <Input
                id="taxableSupplyDate"
                type="date"
                name="taxableSupplyDate"
                value={taxableSupplyDate}
                onChange={(event) => setTaxableSupplyDate(event.target.value)}
                disabled={!isEditable}
              />
            </Field>

            <Field label="Splatnost za" htmlFor="dueDatePreset">
              <Select
                id="dueDatePreset"
                value={dueDatePreset}
                onChange={(event) => {
                  const nextPreset = event.target.value as DueDatePreset;

                  setDueDatePreset(nextPreset);

                  if (nextPreset !== "custom") {
                    setDueDate(addDaysToInputDate(issueDate, Number(nextPreset)));
                  }
                }}
                disabled={!isEditable}
              >
                {dueDatePresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Datum splatnosti" htmlFor="dueDate">
              <Input
                id="dueDate"
                type="date"
                name="dueDate"
                value={dueDate}
                onChange={(event) => updateDueDateFromInput(event.target.value)}
                disabled={!isEditable}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Odběratel</CardTitle>
          <CardDescription>
            Údaje se uloží na fakturu i do adresáře odběratelů.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditable ? (
            <CompanyLookup
              label="Vyhledat odběratele v ARES podle názvu firmy"
              fieldNames={{
                city: "clientCity",
                country: "clientCountry",
                dic: "clientDic",
                ico: "clientIco",
                name: "clientName",
                postalCode: "clientPostalCode",
                street: "clientStreet",
              }}
            />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <InputField
              className="md:col-span-2"
              label="Firma nebo jméno"
              name="clientName"
              required
              placeholder="Název firmy nebo jméno odběratele"
              defaultValue={values.clientName}
              disabled={!isEditable}
            />
            <InputField
              label="Ulice a číslo"
              name="clientStreet"
              required
              defaultValue={values.clientStreet}
              disabled={!isEditable}
            />
            <InputField
              label="Město"
              name="clientCity"
              required
              defaultValue={values.clientCity}
              disabled={!isEditable}
            />
            <InputField
              label="PSČ"
              name="clientPostalCode"
              required
              defaultValue={values.clientPostalCode}
              disabled={!isEditable}
            />
            <InputField
              label="Země"
              name="clientCountry"
              defaultValue={values.clientCountry}
              disabled={!isEditable}
            />
            <InputField
              label="IČO"
              name="clientIco"
              inputMode="numeric"
              defaultValue={values.clientIco}
              disabled={!isEditable}
            />
            <InputField
              label="DIČ"
              name="clientDic"
              defaultValue={values.clientDic}
              disabled={!isEditable}
            />
            <InputField
              label="E-mail"
              name="clientEmail"
              type="email"
              defaultValue={values.clientEmail}
              disabled={!isEditable}
            />
            <InputField
              label="Telefon"
              name="clientPhone"
              defaultValue={values.clientPhone}
              disabled={!isEditable}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Položky faktury</CardTitle>
            <CardDescription>
              Služby nebo produkty účtované odběrateli.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setRows((currentRows) => [...currentRows, createEmptyRow()])
            }
            disabled={!isEditable}
          >
            <Plus className="size-4" aria-hidden="true" />
            Přidat položku
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div
                className="rounded-lg border border-border bg-muted/40 p-3"
                key={row.id}
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_100px_90px_140px_110px_auto]">
                  <Field label="Název" htmlFor={`${fieldPrefix}-name-${index}`} required>
                    <Input
                      id={`${fieldPrefix}-name-${index}`}
                      name="itemName"
                      required
                      placeholder="Např. Konzultace, vývoj, hosting"
                      value={row.name}
                      onChange={(event) =>
                        updateRow(row.id, { name: event.target.value })
                      }
                      disabled={!isEditable}
                    />
                  </Field>

                  <Field
                    label="Množství"
                    htmlFor={`${fieldPrefix}-quantity-${index}`}
                    required
                  >
                    <Input
                      id={`${fieldPrefix}-quantity-${index}`}
                      name="quantity"
                      required
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(event) =>
                        updateRow(row.id, { quantity: event.target.value })
                      }
                      disabled={!isEditable}
                    />
                  </Field>

                  <Field label="Jednotka" htmlFor={`${fieldPrefix}-unit-${index}`}>
                    <Input
                      id={`${fieldPrefix}-unit-${index}`}
                      name="unit"
                      value={row.unit}
                      onChange={(event) =>
                        updateRow(row.id, { unit: event.target.value })
                      }
                      disabled={!isEditable}
                    />
                  </Field>

                  <Field
                    label="Cena / j."
                    htmlFor={`${fieldPrefix}-price-${index}`}
                    required
                  >
                    <Input
                      id={`${fieldPrefix}-price-${index}`}
                      name="unitPrice"
                      required
                      inputMode="decimal"
                      placeholder="0"
                      value={row.unitPrice}
                      onChange={(event) =>
                        updateRow(row.id, { unitPrice: event.target.value })
                      }
                      disabled={!isEditable}
                    />
                  </Field>

                  <Field label="DPH %" htmlFor={`${fieldPrefix}-vat-${index}`}>
                    <Select
                      id={`${fieldPrefix}-vat-${index}`}
                      name="vatRate"
                      disabled={!isVatPayer || !isEditable}
                      value={isVatPayer ? row.vatRate : "0"}
                      onChange={(event) =>
                        updateRow(row.id, { vatRate: event.target.value })
                      }
                    >
                      {vatRatePresets.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate} %
                        </option>
                      ))}
                      {vatRatePresets.includes(row.vatRate) ? null : (
                        <option value={row.vatRate}>{row.vatRate} %</option>
                      )}
                    </Select>
                  </Field>

                  <div className="flex items-end justify-end pb-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeRow(row.id)}
                      disabled={!isEditable || rows.length === 1}
                      aria-label={`Odebrat položku ${index + 1}`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <p className="mt-2 text-right text-xs text-muted-foreground">
                  Řádek celkem:{" "}
                  <span className="font-medium text-foreground">
                    {formatCurrency(getRowTotal(row, isVatPayer))}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <div className="ml-auto w-full max-w-sm space-y-2 rounded-lg border border-border bg-muted/60 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mezisoučet</span>
              <strong>{formatCurrency(totals.subtotal)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">DPH</span>
              <strong>{formatCurrency(totals.vat)}</strong>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base">
              <span>Celkem</span>
              <strong>{formatCurrency(totals.total)}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Doplňující údaje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <InputField
              label="Konstantní symbol"
              name="constantSymbol"
              defaultValue={values.constantSymbol}
              disabled={!isEditable}
            />
            <InputField
              label="Specifický symbol"
              name="specificSymbol"
              defaultValue={values.specificSymbol}
              disabled={!isEditable}
            />
            <TextareaField
              className="md:col-span-2"
              label="Poznámka"
              name="notes"
              placeholder="Např. Fakturujeme vám dle domluvy…"
              defaultValue={values.notes}
              disabled={!isEditable}
            />
          </div>
        </CardContent>

        {isEditable ? (
          <CardFooter className="justify-end">
            <Button type="submit">{submitLabel}</Button>
          </CardFooter>
        ) : null}
      </Card>
    </form>
  );
}
