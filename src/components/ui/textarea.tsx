import * as React from "react";

import { cn } from "@/lib/utils";

import { inputClassName } from "./input";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputClassName, "min-h-20 h-auto py-2", className)}
      {...props}
    />
  );
}

export { Textarea };
