"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FieldProps = {
  children: React.ReactNode;
  className?: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  label: React.ReactNode;
  required?: boolean;
};

/** Popisek, ovládací prvek a nápověda v jednotném rozestupu. */
function Field({
  children,
  className,
  hint,
  htmlFor,
  label,
  required,
}: FieldProps) {
  const hintId = `${React.useId()}-hint`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {React.Children.map(children, (child) => {
        if (!hint || !React.isValidElement<{ "aria-describedby"?: string }>(child)) {
          return child;
        }
        return React.cloneElement(child, {
          "aria-describedby": [child.props["aria-describedby"], hintId].filter(Boolean).join(" "),
        });
      })}
      {hint ? <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type InputFieldProps = Omit<FieldProps, "children"> &
  Omit<React.ComponentProps<"input">, "className">;

function InputField({
  className,
  hint,
  label,
  required,
  ...props
}: InputFieldProps) {
  const generatedId = React.useId();
  const id = props.id ?? generatedId;
  return (
    <Field
      className={className}
      hint={hint}
      htmlFor={id}
      label={label}
      required={required}
    >
      <Input {...props} id={id} required={required} />
    </Field>
  );
}

type TextareaFieldProps = Omit<FieldProps, "children"> &
  Omit<React.ComponentProps<"textarea">, "className">;

function TextareaField({
  className,
  hint,
  label,
  required,
  ...props
}: TextareaFieldProps) {
  const generatedId = React.useId();
  const id = props.id ?? generatedId;
  return (
    <Field
      className={className}
      hint={hint}
      htmlFor={id}
      label={label}
      required={required}
    >
      <Textarea {...props} id={id} required={required} />
    </Field>
  );
}

type SelectFieldProps = Omit<FieldProps, "children"> &
  Omit<React.ComponentProps<"select">, "className">;

function SelectField({
  children,
  className,
  hint,
  label,
  required,
  ...props
}: SelectFieldProps) {
  const generatedId = React.useId();
  const id = props.id ?? generatedId;
  return (
    <Field
      className={className}
      hint={hint}
      htmlFor={id}
      label={label}
      required={required}
    >
      <Select {...props} id={id} required={required}>
        {children}
      </Select>
    </Field>
  );
}

export { Field, InputField, SelectField, TextareaField };
