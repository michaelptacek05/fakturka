import { LogOut, ShieldAlert } from "lucide-react";

import { signOut } from "@/app/login/actions";
import { AppNav } from "@/components/layout/app-nav";
import { isAuthEnabled } from "@/lib/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const authEnabled = isAuthEnabled();

  /*
   * Odhlašovací formulář se vykresluje tady, aby zůstal serverovou akcí,
   * a do navigace se předává jako slot. Barvy jsou sidebarové, ne obecné —
   * ghost tlačítko by na tmavě zeleném podkladu zmizelo.
   */
  const signOutSlot = authEnabled ? (
    <form action={signOut}>
      <button
        className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-sm text-sidebar-foreground/80 outline-none transition-colors hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
        type="submit"
      >
        <LogOut aria-hidden="true" className="size-4 text-sidebar-muted" />
        Odhlásit se
      </button>
    </form>
  ) : null;

  return (
    <div className="min-h-screen bg-background">
      <AppNav signOutSlot={signOutSlot} />

      <div className="lg:pl-64 print:pl-0">
        <div className="pt-14 print:pt-0">
          {!authEnabled ? (
            <div
              className="print-hidden flex items-start justify-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-foreground sm:px-6 lg:px-8"
              role="alert"
            >
              <ShieldAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-destructive"
              />
              <span>
                Aplikace běží bez přihlášení. Nastavte proměnnou{" "}
                <code className="font-mono text-[0.8125rem]">
                  AUTH_PASSWORD
                </code>{" "}
                a restartujte kontejner.
              </span>
            </div>
          ) : null}

          <main>{children}</main>
        </div>

        <footer className="print-hidden border-t border-border">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
            Fakturka — self-hosted fakturace pro české OSVČ. Aplikace nenahrazuje
            účetní ani daňové poradenství.
          </div>
        </footer>
      </div>
    </div>
  );
}
