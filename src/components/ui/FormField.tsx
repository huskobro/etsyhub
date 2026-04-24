import { cloneElement, useId, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * FormField — label + description + error kompozisyonu.
 * Tek alt çocuk (Input veya Textarea) bekler; id + aria-describedby + aria-invalid bağlar.
 */

export interface FormFieldProps {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
}

export function FormField({
  label,
  description,
  error,
  required,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  const autoId = useId();
  const fieldId = htmlFor ?? children.props.id ?? `field-${autoId}`;
  const descId = description ? `${fieldId}-desc` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [descId, errorId].filter(Boolean).join(" ") || undefined;

  const enhanced = isValidElement(children)
    ? cloneElement(children, {
        id: fieldId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={fieldId} className="text-sm font-medium text-text">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      {enhanced}
      {description && !error ? (
        <p id={descId} className="text-sm text-text-muted">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
