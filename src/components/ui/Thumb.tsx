import Image from "next/image";
import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Kivasy Thumb / AssetSurface — spec A.2.9.
 *
 * Asset'in görsel yüzeyi. Kart, bookmark, reference, trend story kartlarında
 * kullanılır. Spec kuralları:
 * - Aspect: card 4/3 · portrait 2/3 · square 1/1
 * - Kind fallback (9): boho · christmas · nursery · poster · clipart ·
 *   sticker · abstract · landscape · neutral
 * - Hover: `scale-subtle` (1.015×), 180ms ease-out — yalnızca görsel yüzey
 * - Selected: accent outer ring (focus ring değil, durumsal işaret)
 *
 * `hoverable` prop'u true iken hover scale ve border-strong aktif. Parent Card
 * `group` sınıfı ile sarıp `group-hover:*` üzerinden scale tetiklenebilir; bu
 * yüzden scale class'ı `group-hover:scale-subtle` ile kilitli.
 */

export type ThumbKind =
  | "boho"
  | "christmas"
  | "nursery"
  | "poster"
  | "clipart"
  | "sticker"
  | "abstract"
  | "landscape"
  | "neutral";

export type ThumbAspect = "card" | "portrait" | "square";

export interface ThumbProps extends HTMLAttributes<HTMLDivElement> {
  /** Fallback kind — src yoksa preset doku, src varsa arka plan rengi. */
  kind?: ThumbKind;
  /** `card` 4/3 (default), `portrait` 2/3, `square` 1/1. */
  aspect?: ThumbAspect;
  /** Opsiyonel remote/lokal asset URL. */
  src?: string;
  /** Alt text — src verildiğinde zorunlu sayılır (ARIA). */
  alt?: string;
  /** Seçili durum — accent outer ring. */
  selected?: boolean;
  /** Hover scale-subtle + border-strong davranışı. Default: false. */
  hoverable?: boolean;
  /** Üst-sağ slotu: küçük badge/overlay aksiyonları için. */
  overlay?: ReactNode;
  /** Neutral kind için opsiyonel mono etiket (placeholder ad vs.). */
  label?: string;
}

const kindClass: Record<ThumbKind, string> = {
  boho: "thumb-bg-boho",
  christmas: "thumb-bg-christmas",
  nursery: "thumb-bg-nursery",
  poster: "thumb-bg-poster",
  clipart: "thumb-bg-clipart",
  sticker: "thumb-bg-sticker",
  abstract: "thumb-bg-abstract",
  landscape: "thumb-bg-landscape",
  neutral: "thumb-bg-neutral",
};

const aspectClass: Record<ThumbAspect, string> = {
  card: "aspect-card",
  portrait: "aspect-portrait",
  square: "aspect-square",
};

export const Thumb = forwardRef<HTMLDivElement, ThumbProps>(function Thumb(
  {
    kind = "neutral",
    aspect = "card",
    src,
    alt,
    selected = false,
    hoverable = false,
    overlay,
    label,
    className,
    ...rest
  },
  ref,
) {
  return (
    <div
      ref={ref}
      data-kind={kind}
      data-selected={selected || undefined}
      className={cn(
        "relative w-full overflow-hidden rounded-sm",
        aspectClass[aspect],
        // Kind dokusu; src varsa görsel üstünü kapatır ama arka plan hâlâ
        // doğru rengi verir (yarı saydam veya hata halinde).
        kindClass[kind],
        // Hover scale sadece görsel yüzeyde — parent Card `group` ise
        // `group-hover` üzerinden de tetiklenir.
        hoverable &&
          "transition-transform duration ease-out group-hover:scale-subtle",
        // Selected: accent outer ring (ring-2 + offset-2)
        selected &&
          "ring-2 ring-accent ring-offset-2 ring-offset-bg",
        className,
      )}
      {...rest}
    >
      {src ? (
        <Image
          src={src}
          alt={alt ?? ""}
          fill
          sizes="(min-width: 1024px) 25vw, 50vw"
          className="object-cover"
        />
      ) : label ? (
        <span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-text-subtle">
          {label}
        </span>
      ) : null}
      {overlay ? (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {overlay}
        </div>
      ) : null}
    </div>
  );
});
