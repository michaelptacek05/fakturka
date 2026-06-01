"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { CompanyLookup } from "@/components/ares/company-lookup";
import { Button } from "@/components/ui/button";

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
  { label: "Dnes", value: "0" },
  { label: "Týden", value: "7" },
  { label: "10 dní", value: "10" },
  { label: "14 dní", value: "14" },
  { label: "Měsíc", value: "30" },
  { label: "Jiná...", value: "custom" },
] as const;
type DueDatePreset = (typeof dueDatePresets)[number]["value"];

const inputClass =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";
const labelClass = "grid gap-1.5 text-sm font-medium text-zinc-700";

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("cs-CZ", {
    currency: "CZK",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
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
    unitPrice: "0",
    vatRate: "0",
  };
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
  const [rows, setRows] = useState<InvoiceRow[]>(() => {
    if (initialItems && initialItems.length > 0) {
      return initialItems.map((item) => ({
        id: crypto.randomUUID(),
        ...item,
      }));
    }

    return [{ ...createEmptyRow(), name: "Konzultační služby", unitPrice: "1000" }];
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

  const totals = useMemo(() => {
    return rows.reduce(
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
    );
  }, [isVatPayer, rows]);

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
    <form action={action} className="grid gap-6">
      <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <label className={labelClass}>
          Datum vystavení
          <input
            className={inputClass}
            type="date"
            name="issueDate"
            value={issueDate}
            onChange={(event) => {
              const nextIssueDate = event.target.value;

              setIssueDate(nextIssueDate);

              if (dueDatePreset !== "custom") {
                setDueDate(addDaysToInputDate(nextIssueDate, Number(dueDatePreset)));
              }
            }}
            disabled={!isEditable}
          />
        </label>
        <label className={labelClass}>
          DUZP
          <input
            className={inputClass}
            type="date"
            name="taxableSupplyDate"
            value={taxableSupplyDate}
            onChange={(event) => setTaxableSupplyDate(event.target.value)}
            disabled={!isEditable}
          />
        </label>
        <label className={labelClass}>
          Splatnost za
          <select
            className={inputClass}
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
          </select>
        </label>
        <label className={labelClass}>
          Splatnost
          <input
            className={inputClass}
            type="date"
            name="dueDate"
            value={dueDate}
            onChange={(event) => updateDueDateFromInput(event.target.value)}
            onInput={(event) =>
              updateDueDateFromInput(event.currentTarget.value)
            }
            disabled={!isEditable}
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-2">
        {isEditable ? (
          <div className="md:col-span-2">
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
          </div>
        ) : null}

        <label className={`${labelClass} md:col-span-2`}>
          Odběratel - firma, která vám platí *
          <input
            className={inputClass}
            name="clientName"
            required
            placeholder="Název firmy nebo jméno odběratele"
            defaultValue={values.clientName}
            disabled={!isEditable}
          />
        </label>
        <label className={labelClass}>
          Ulice a číslo *
          <input
            className={inputClass}
            name="clientStreet"
            required
            defaultValue={values.clientStreet}
            disabled={!isEditable}
          />
        </label>
        <label className={labelClass}>
          Město *
          <input
            className={inputClass}
            name="clientCity"
            required
            defaultValue={values.clientCity}
            disabled={!isEditable}
          />
        </label>
        <label className={labelClass}>
          PSČ *
          <input
            className={inputClass}
            name="clientPostalCode"
            required
            defaultValue={values.clientPostalCode}
            disabled={!isEditable}
          />
        </label>
        <label className={labelClass}>
          Země
          <input
            className={inputClass}
            name="clientCountry"
            defaultValue={values.clientCountry}
            disabled={!isEditable}
          />
        </label>
        <label className={labelClass}>
          IČO
          <input
            className={inputClass}
            name="clientIco"
            inputMode="numeric"
            defaultValue={values.clientIco}
            disabled={!isEditable}
          />
        </label>
        <label className={labelClass}>
          DIČ
          <input
            className={inputClass}
            name="clientDic"
            defaultValue={values.clientDic}
            disabled={!isEditable}
          />
        </label>
        <label className={labelClass}>
          E-mail
          <input
            className={inputClass}
            name="clientEmail"
            type="email"
            defaultValue={values.clientEmail}
            disabled={!isEditable}
          />
        </label>
        <label className={labelClass}>
          Telefon
          <input
            className={inputClass}
            name="clientPhone"
            defaultValue={values.clientPhone}
            disabled={!isEditable}
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Položky faktury</h2>
            <p className="text-sm text-zinc-500">
              Přidejte služby nebo produkty účtované odběrateli.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!isEditable) {
                return;
              }

              setRows((currentRows) => [...currentRows, createEmptyRow()]);
            }}
            disabled={!isEditable}
          >
            <Plus className="size-4" aria-hidden="true" />
            Přidat položku
          </Button>
        </div>

        <div className="grid gap-3">
          {rows.map((row, index) => (
            <div
              className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 lg:grid-cols-[1.5fr_100px_90px_140px_110px_44px]"
              key={row.id}
            >
              <label className={labelClass}>
                Název *
                <input
                  className={inputClass}
                  name="itemName"
                  required
                  value={row.name}
                  onChange={(event) => updateRow(row.id, { name: event.target.value })}
                  disabled={!isEditable}
                />
              </label>
              <label className={labelClass}>
                Množství *
                <input
                  className={inputClass}
                  name="quantity"
                  required
                  inputMode="decimal"
                  value={row.quantity}
                  onChange={(event) =>
                    updateRow(row.id, { quantity: event.target.value })
                  }
                  disabled={!isEditable}
                />
              </label>
              <label className={labelClass}>
                Jednotka
                <input
                  className={inputClass}
                  name="unit"
                  value={row.unit}
                  onChange={(event) => updateRow(row.id, { unit: event.target.value })}
                  disabled={!isEditable}
                />
              </label>
              <label className={labelClass}>
                Cena / j. *
                <input
                  className={inputClass}
                  name="unitPrice"
                  required
                  inputMode="decimal"
                  value={row.unitPrice}
                  onChange={(event) =>
                    updateRow(row.id, { unitPrice: event.target.value })
                  }
                  disabled={!isEditable}
                />
              </label>
              <label className={labelClass}>
                DPH %
                <input
                  className={inputClass}
                  name="vatRate"
                  inputMode="decimal"
                  disabled={!isVatPayer || !isEditable}
                  value={isVatPayer ? row.vatRate : "0"}
                  onChange={(event) =>
                    updateRow(row.id, { vatRate: event.target.value })
                  }
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end"
                onClick={() => removeRow(row.id)}
                disabled={!isEditable || rows.length === 1}
                aria-label={`Odebrat položku ${index + 1}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>

        <div className="ml-auto grid w-full max-w-sm gap-2 rounded-lg bg-zinc-100 p-4 text-sm">
          <div className="flex justify-between">
            <span>Mezisoučet</span>
            <strong>{formatCurrency(totals.subtotal)}</strong>
          </div>
          <div className="flex justify-between">
            <span>DPH</span>
            <strong>{formatCurrency(totals.vat)}</strong>
          </div>
          <div className="flex justify-between border-t border-zinc-300 pt-2 text-base">
            <span>Celkem</span>
            <strong>{formatCurrency(totals.total)}</strong>
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-3">
        <label className={labelClass}>
          Konstantní symbol
          <input
            className={inputClass}
            name="constantSymbol"
            defaultValue={values.constantSymbol}
            disabled={!isEditable}
          />
        </label>
        <label className={labelClass}>
          Specifický symbol
          <input
            className={inputClass}
            name="specificSymbol"
            defaultValue={values.specificSymbol}
            disabled={!isEditable}
          />
        </label>
        <label className={`${labelClass} md:col-span-3`}>
          Poznámka
          <textarea
            className="min-h-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            name="notes"
            placeholder="Např. Fakturujeme vám dle domluvy..."
            defaultValue={values.notes}
            disabled={!isEditable}
          />
        </label>
      </section>

      {isEditable ? (
        <div className="flex justify-end">
          <Button type="submit">{submitLabel}</Button>
        </div>
      ) : null}
    </form>
  );
}
