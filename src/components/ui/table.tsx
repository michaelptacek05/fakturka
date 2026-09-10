import * as React from "react";

import { cn } from "@/lib/utils";

/** Tabulky se na úzkých displejích posouvají vodorovně uvnitř vlastního rámu. */
function TableWrapper({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-wrapper"
      className={cn("scrollbar-slim w-full overflow-x-auto", className)}
      {...props}
    />
  );
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="table"
      className={cn("w-full caption-bottom border-collapse text-sm", className)}
      {...props}
    />
  );
}

/**
 * Hlavička se odliší vlastní světlou plochou. Linku má jen dole — horní by se
 * sečetla s rámem karty nebo s patičkou hlavičky karty do dvoupixelového pruhu.
 */
function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "bg-muted/60 [&_th]:border-b [&_th]:border-border",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        "[&_tr:not(:last-child)]:border-b [&_tr]:border-border",
        className,
      )}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t border-border font-medium", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn("transition-colors hover:bg-muted/45", className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-eyebrow px-4 py-2.5 text-left align-middle text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("px-4 py-3.5 align-middle", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
};
