import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CreditCard,
  FilePlus2,
  FileText,
  Gauge,
  Settings,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  const metrics = [
    {
      label: "Měsíc",
      value: "0 Kč",
      detail: "0 vystavených faktur",
      icon: CreditCard,
    },
    {
      label: "Kvartál",
      value: "0 Kč",
      detail: "Příjmy za aktuální Q",
      icon: BarChart3,
    },
    {
      label: "Rok",
      value: "0 Kč",
      detail: "Zaplaceno v roce 2026",
      icon: Gauge,
    },
  ];

  const modules = [
    { name: "Faktury", status: "Připraven datový model", icon: FileText },
    { name: "Adresář", status: "Navrženo pro ARES", icon: Users },
    { name: "Moje údaje", status: "OSVČ profil a bankovní údaje", icon: Building2 },
    { name: "Nastavení", status: "Číselné řady a DPH", icon: Settings },
  ];

  return (
    <main className="bg-zinc-50 text-zinc-950">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Fakturka</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
              Nástěnka OSVČ
            </h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/invoices/new">
                <Users className="size-4" aria-hidden="true" />
                Nový odběratel
              </Link>
            </Button>
            <Button asChild>
              <Link href="/invoices/new">
                <FilePlus2 className="size-4" aria-hidden="true" />
                Nová faktura
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <article
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
              key={metric.label}
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-zinc-500">
                  {metric.label}
                </p>
                <metric.icon className="size-5 text-zinc-500" aria-hidden="true" />
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-normal">
                {metric.value}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{metric.detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Vývoj příjmů</h2>
                <p className="mt-1 text-sm text-zinc-500">Posledních 12 měsíců</p>
              </div>
              <ArrowUpRight className="size-5 text-emerald-600" aria-hidden="true" />
            </div>
            <div className="mt-6 flex h-64 items-end gap-3 border-b border-l border-zinc-200 px-3 pb-3">
              {[18, 28, 24, 44, 38, 52, 48, 62, 58, 72, 68, 80].map(
                (height, index) => (
                  <div
                    className="flex h-full flex-1 items-end"
                    key={`${height}-${index}`}
                  >
                    <div
                      className="w-full rounded-t-md bg-zinc-900"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                ),
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-amber-700" aria-hidden="true" />
                <h2 className="text-base font-semibold text-amber-950">
                  Po splatnosti
                </h2>
              </div>
              <p className="mt-4 text-3xl font-semibold tracking-normal text-amber-950">
                0 Kč
              </p>
              <p className="mt-1 text-sm text-amber-800">Žádné dlužné faktury</p>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold">Limit DPH</h2>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full w-0 bg-emerald-600" />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-zinc-500">12 měsíců</span>
                <span className="font-medium">0 / 2 000 000 Kč</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <article
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
              key={module.name}
            >
              <module.icon className="size-5 text-zinc-600" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold">{module.name}</h2>
              <p className="mt-1 text-sm text-zinc-500">{module.status}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
