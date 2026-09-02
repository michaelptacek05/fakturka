import Link from "next/link";
import { LogOut, ReceiptText, ShieldAlert } from "lucide-react";

import { signOut } from "@/app/login/actions";
import { MainNav } from "@/components/layout/main-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { isAuthEnabled } from "@/lib/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const authEnabled = isAuthEnabled();

  return (
    <div className="flex min-h-screen flex-col">
      {!authEnabled ? (
        <div
          role="alert"
          className="print-hidden flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-center text-sm font-medium text-destructive-foreground"
        >
          <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
          <span>
            Aplikace běží bez přihlášení. Nastavte proměnnou{" "}
            <code className="font-mono">AUTH_PASSWORD</code> a restartujte
            kontejner.
          </span>
        </div>
      ) : null}

      <header className="print-hidden sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="mr-auto flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ReceiptText className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-base font-semibold tracking-tight">
                Fakturka
              </span>
              <span className="hidden text-xs text-muted-foreground sm:block">
                Self-hosted fakturace OSVČ
              </span>
            </span>
          </Link>

          <MainNav />

          <div className="flex items-center gap-1">
            <ThemeToggle />

            {authEnabled ? (
              <form action={signOut}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Odhlásit se"
                  title="Odhlásit se"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="print-hidden border-t border-border py-6">
        <div className="mx-auto w-full max-w-7xl px-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          Fakturka — self-hosted fakturace pro české OSVČ. Aplikace nenahrazuje
          účetní ani daňové poradenství.
        </div>
      </footer>
    </div>
  );
}
