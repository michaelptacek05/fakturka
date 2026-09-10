import * as React from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  actions?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
};

function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-eyebrow text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="text-[1.75rem] font-semibold leading-tight">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export { PageHeader };
