import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Kivasy Button — spec A.2.2.
 * Variant isimleri tek kaynak: primary · secondary · ghost · destructive.
 * Icon-only boyut kare; padding'den türemez, sabit kare ölçü kullanılır.
 */

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5",
    "font-sans font-medium",
    "rounded-md border",
    "transition-colors duration-fast ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-accent text-accent-foreground border-accent",
          "hover:bg-accent-hover hover:border-accent-hover",
        ],
        secondary: [
          "bg-surface text-text border-border",
          "hover:border-border-strong",
        ],
        ghost: [
          "bg-transparent text-text border-transparent",
          "hover:bg-surface-2",
        ],
        destructive: [
          "bg-surface text-danger border-border",
          "hover:border-danger hover:bg-danger-soft",
        ],
      },
      size: {
        sm: "h-control-sm text-sm",
        md: "h-control-md text-base",
        lg: "h-control-lg text-md",
      },
      iconOnly: {
        true: "p-0",
        false: "",
      },
    },
    compoundVariants: [
      { iconOnly: false, size: "sm", class: "px-2.5" },
      { iconOnly: false, size: "md", class: "px-3.5" },
      { iconOnly: false, size: "lg", class: "px-5" },
      { iconOnly: true, size: "sm", class: "w-control-sm" },
      { iconOnly: true, size: "md", class: "w-control-md" },
      { iconOnly: true, size: "lg", class: "w-control-lg" },
    ],
    defaultVariants: {
      variant: "secondary",
      size: "md",
      iconOnly: false,
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    Omit<VariantProps<typeof buttonVariants>, "iconOnly"> {
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  children?: ReactNode;
}

const spinnerSize: Record<ButtonSize, string> = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

const Spinner = ({ size }: { size: ButtonSize }) => (
  <span
    aria-hidden
    className={cn(
      "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
      spinnerSize[size],
    )}
  />
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    icon,
    iconRight,
    loading = false,
    disabled,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const iconOnly = children == null || children === false;
  const actualDisabled = disabled || loading;
  const resolvedSize: ButtonSize = size ?? "md";

  return (
    <button
      ref={ref}
      type={type}
      disabled={actualDisabled}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size: resolvedSize, iconOnly }), className)}
      {...rest}
    >
      {loading ? <Spinner size={resolvedSize} /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});
