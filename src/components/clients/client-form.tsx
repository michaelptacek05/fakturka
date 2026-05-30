"use client";

import { CompanyLookup } from "@/components/ares/company-lookup";
import { Button } from "@/components/ui/button";
import { createClient, deleteClient, updateClient } from "@/app/actions";

type ClientFormValues = {
  clientCity: string;
  clientCountry: string;
  clientDic: string;
  clientEmail: string;
  clientIco: string;
  clientName: string;
  clientPhone: string;
  clientPostalCode: string;
  clientStreet: string;
};

type ClientFormProps = {
  clientId?: string;
  defaultValues?: Partial<ClientFormValues>;
};

const inputClass =
  "h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition-colors focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200";
const labelClass = "grid gap-1.5 text-sm font-medium text-zinc-700";

export function ClientForm({ clientId, defaultValues }: ClientFormProps) {
  const formAction = clientId
    ? updateClient.bind(null, clientId)
    : createClient;
  const deleteAction = clientId
    ? deleteClient.bind(null, clientId)
    : null;
  const values: ClientFormValues = {
    clientCity: defaultValues?.clientCity ?? "",
    clientCountry: defaultValues?.clientCountry ?? "Česká republika",
    clientDic: defaultValues?.clientDic ?? "",
    clientEmail: defaultValues?.clientEmail ?? "",
    clientIco: defaultValues?.clientIco ?? "",
    clientName: defaultValues?.clientName ?? "",
    clientPhone: defaultValues?.clientPhone ?? "",
    clientPostalCode: defaultValues?.clientPostalCode ?? "",
    clientStreet: defaultValues?.clientStreet ?? "",
  };

  return (
    <div className="grid gap-6">
      <form action={formAction} className="grid gap-6">
        <section className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <div className="md:col-span-2">
            <CompanyLookup
              label="Vyhledat odběratele v ARES podle IČO"
              searchType="ico"
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

          <label className={`${labelClass} md:col-span-2`}>
            Odběratel - firma nebo jméno *
            <input
              className={inputClass}
              name="clientName"
              required
              defaultValue={values.clientName}
            />
          </label>
          <label className={labelClass}>
            Ulice a číslo *
            <input
              className={inputClass}
              name="clientStreet"
              required
              defaultValue={values.clientStreet}
            />
          </label>
          <label className={labelClass}>
            Město *
            <input
              className={inputClass}
              name="clientCity"
              required
              defaultValue={values.clientCity}
            />
          </label>
          <label className={labelClass}>
            PSČ *
            <input
              className={inputClass}
              name="clientPostalCode"
              required
              defaultValue={values.clientPostalCode}
            />
          </label>
          <label className={labelClass}>
            Země
            <input
              className={inputClass}
              name="clientCountry"
              defaultValue={values.clientCountry}
            />
          </label>
          <label className={labelClass}>
            IČO
            <input
              className={inputClass}
              name="clientIco"
              inputMode="numeric"
              defaultValue={values.clientIco}
            />
          </label>
          <label className={labelClass}>
            DIČ
            <input
              className={inputClass}
              name="clientDic"
              defaultValue={values.clientDic}
            />
          </label>
          <label className={labelClass}>
            E-mail
            <input
              className={inputClass}
              name="clientEmail"
              type="email"
              defaultValue={values.clientEmail}
            />
          </label>
          <label className={labelClass}>
            Telefon
            <input
              className={inputClass}
              name="clientPhone"
              defaultValue={values.clientPhone}
            />
          </label>
        </section>

        <div className="flex justify-end">
          <Button type="submit">
            {clientId ? "Uložit změny" : "Přidat odběratele"}
          </Button>
        </div>
      </form>

      {deleteAction ? (
        <form
          action={deleteAction}
          className="flex justify-end"
          onSubmit={(event) => {
            if (!window.confirm("Opravdu chcete odběratele smazat?")) {
              event.preventDefault();
            }
          }}
        >
          <Button type="submit" variant="destructive">
            Smazat odběratele
          </Button>
        </form>
      ) : null}
    </div>
  );
}
