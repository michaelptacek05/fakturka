import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";

import { signIn } from "@/app/login/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/field";
import { isAuthEnabled, sanitizeRedirectPath } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Přihlášení — Fakturka",
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

function getErrorMessage(error: string | undefined) {
  switch (error) {
    case "invalid":
      return "Nesprávné heslo.";
    case "locked":
      return "Příliš mnoho neúspěšných pokusů. Zkuste to znovu za pět minut.";
    default:
      return null;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  // Bez nastaveného hesla nemá přihlašovací stránka smysl.
  if (!isAuthEnabled()) {
    redirect("/");
  }

  const nextPath = sanitizeRedirectPath(params.next);
  const errorMessage = getErrorMessage(params.error);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/*
        Zelený panel drží identitu aplikace i tam, kde ještě není sidebar.
        Na úzkých displejích se schová, ať zbyde místo na formulář.
      */}
      <div className="hidden flex-col justify-between bg-sidebar p-12 lg:flex">
        <div className="flex flex-col gap-1">
          <span className="text-xl font-semibold tracking-[-0.02em] text-sidebar-primary">
            Fakturka
          </span>
          <span className="text-sm text-sidebar-muted">Fakturace OSVČ</span>
        </div>

        <p className="max-w-sm text-[1.375rem] font-medium leading-snug tracking-[-0.015em] text-sidebar-primary">
          Faktury, odběratelé a odvody. Na vlastním serveru, bez měsíčního
          poplatku.
        </p>

        <p className="text-xs text-sidebar-muted">
          Self-hosted fakturace pro české OSVČ.
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <span className="text-lg font-semibold tracking-[-0.02em] lg:hidden">
              Fakturka
            </span>
            <h1 className="text-[1.75rem] font-semibold leading-tight">
              Přihlášení
            </h1>
            <p className="text-sm text-muted-foreground">
              Zadejte heslo pro přístup k fakturaci.
            </p>
          </div>

          {errorMessage ? (
            <Alert variant="destructive" title={errorMessage} />
          ) : null}

          <form action={signIn} className="space-y-5">
            <input type="hidden" name="next" value={nextPath} />

            <InputField
              label="Heslo"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
            />

            <Button type="submit" className="w-full">
              <KeyRound className="size-4" aria-hidden="true" />
              Přihlásit se
            </Button>
          </form>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Heslo se nastavuje proměnnou prostředí AUTH_PASSWORD.
          </p>
        </div>
      </div>
    </div>
  );
}
