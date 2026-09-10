import * as React from "react";

import { cn } from "@/lib/utils";

import { inputClassName } from "./input";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputClassName, "h-auto min-h-20 py-2.5", className)}
      {...props}
    />
  );
}

export { Textarea };
