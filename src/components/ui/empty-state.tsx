import * as React from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  action?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  title: React.ReactNode;
};

/**
 * Prázdný stav je čistě typografický. Ikona v šedém kolečku nic nesdělovala
 * a jen opakovala to, co už říká nadpis stránky.
 */
function EmptyState({
  action,
  className,
  description,
  title,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="space-y-1.5">
        <p className="text-base font-medium tracking-tight">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export { EmptyState };
