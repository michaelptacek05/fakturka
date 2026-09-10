import * as React from "react";

import { cn } from "@/lib/utils";

import { inputClassName } from "./input";

/**
 * Šipka je vykreslená jako pozadí, aby nativní <select> zůstal nativní —
 * na mobilu tím pádem otevírá systémový picker. Samotný obrázek je ve třídě
 * `.select-chevron` v globals.css, viz komentář u ní.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        inputClassName,
        "select-chevron cursor-pointer appearance-none pr-9",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
