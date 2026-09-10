import * as React from "react";

import { cn } from "@/lib/utils";

export const inputClassName =
  "flex h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-border focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-destructive/25";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        inputClassName,
        "file:mr-3 file:h-7 file:cursor-pointer file:rounded-md file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium file:text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
