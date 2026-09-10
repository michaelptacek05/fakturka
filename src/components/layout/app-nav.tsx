"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Download,
  FileText,
  FolderKanban,
  Gauge,
  ListTodo,
  Menu,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cn } from "@/lib/utils";

const DRAWER_ID = "mobilni-navigace";

/** Musí odpovídat breakpointu `lg`, na kterém se zásuvka schovává. */
const DESKTOP_MEDIA_QUERY = "(min-width: 64rem)";

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

type NavigationGroup = {
  items: NavigationItem[];
  title?: string;
};

/**
 * Navigace je rozdělená podle toho, co uživatel dělá: doklady, práce na
 * zakázkách a nastavení. Ploché sedmipoložkové menu se v sidebaru špatně čte.
 */
const navigation: NavigationGroup[] = [
  {
    items: [{ href: "/", icon: Gauge, label: "Přehled" }],
  },
  {
    items: [
      { href: "/invoices", icon: FileText, label: "Faktury" },
      { href: "/clients", icon: Users, label: "Odběratelé" },
      { href: "/import", icon: Download, label: "Import" },
    ],
    title: "Fakturace",
  },
  {
    items: [
      { href: "/projects", icon: FolderKanban, label: "Projekty" },
      { href: "/tasks", icon: ListTodo, label: "Úkoly" },
    ],
    title: "Práce",
  },
  {
    items: [{ href: "/settings/profile", icon: Settings, label: "Nastavení" }],
    title: "Účet",
  },
];

function isItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  onNavigate,
  pathname,
}: {
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <nav aria-label="Hlavní navigace" className="flex flex-col gap-6">
      {navigation.map((group, index) => (
        <div className="space-y-1" key={group.title ?? `group-${index}`}>
          {group.title ? (
            <p className="text-eyebrow px-3 pb-1 text-sidebar-muted">
              {group.title}
            </p>
          ) : null}

          {group.items.map((item) => {
            const isActive = isItemActive(pathname, item.href);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40",
                  isActive
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground",
                )}
                href={item.href}
                key={item.href}
                onClick={onNavigate}
              >
                <item.icon
                  aria-hidden="true"
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? undefined : "text-sidebar-muted",
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Wordmark({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      className="flex flex-col gap-0.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
      href="/"
      onClick={onNavigate}
    >
      <span className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-sidebar-primary">
        Fakturka
      </span>
      <span className="text-xs text-sidebar-muted">Fakturace OSVČ</span>
    </Link>
  );
}

export function AppNav({ signOutSlot }: { signOutSlot?: React.ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /*
   * Zásuvku schovává breakpoint, ne stav. Bez tohoto hlídání by po rozšíření
   * okna zůstal `isOpen` na true, tělo zamčené proti rolování a zavírací
   * tlačítko schované pod `lg:hidden` — stránka by se nedala odemknout.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const desktop = window.matchMedia(DESKTOP_MEDIA_QUERY);

    function closeOnDesktop() {
      if (desktop.matches) {
        setIsOpen(false);
      }
    }

    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    window.addEventListener("resize", closeOnDesktop);

    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, [isOpen]);

  /*
   * Otevřená zásuvka překrývá stránku, pod ní se tedy nemá čím rolovat.
   * Samotný zámek je v CSS a platí jen pod breakpointem `lg`, takže i kdyby
   * `isOpen` po rozšíření okna zůstal viset, stránka se odemkne sama.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const root = document.documentElement;

    root.classList.add("drawer-open");

    return () => root.classList.remove("drawer-open");
  }, [isOpen]);

  /*
   * Modální zásuvka si drží fokus: po otevření skočí dovnitř, Tab uvnitř
   * cykluje a po zavření se fokus vrátí na tlačítko, kterým se otevřela.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    // Uzel se drží v proměnné, ať úklid nesahá na ref, který už může být jinde.
    const trigger = triggerRef.current;

    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

    getFocusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusable();

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [isOpen]);

  const sidebarBody = (
    <>
      <div className="px-5 py-5">
        <Wordmark onNavigate={() => setIsOpen(false)} />
      </div>

      <div className="scrollbar-slim flex-1 overflow-y-auto px-3 pb-4">
        <NavLinks onNavigate={() => setIsOpen(false)} pathname={pathname} />
      </div>

      {signOutSlot ? (
        <div className="border-t border-sidebar-border p-3">{signOutSlot}</div>
      ) : null}
    </>
  );

  return (
    <>
      <aside className="print-hidden fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        {sidebarBody}
      </aside>

      {isOpen ? (
        <div className="print-hidden fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Zavřít menu"
            className="absolute inset-0 bg-foreground/45 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
            tabIndex={-1}
            type="button"
          />
          <div
            aria-label="Menu"
            aria-modal="true"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar"
            id={DRAWER_ID}
            ref={panelRef}
            role="dialog"
          >
            <button
              aria-label="Zavřít menu"
              className="absolute right-3 top-4 flex size-9 items-center justify-center rounded-lg text-sidebar-muted outline-none transition-colors hover:bg-sidebar-accent/55 hover:text-sidebar-accent-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/40"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
            {sidebarBody}
          </div>
        </div>
      ) : null}

      <header className="print-hidden fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6 lg:left-64 lg:px-8">
        <button
          aria-controls={DRAWER_ID}
          aria-expanded={isOpen}
          aria-label="Otevřít menu"
          className="-ml-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-accent/60 hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/35 lg:hidden"
          onClick={() => setIsOpen(true)}
          ref={triggerRef}
          type="button"
        >
          <Menu aria-hidden="true" className="size-5" />
        </button>

        <Breadcrumbs />

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <ThemeToggle />
        </div>
      </header>
    </>
  );
}
