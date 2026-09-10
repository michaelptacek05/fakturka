import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Barevný pruh vlevo místo barevného rámu dokola — hlášku odliší, ale nerozbije
 * mřížku stránky tím, že by z ní udělal další zvýrazněnou kartu.
 */
const alertVariants = cva(
  "flex items-start gap-3 rounded-lg border border-border border-l-2 bg-card px-4 py-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-l-primary",
        success: "border-l-success",
        warning: "border-l-warning",
        destructive: "border-l-destructive",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

const alertIcons: Record<string, LucideIcon> = {
  destructive: XCircle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
};

const alertIconColors: Record<string, string> = {
  destructive: "text-destructive",
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
};

function Alert({
  className,
  variant = "info",
  title,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & { title?: string }) {
  const key = variant ?? "info";
  const Icon = alertIcons[key] ?? Info;

  return (
    <div
      data-slot="alert"
      role="status"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", alertIconColors[key])}
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? (
          <div className="text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { Alert };
