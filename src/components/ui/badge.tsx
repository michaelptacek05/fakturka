import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Stavová pilulka podle referencí: tenký rám, tlumená výplň a volitelná tečka
 * v barvě stavu. Tečka nese informaci i tam, kde barva sama nestačí.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        primary: "border-primary/20 bg-primary/10 text-primary",
        success: "border-success/25 bg-success/12 text-success",
        warning: "border-warning/30 bg-warning/15 text-warning",
        destructive: "border-destructive/25 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const badgeDotColors: Record<string, string> = {
  default: "bg-muted-foreground",
  destructive: "bg-destructive",
  outline: "bg-muted-foreground",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
};

function Badge({
  className,
  variant,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            badgeDotColors[variant ?? "default"],
          )}
        />
      ) : null}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
