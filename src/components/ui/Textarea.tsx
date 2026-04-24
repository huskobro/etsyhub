import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * EtsyHub Textarea — spec A.2.3.
 * `min-h-textarea` (80px), vertical resize. Focus: accent border (ring YOK).
 * Prefix/suffix desteği yok — satır seviyesi arayüz değil, blok elementi.
 */

const textareaVariants = cva(
  [
    "block w-full",
    "min-h-textarea",
    "resize-y",
    "px-3 py-2",
    "bg-surface border rounded-md",
    "font-sans text-base text-text placeholder:text-text-subtle",
    "outline-none transition-colors duration-fast ease-out",
    "focus:border-accent",
    "disabled:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60",
  ],
  {
    variants: {
      state: {
        default: "border-border",
        error: "border-danger focus:border-danger",
      },
    },
    defaultVariants: { state: "default" },
  },
);

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    Pick<VariantProps<typeof textareaVariants>, "state"> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { state, className, id: idProp, "aria-invalid": ariaInvalid, ...rest },
    ref,
  ) {
    const autoId = useId();
    const id = idProp ?? autoId;
    const resolvedState = state ?? (ariaInvalid ? "error" : "default");
    return (
      <textarea
        ref={ref}
        id={id}
        aria-invalid={ariaInvalid ?? (resolvedState === "error" ? true : undefined)}
        className={cn(textareaVariants({ state: resolvedState }), className)}
        {...rest}
      />
    );
  },
);
