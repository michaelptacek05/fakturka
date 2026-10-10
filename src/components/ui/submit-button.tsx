"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  disabled,
  size,
  pendingLabel = "Ukládám…",
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} size={size} type="submit" disabled={disabled || pending} aria-busy={pending}>
      {pending ? (
        <>
          <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
          {size === "icon" || size === "icon-sm" ? null : pendingLabel}
        </>
      ) : children}
    </Button>
  );
}
