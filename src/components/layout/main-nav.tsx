"use client";

import { useState } from "react";
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

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavigationItem = {
  href: string;
  icon: LucideIcon;
  label: string;
};

const navigation: NavigationItem[] = [
  { href: "/", icon: Gauge, label: "Přehled" },
  { href: "/invoices", icon: FileText, label: "Faktury" },
  { href: "/projects", icon: FolderKanban, label: "Projekty" },
  { href: "/tasks", icon: ListTodo, label: "Úkoly" },
  { href: "/clients", icon: Users, label: "Odběratelé" },
  { href: "/import", icon: Download, label: "Import" },
  { href: "/settings/profile", icon: Settings, label: "Nastavení" },
];

function isItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const links = navigation.map((item) => {
    const isActive = isItemActive(pathname, item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        onClick={() => setIsOpen(false)}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        <item.icon className="size-4" aria-hidden="true" />
        {item.label}
      </Link>
    );
  });

  return (
    <>
      <nav
        aria-label="Hlavní navigace"
        className="hidden items-center gap-1 lg:flex"
      >
        {links}
      </nav>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="lg:hidden"
        aria-expanded={isOpen}
        aria-controls="mobilni-navigace"
        aria-label={isOpen ? "Zavřít menu" : "Otevřít menu"}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        {isOpen ? (
          <X className="size-4" aria-hidden="true" />
        ) : (
          <Menu className="size-4" aria-hidden="true" />
        )}
      </Button>

      {isOpen ? (
        <nav
          id="mobilni-navigace"
          aria-label="Hlavní navigace"
          className="order-last flex w-full flex-col gap-1 border-t border-border pt-3 lg:hidden"
        >
          {links}
        </nav>
      ) : null}
    </>
  );
}
