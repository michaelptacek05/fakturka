import Link from "next/link";
import { FilePlus2, FileText, Gauge, Settings, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

const navigation = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/invoices", label: "Faktury", icon: FileText },
  { href: "/invoices/new", label: "Nová faktura", icon: FilePlus2 },
  { href: "/clients", label: "Odběratelé", icon: Users },
  { href: "/settings/profile", label: "Nastavení", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="print-hidden border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link href="/" className="flex flex-col">
            <span className="text-lg font-semibold tracking-normal">Fakturka</span>
            <span className="text-sm text-zinc-500">Self-hosted fakturace OSVČ</span>
          </Link>

          <nav className="flex flex-wrap gap-2">
            {navigation.map((item) => (
              <Button asChild variant="ghost" key={item.href}>
                <Link href={item.href}>
                  <item.icon className="size-4" aria-hidden="true" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
        </div>
      </header>

      {children}
    </div>
  );
}
