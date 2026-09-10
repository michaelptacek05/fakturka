import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  className?: string;
  /** Doplňkový řádek pod částkou — počet dokladů, zbytek limitu a podobně. */
  detail?: React.ReactNode;
  /** Akce pod obsahem, typicky odkaz na filtrovaný seznam. */
  footer?: React.ReactNode;
  label: React.ReactNode;
  tone?: "default" | "attention";
  value: React.ReactNode;
};

/**
 * Přehledová dlaždice: popisek, částka, doplňkový řádek. Bez ikony — v mřížce
 * tří stejných karet ikona jen opakuje popisek, který je hned vedle ní.
 */
function StatCard({
  className,
  detail,
  footer,
  label,
  tone = "default",
  value,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "flex flex-col",
        tone === "attention" ? "border-destructive/35" : undefined,
        className,
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-1 p-5">
        <p className="text-eyebrow text-muted-foreground">{label}</p>
        <p
          className={cn(
            "pt-1.5 text-[1.75rem] font-semibold leading-none tracking-tight",
            tone === "attention" ? "text-destructive" : undefined,
          )}
        >
          {value}
        </p>
        {detail ? (
          <p className="pt-1.5 text-[0.8125rem] text-muted-foreground">
            {detail}
          </p>
        ) : null}
        {footer ? <div className="mt-auto pt-4">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

export { StatCard };
