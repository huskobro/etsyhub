/**
 * KivasyMark / KivasyWord — canonical brand primitives.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx
 * (KivasyMark + KivasyWord). Geometry must remain byte-equivalent across
 * sidebar, footer, og-image, favicon, marketing surfaces.
 *
 * The mark is a custom-K: vertical bar (`<rect>`) + chevron leg with cut
 * (`<path>`) + signature dot (`<circle>`). 3-stop coral gradient
 * (#F58450 → #E85D25 → #C9491A) on a rounded square. The wordmark is
 * "Kivasy" in Clash Display 600, letter-spacing -0.045em, with an orange
 * period as the only mandatory accent moment.
 *
 * Forbidden alts: "Ki" typographic placeholder, Inter, IBM Plex Mono.
 */

export interface KivasyMarkProps {
  size?: number;
  className?: string;
  /** Stable per-instance gradient id; default "k-mark". Pass unique
   *  values when multiple marks render in the same SVG context. */
  idSuffix?: string;
}

export function KivasyMark({
  size = 32,
  className,
  idSuffix = "default",
}: KivasyMarkProps) {
  const gradId = `k-mark-fill-${idSuffix}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          {/* eslint-disable-next-line no-restricted-syntax */}
          <stop offset="0" stopColor="#F58450" />
          {/* eslint-disable-next-line no-restricted-syntax */}
          <stop offset="0.55" stopColor="#E85D25" />
          {/* eslint-disable-next-line no-restricted-syntax */}
          <stop offset="1" stopColor="#C9491A" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill={`url(#${gradId})`} />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="9.5"
        fill="none"
        // eslint-disable-next-line no-restricted-syntax
        stroke="rgba(255,255,255,0.20)"
      />
      {/* eslint-disable-next-line no-restricted-syntax */}
      <g fill="#FFFFFF">
        <rect x="10" y="9" width="3" height="22" rx="1.2" />
        <path d="M13.2 19.6 23.2 9 27.5 9 17.5 19.6 27.8 31 23.4 31 13.2 20.4 Z" />
        <circle cx="29.8" cy="29" r="1.6" opacity="0.85" />
      </g>
    </svg>
  );
}

export interface KivasyWordProps {
  size?: number;
  className?: string;
}

export function KivasyWord({ size = 20, className }: KivasyWordProps) {
  return (
    <span
      className={`k-wordmark ${className ?? ""}`}
      // eslint-disable-next-line no-restricted-syntax
      style={{ fontSize: size, lineHeight: 1 }}
    >
      Kivasy
      {/* eslint-disable-next-line no-restricted-syntax */}
      <span style={{ color: "var(--k-orange)" }}>.</span>
    </span>
  );
}

/** Compact horizontal lockup: mark + wordmark, gap 12px. */
export function KivasyLockup({
  markSize = 32,
  wordSize = 20,
  className,
}: {
  markSize?: number;
  wordSize?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-3 ${className ?? ""}`}
    >
      <KivasyMark size={markSize} />
      <KivasyWord size={wordSize} />
    </span>
  );
}
