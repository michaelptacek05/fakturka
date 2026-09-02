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
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
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
  return (
    <Field
      className={className}
      hint={hint}
      htmlFor={props.id ?? props.name}
      label={label}
      required={required}
    >
      <Input id={props.id ?? props.name} required={required} {...props} />
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
  return (
    <Field
      className={className}
      hint={hint}
      htmlFor={props.id ?? props.name}
      label={label}
      required={required}
    >
      <Textarea id={props.id ?? props.name} required={required} {...props} />
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
  return (
    <Field
      className={className}
      hint={hint}
      htmlFor={props.id ?? props.name}
      label={label}
      required={required}
    >
      <Select id={props.id ?? props.name} required={required} {...props}>
        {children}
      </Select>
    </Field>
  );
}

export { Field, InputField, SelectField, TextareaField };
