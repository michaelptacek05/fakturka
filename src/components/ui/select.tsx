import * as React from "react";

import { cn } from "@/lib/utils";

import { inputClassName } from "./input";

function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(inputClassName, "cursor-pointer appearance-none bg-[length:1rem] bg-[right:0.65rem_center] bg-no-repeat pr-9 [background-image:url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2364748b' stroke-width='1.5'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")]", className)}
      {...props}
    />
  );
}

export { Select };
