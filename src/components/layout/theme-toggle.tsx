"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export const THEME_STORAGE_KEY = "fakturka-theme";

/**
 * Skript se vkládá do <head>, aby se třída .dark nastavila ještě před
 * prvním vykreslením a stránka neproblikla světlým motivem.
 */
export const themeInitScript = `(function(){try{var stored=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var dark=stored==="dark"||(!stored&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);}catch(error){}})();`;

/**
 * Zdrojem pravdy o motivu je třída na <html>, kterou nastavuje i skript
 * v hlavičce. Čteme ji přes useSyncExternalStore, ať se stav nekopíruje
 * do Reactu efektem.
 */
function subscribeToTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);

  observer.observe(document.documentElement, { attributeFilter: ["class"] });

  return () => observer.disconnect();
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerThemeSnapshot() {
  return false;
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  function toggleTheme() {
    const nextIsDark = !document.documentElement.classList.contains("dark");

    document.documentElement.classList.toggle("dark", nextIsDark);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextIsDark ? "dark" : "light");
    } catch {
      // Soukromý režim nebo zakázané úložiště — motiv vydrží jen do reloadu.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggleTheme}
      aria-label={
        isDark ? "Přepnout na světlý motiv" : "Přepnout na tmavý motiv"
      }
      title={isDark ? "Světlý motiv" : "Tmavý motiv"}
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Moon className="size-4" aria-hidden="true" />
      )}
    </Button>
  );
}
