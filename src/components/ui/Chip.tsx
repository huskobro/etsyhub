import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * EtsyHub Chip — spec A.2.5 (filter/category).
 * 28h · sans 13 · active → accent-soft bg.
 *
 * Not: Chip bir **toggle/filter** elemanıdır; eylem (form submit, navigation,
 * destructive CTA) tetiklemek için Button kullanın. Spec "chip'i button gibi
 * kullanmak" yasağı bu ayrıma işaret eder. API bu yüzden `onToggle` + `onRemove`
 * üzerine kurulu; generic `onClick` yok.
 */

type ChipBaseProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "type" | "children"
>;

export interface ChipProps extends ChipBaseProps {
  active?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  children: ReactNode;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active = false, onToggle, onRemove, disabled, className, children, ...rest },
  ref,
) {
  const handleRemove = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onRemove?.();
  };
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5",
        "h-control-sm rounded-md border",
        "font-sans text-sm font-medium",
        "transition-colors duration-fast ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        onRemove ? "pl-2.5 pr-1" : "px-2.5",
        active
          ? "bg-accent-soft text-accent-text border-transparent"
          : "bg-surface text-text border-border hover:border-border-strong",
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      {onRemove ? (
        <span
          role="button"
          tabIndex={-1}
          aria-label="Kaldır"
          onClick={handleRemove}
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-current opacity-70 hover:opacity-100 hover:bg-text/10"
        >
          <XIcon />
        </span>
      ) : null}
    </button>
  );
});

function XIcon() {
  return (
    <svg width={10} height={10} viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
