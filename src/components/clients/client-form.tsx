"use client";

import { Save, Trash2, UserPlus } from "lucide-react";

import { createClient, deleteClient, updateClient } from "@/app/actions";
import { CompanyLookup } from "@/components/ares/company-lookup";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InputField } from "@/components/ui/field";

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

export function ClientForm({ clientId, defaultValues }: ClientFormProps) {
  const formAction = clientId ? updateClient.bind(null, clientId) : createClient;
  const deleteAction = clientId ? deleteClient.bind(null, clientId) : null;
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
    <div className="space-y-6">
      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Údaje odběratele</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
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

            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                className="md:col-span-2"
                label="Firma nebo jméno"
                name="clientName"
                required
                defaultValue={values.clientName}
              />
              <InputField
                label="Ulice a číslo"
                name="clientStreet"
                required
                defaultValue={values.clientStreet}
              />
              <InputField
                label="Město"
                name="clientCity"
                required
                defaultValue={values.clientCity}
              />
              <InputField
                label="PSČ"
                name="clientPostalCode"
                required
                defaultValue={values.clientPostalCode}
              />
              <InputField
                label="Země"
                name="clientCountry"
                defaultValue={values.clientCountry}
              />
              <InputField
                label="IČO"
                name="clientIco"
                inputMode="numeric"
                defaultValue={values.clientIco}
              />
              <InputField
                label="DIČ"
                name="clientDic"
                defaultValue={values.clientDic}
              />
              <InputField
                label="E-mail"
                name="clientEmail"
                type="email"
                defaultValue={values.clientEmail}
              />
              <InputField
                label="Telefon"
                name="clientPhone"
                defaultValue={values.clientPhone}
              />
            </div>
          </CardContent>

          <CardFooter className="justify-end">
            <Button type="submit">
              {clientId ? (
                <>
                  <Save className="size-4" aria-hidden="true" />
                  Uložit změny
                </>
              ) : (
                <>
                  <UserPlus className="size-4" aria-hidden="true" />
                  Přidat odběratele
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
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
          <Button type="submit" variant="destructive-outline" size="sm">
            <Trash2 className="size-4" aria-hidden="true" />
            Smazat odběratele
          </Button>
        </form>
      ) : null}
    </div>
  );
}
