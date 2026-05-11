import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Kivasy StateMessage — spec A.2.8.
 * Empty / warning / error state'leri için tek primitive.
 *
 * Kural:
 * - **3 tone:** neutral / warning / error
 * - 40×40 tone-soft ikon kutusu (radius md)
 * - title 15 / weight 600
 * - body 13 muted · max-w 360
 * - padding 48 vertical · 24 horizontal
 * - Opsiyonel CTA (genelde Button primitivi)
 * - İllüstrasyon / dekoratif art / emoji YASAK (spec A.2.8 "Yanlış")
 */

const iconBoxVariants = cva(
  "flex items-center justify-center h-10 w-10 rounded-md",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-text-muted",
        warning: "bg-warning-soft text-warning",
        error: "bg-danger-soft text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type StateMessageTone = NonNullable<
  VariantProps<typeof iconBoxVariants>["tone"]
>;

export interface StateMessageProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: StateMessageTone;
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
}

export const StateMessage = forwardRef<HTMLDivElement, StateMessageProps>(
  function StateMessage(
    { tone = "neutral", icon, title, body, action, className, ...rest },
    ref,
  ) {
    const role = tone === "error" ? "alert" : "status";
    const ariaLive = tone === "error" ? "assertive" : "polite";
    return (
      <div
        ref={ref}
        role={role}
        aria-live={ariaLive}
        className={cn(
          "flex flex-col items-center text-center gap-3",
          "py-12 px-6",
          className,
        )}
        {...rest}
      >
        {icon ? (
          <div className={iconBoxVariants({ tone })} aria-hidden>
            {icon}
          </div>
        ) : null}
        <div className="text-md font-semibold text-text">{title}</div>
        {body ? (
          <p className="max-w-state-body text-sm text-text-muted">{body}</p>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    );
  },
);
