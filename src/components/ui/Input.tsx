import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Kivasy Input — spec A.2.3.
 * Wrapper flex container; fokus `:focus-within` ile wrapper'a akar (ring YOK, border accent).
 * Prefix/suffix slotları wrapper seviyesinde; prefix defaultta text-subtle.
 */

const inputWrapperVariants = cva(
  [
    "group flex items-center gap-2",
    "h-control-md px-3",
    "bg-surface border rounded-md",
    "transition-colors duration-fast ease-out",
    "focus-within:border-accent",
  ],
  {
    variants: {
      state: {
        default: "border-border",
        error: "border-danger focus-within:border-danger",
      },
      disabled: {
        true: "bg-surface-2 border-border cursor-not-allowed opacity-60",
        false: "",
      },
    },
    defaultVariants: { state: "default", disabled: false },
  },
);

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix" | "size">,
    Pick<VariantProps<typeof inputWrapperVariants>, "state"> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    prefix,
    suffix,
    state,
    disabled,
    className,
    wrapperClassName,
    id: idProp,
    "aria-invalid": ariaInvalid,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const resolvedState = state ?? (ariaInvalid ? "error" : "default");
  return (
    <div
      className={cn(
        inputWrapperVariants({ state: resolvedState, disabled: Boolean(disabled) }),
        wrapperClassName,
      )}
    >
      {prefix != null ? (
        <span className="flex shrink-0 items-center text-text-subtle">{prefix}</span>
      ) : null}
      <input
        ref={ref}
        id={id}
        disabled={disabled}
        aria-invalid={ariaInvalid ?? (resolvedState === "error" ? true : undefined)}
        className={cn(
          "flex-1 min-w-0 bg-transparent border-0 outline-none p-0",
          "font-sans text-base text-text placeholder:text-text-subtle",
          "disabled:cursor-not-allowed",
          className,
        )}
        {...rest}
      />
      {suffix != null ? (
        <span className="flex shrink-0 items-center text-text-muted">{suffix}</span>
      ) : null}
    </div>
  );
});
