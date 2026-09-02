"use client";

import * as React from "react";

type ConfirmFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
  message: string;
};

/** Formulář, který se odešle až po potvrzení. Pro mazání a jiné nevratné akce. */
export function ConfirmForm({
  action,
  children,
  className,
  message,
}: ConfirmFormProps) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
