import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

/**
 * Kivasy Toast — T-38 Stabilization Wave terfisi.
 *
 * Karar dokümanı: docs/design/implementation-notes/cp9-stabilization-wave.md
 * - 3 tone: success / error / info (yalnızca; warning/neutral YASAK).
 * - aria-live ton ayrımı içeride sabit:
 *   - success / info → role="status" + aria-live="polite"
 *   - error          → role="alert"  + aria-live="assertive"
 * - Görsel patern: rounded border + bg-{tone}-soft + text-{tone} + border-{tone}.
 * - Auto-dismiss / portal / stack / icon zorunluluğu YOK — atom primitive,
 *   konum ve yaşam döngüsü parent'a aittir (mevcut state-driven paternle uyumlu).
 *
 * Tüketim: competitor-list-page, competitor-detail-page, trend-stories-page.
 */

const toastVariants = cva(
  ["rounded-md border px-3 py-2 text-sm"],
  {
    variants: {
      tone: {
        success: "bg-success-soft text-success border-success",
        info: "bg-accent-soft text-accent border-accent",
        error: "bg-danger-soft text-danger border-danger",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

export type ToastTone = NonNullable<VariantProps<typeof toastVariants>["tone"]>;

export interface ToastProps {
  tone: ToastTone;
  message: string;
  className?: string;
}

export function Toast({ tone, message, className }: ToastProps): JSX.Element {
  const role = tone === "error" ? "alert" : "status";
  const ariaLive = tone === "error" ? "assertive" : "polite";
  return (
    <div
      role={role}
      aria-live={ariaLive}
      className={cn(toastVariants({ tone }), className)}
    >
      {message}
    </div>
  );
}
