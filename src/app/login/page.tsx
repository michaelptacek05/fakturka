import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound, ReceiptText } from "lucide-react";

import { signIn } from "@/app/login/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ReceiptText className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Fakturka</h1>
            <p className="text-sm text-muted-foreground">
              Zadejte heslo pro přístup k fakturaci.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4">
            {errorMessage ? (
              <Alert variant="destructive" title={errorMessage} />
            ) : null}

            <form action={signIn} className="space-y-4">
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
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Heslo se nastavuje proměnnou prostředí AUTH_PASSWORD.
        </p>
      </div>
    </div>
  );
}
