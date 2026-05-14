"use client";

/* Phase 77 — Studio icons.
 *
 * Final design HTML (Kivasy Mockup Studio Final.html) `P_KMS` path
 * tablosundan port edilmiş tek-component SVG icon seti. Repo'da
 * lucide-react mevcut ama final HTML kendi 24×24 path setini
 * kullanıyordu; studio shell'in görsel ağırlığı için aynı path setiyle
 * sadakat korunur. Studio yüzeyi dışında lucide-react kullanımı
 * dokunulmaz.
 */

import type { CSSProperties } from "react";

const P = {
  arrowL: "M19 12H5M11 5l-7 7 7 7",
  chevD: "M6 9l6 6 6-6",
  chevR: "M9 18l6-6-6-6",
  sparkle:
    "M12 4v5M12 15v5M4 12h5M15 12h5M6.3 6.3l3.5 3.5M14.2 14.2l3.5 3.5M17.7 6.3l-3.5 3.5M9.8 14.2l-3.5 3.5",
  plus: "M12 5v14M5 12h14",
  upload: "M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M16 8l-4-4-4 4M12 4v12",
  mountain: "M2 21l7-12 4 6 3-4 6 10z",
  check: "M5 12l5 5L20 7",
  retry:
    "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5",
  x: "M6 6l12 12M18 6l-12 12",
  arrow: "M5 12h14M13 5l7 7-7 7",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  undo: "M3 10h11a7 7 0 1 1 0 14H3M3 10l4-4M3 10l4 4",
  redo: "M21 10H10a7 7 0 1 0 0 14h11M21 10l-4-4M21 10l-4 4",
  expand:
    "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3",
  sun:
    "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  download: "M4 15v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M8 11l4 4 4-4M12 15V3",
  image:
    "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5z",
  layers: "M12 2 2 7l10 5 10-5zM2 12l10 5 10-5M2 17l10 5 10-5",
  blur: "M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 5v2M12 17v2M5 12H3M21 12h-2",
} as const;

export type StudioIconName = keyof typeof P;

export interface StudioIconProps {
  name: StudioIconName;
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

export function StudioIcon({
  name,
  size = 16,
  color = "currentColor",
  className,
  style,
}: StudioIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.55}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      style={style}
    >
      <path d={P[name]} />
    </svg>
  );
}

/**
 * Final HTML KivasyMark — toolbar brand glyph (port of v4 KivasyMark
 * pattern + final HTML 3-stop gradient). Geometry mirrors
 * src/components/ui/KivasyMark.tsx; studio uses a local component so
 * the sidebar mark and toolbar mark can evolve independently if needed.
 */
export function StudioBrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <defs>
        <linearGradient id="ks-brand-grad" x1="0" y1="0" x2="0" y2="1">
          {/* eslint-disable-next-line no-restricted-syntax */}
          <stop offset="0" stopColor="#F58450" />
          {/* eslint-disable-next-line no-restricted-syntax */}
          <stop offset="0.55" stopColor="#E85D25" />
          {/* eslint-disable-next-line no-restricted-syntax */}
          <stop offset="1" stopColor="#C9491A" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9" fill="url(#ks-brand-grad)" />
      {/* eslint-disable-next-line no-restricted-syntax */}
      <g fill="#fff">
        <rect x="10" y="9" width="3" height="22" rx="1.1" />
        <path d="M13.2 19.6 23.2 9 27.5 9 17.5 19.6 27.8 31 23.4 31 13.2 20.4Z" />
        <circle cx="29.8" cy="29" r="1.5" opacity="0.85" />
      </g>
    </svg>
  );
}
