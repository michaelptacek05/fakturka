"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

/** Popisky pro celé cesty. Klíč je href, jak vznikne postupným skládáním segmentů. */
const pathLabels: Record<string, string> = {
  "/clients": "Odběratelé",
  "/clients/new": "Nový odběratel",
  "/import": "Import",
  "/invoices": "Faktury",
  "/invoices/new": "Nová faktura",
  "/projects": "Projekty",
  "/projects/new": "Nový projekt",
  "/settings": "Nastavení",
  "/settings/profile": "Profil",
  "/tasks": "Úkoly",
};

/** Popisky pro koncové segmenty, které stojí za identifikátorem záznamu. */
const segmentLabels: Record<string, string> = {
  edit: "Úprava",
};

/** Cesty bez vlastní stránky — zobrazí se jako text, ne jako odkaz. */
const nonNavigablePaths = new Set(["/settings"]);

type Crumb = {
  href: string;
  isCurrent: boolean;
  label: string;
};

/**
 * Segmenty bez popisku se přeskakují. Tím z cesty vypadnou identifikátory
 * záznamů, které nemají čitelný název — stopa `Faktury › Úprava` řekne víc
 * než `Faktury › cmf3x9k2p0001 › Úprava`. Na detailu tak zůstane poslední
 * drobeček odkazem na výpis a `aria-current` dostane jen skutečně aktuální
 * stránka, ne výpis, na kterém uživatel nestojí.
 */
function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let href = "";

  for (const segment of segments) {
    href += `/${segment}`;

    const label = pathLabels[href] ?? segmentLabels[segment];

    if (label) {
      crumbs.push({ href, isCurrent: href === pathname, label });
    }
  }

  return crumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);

  return (
    <nav aria-label="Drobečková navigace" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
        <li>
          <Link
            className="rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35"
            href="/"
          >
            Přehled
          </Link>
        </li>

        {crumbs.map((crumb) => (
          <li className="flex items-center gap-1.5" key={crumb.href}>
            <ChevronRight
              aria-hidden="true"
              className="size-3.5 shrink-0 text-muted-foreground/60"
            />
            {crumb.isCurrent ? (
              <span aria-current="page" className="font-medium text-foreground">
                {crumb.label}
              </span>
            ) : nonNavigablePaths.has(crumb.href) ? (
              <span className="text-muted-foreground">{crumb.label}</span>
            ) : (
              <Link
                className="rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35"
                href={crumb.href}
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
