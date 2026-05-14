/* eslint-disable no-restricted-syntax */
/*
 * Phase 77 — Studio SVG art (PhoneSVG / Preset thumbs / TinyPhone).
 *
 * Final design HTML (Kivasy Mockup Studio Final.html) içindeki tek
 * tek SVG çizim komponentlerinin TypeScript portu. Bu dosya
 * SVG-context hex literal'leri yoğun kullanır (gradient stop'lar,
 * fill values, kompozisyon renkleri); file-level eslint-disable
 * SafeAreaEditor.tsx pattern paritesinde uygulanır.
 *
 * Studio yüzeyinin GÖRSEL referansını verir; gerçek render pipeline
 * burada değildir. Phase 78+ candidate: gerçek MinIO thumbnail'ler
 * ve recipe sample preview ile bu placeholder art değişebilir.
 */

"use client";

import type { CSSProperties } from "react";

export type StudioDesignColors = readonly [string, string];

export interface StudioDesign {
  name: string;
  dims: string;
  colors: StudioDesignColors;
  /** Phase 98 — Real asset signed URL (Sözleşme #9).
   *
   *  Stage device SVG shapes interior asset surface'inde gerçek
   *  `<image>` element olarak render edilir; placeholder palette
   *  gradient'i alt katmanda fallback olarak kalır (image yüklenene
   *  kadar; veya image broken durumunda). undefined → palette-only
   *  baseline (Phase 79 baseline). */
  imageUrl?: string | null;
}

export const STUDIO_SAMPLE_DESIGNS = {
  d1: {
    name: "hero-front-v3.png",
    dims: "2400×2400",
    colors: ["#F0E6D3", "#C49862"] as const,
  },
  d2: {
    name: "app-screen-v2.png",
    dims: "1170×2532",
    colors: ["#D5E5F0", "#90B0C8"] as const,
  },
} satisfies Record<string, StudioDesign>;

/* Phase 79 — Deterministik slot palette. Gerçek raw asset URL
 * MinIO signed URL Phase 80+ pipeline'da gelecek; şu an item.id
 * hash'inden 6 palet arasında deterministik seçim yapıyoruz —
 * operatör aynı item'ı her açışında aynı renk kompozisyonunu
 * görür. PhoneSVG `design.colors` shape'i ile birebir uyumlu. */
const STUDIO_SLOT_PALETTES: ReadonlyArray<StudioDesignColors> = [
  ["#F0E6D3", "#C49862"],
  ["#D5E5F0", "#90B0C8"],
  ["#E8D5C4", "#B8896A"],
  ["#D8C8B0", "#8A6B45"],
  ["#E4DDD1", "#A89878"],
  ["#F0D8C8", "#C09080"],
];

function hashStringToIndex(input: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h % modulo;
}

/** Phase 79 — Deterministik palette resolver. */
export function studioPaletteForItem(itemId: string): StudioDesignColors {
  const idx = hashStringToIndex(itemId, STUDIO_SLOT_PALETTES.length);
  return STUDIO_SLOT_PALETTES[idx]!;
}

/* ─── TinyPhone — style tile glyph ──────────────────────── */
export type TinyPhoneStyle =
  | "default"
  | "glassLight"
  | "glassDark"
  | "liquid"
  | "insetLight"
  | "insetDark"
  | "outline"
  | "border";

const TINY: Record<
  TinyPhoneStyle,
  {
    bg?: string;
    gradient?: string;
    border: string;
    screen: string;
    glow?: boolean;
    inset?: string;
    wire?: boolean;
    thick?: boolean;
  }
> = {
  default: {
    bg: "#2E2B28",
    border: "rgba(255,255,255,0.09)",
    screen: "#3C3835",
  },
  glassLight: {
    bg: "rgba(236,232,226,0.88)",
    border: "rgba(255,255,255,0.38)",
    screen: "rgba(255,255,255,0.38)",
  },
  glassDark: {
    bg: "#0A0908",
    border: "rgba(255,255,255,0.08)",
    screen: "rgba(0,0,0,0.6)",
    glow: true,
  },
  liquid: {
    gradient: "linear-gradient(175deg,#F58450,#C9491A)",
    border: "rgba(255,255,255,0.14)",
    screen: "rgba(0,0,0,0.2)",
  },
  insetLight: {
    bg: "#2E2B28",
    border: "rgba(255,255,255,0.09)",
    screen: "#3C3835",
    inset: "rgba(255,255,255,0.32)",
  },
  insetDark: {
    bg: "#161412",
    border: "rgba(255,255,255,0.06)",
    screen: "#0B0A09",
    inset: "rgba(0,0,0,0.75)",
  },
  outline: {
    bg: "transparent",
    border: "rgba(255,255,255,0.55)",
    screen: "transparent",
    wire: true,
  },
  border: {
    bg: "#2E2B28",
    border: "#E85D25",
    screen: "#3C3835",
    thick: true,
  },
};

export function TinyPhone({ sty = "default" }: { sty?: TinyPhoneStyle }) {
  const d = TINY[sty];
  const wrapStyle: CSSProperties = {
    width: 22,
    height: 34,
    borderRadius: 4,
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
    background: d.gradient ?? d.bg ?? "transparent",
    border: `${d.thick ? "2px" : "1px"} solid ${d.border}`,
    boxShadow: d.glow
      ? "0 0 8px rgba(232,93,37,0.2)"
      : d.inset
        ? `inset 0 0 0 3px ${d.inset}`
        : undefined,
  };
  const notchStyle: CSSProperties = {
    position: "absolute",
    top: 2.5,
    left: "50%",
    transform: "translateX(-50%)",
    width: 8,
    height: 2,
    borderRadius: 1,
    background: d.wire ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
  };
  const screenStyle: CSSProperties = {
    position: "absolute",
    left: 2.5,
    top: 6,
    right: 2.5,
    bottom: 3.5,
    borderRadius: 2.5,
    background: d.screen,
  };
  return (
    <div style={wrapStyle}>
      <div style={notchStyle} />
      {!d.wire ? <div style={screenStyle} /> : null}
    </div>
  );
}

/* ─── PhoneSVG — center stage device glyph ──────────────── */
export interface PhoneSVGProps {
  w?: number;
  h?: number;
  design?: StudioDesign | null;
  isEmpty?: boolean;
  idx?: number;
}

export function PhoneSVG({
  w = 200,
  h = 408,
  design = null,
  isEmpty = false,
  idx = 0,
}: PhoneSVGProps) {
  const bz = 10;
  const r = 26;
  const sr = r - bz;
  const sw = w - bz * 2;
  const sh = h - bz * 3;
  const sx = bz;
  const sy = bz * 2;
  const gid = `pg${idx}kf`;
  const sid = `ps${idx}kf`;
  const rid = `pr${idx}kf`;
  const dc = design ? design.colors : null;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      display="block"
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gid}
          x1="0"
          y1="0"
          x2={w * 0.6}
          y2={h}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={dc ? dc[0] : "#282420"} />
          <stop offset="100%" stopColor={dc ? dc[1] : "#161412"} />
        </linearGradient>
        <linearGradient
          id={sid}
          x1="0"
          y1="0"
          x2="0"
          y2={h * 0.55}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <linearGradient
          id={rid}
          x1="0"
          y1={h}
          x2="0"
          y2={h * 0.72}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} rx={r} fill="#0C0A09" />
      <rect x={sx} y={sy} width={sw} height={sh} rx={sr} fill={`url(#${gid})`} />
      {dc ? (
        <>
          <rect x={sx + 14} y={sy + 38} width={sw * 0.54} height={2} rx={1} fill="rgba(22,19,15,0.13)" />
          <rect x={sx + 14} y={sy + 46} width={sw * 0.36} height={2} rx={1} fill="rgba(22,19,15,0.08)" />
          <rect x={sx + 14} y={sy + 70} width={sw - 28} height={sw - 28} rx={7} fill="rgba(22,19,15,0.09)" />
          <rect x={sx + 14} y={sy + 78 + sw - 28} width={sw * 0.47} height={2} rx={1} fill="rgba(22,19,15,0.1)" />
          <rect x={sx + 14} y={sy + 86 + sw - 28} width={sw * 0.31} height={2} rx={1} fill="rgba(22,19,15,0.07)" />
        </>
      ) : null}
      {isEmpty ? (
        <text
          x={w / 2}
          y={h / 2 + 8}
          textAnchor="middle"
          fill="rgba(255,255,255,0.13)"
          fontSize={20}
          fontFamily="ui-sans-serif"
          style={{ userSelect: "none" }}
        >
          +
        </text>
      ) : null}
      <rect x={w / 2 - 16} y={sy + 7} width={32} height={9} rx={4.5} fill="#0C0A09" />
      <rect x={-1.5} y={h * 0.28} width={3} height={18} rx={1.5} fill="#080706" />
      <rect x={-1.5} y={h * 0.37} width={3} height={27} rx={1.5} fill="#080706" />
      <rect x={w - 1.5} y={h * 0.31} width={3} height={34} rx={1.5} fill="#080706" />
      <rect x={w / 2 - 20} y={h - bz - 5} width={40} height={3.5} rx={2} fill="rgba(255,255,255,0.12)" />
      <rect x={sx} y={sy} width={sw} height={sh * 0.48} rx={sr} fill={`url(#${sid})`} />
      <rect x={sx} y={sy + sh * 0.55} width={sw} height={sh * 0.45} rx={sr} fill={`url(#${rid})`} />
      <rect
        x={0.5}
        y={0.5}
        width={w - 1}
        height={h - 1}
        rx={r - 0.5}
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={1}
        fill="none"
      />
    </svg>
  );
}

/* ─── Preset thumbs — Mockup mode ───────────────────────── */
function MockupPh({
  x,
  y,
  w,
  h,
  r = 0,
  o = 1,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  o?: number;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g transform={`rotate(${r} ${cx} ${cy})`} opacity={o}>
      <rect x={x} y={y} width={w} height={h} rx={3.5} fill="#3E3A37" />
      <rect x={x + 2.5} y={y + 5} width={w - 5} height={h - 9} rx={2.5} fill="#504A46" />
      <rect x={cx - 5} y={y + 2} width={10} height={3} rx={1.5} fill="#252220" />
      <rect x={x + 0.75} y={y + 0.75} width={w - 1.5} height={h * 0.45} rx={3} fill="rgba(255,255,255,0.055)" />
    </g>
  );
}

const MOCKUP_PRESETS: ReadonlyArray<{
  bg: string;
  ph: ReadonlyArray<{ x: number; y: number; w: number; h: number; r?: number; o?: number }>;
}> = [
  { bg: "#0E0C0A", ph: [{ x: 28, y: 6, w: 52, h: 72 }, { x: 86, y: 14, w: 43, h: 59, r: -5, o: 0.9 }, { x: 131, y: 24, w: 34, h: 47, r: -11, o: 0.7 }] },
  { bg: "#181513", ph: [{ x: 66, y: 9, w: 52, h: 70 }] },
  { bg: "#0D0C0B", ph: [{ x: 16, y: 12, w: 48, h: 64, r: -4 }, { x: 120, y: 12, w: 48, h: 64, r: 4 }] },
  { bg: "#0A0908", ph: [{ x: 22, y: 17, w: 140, h: 54 }] },
  { bg: "#100E0C", ph: [{ x: 12, y: 16, w: 38, h: 56, r: -14, o: 0.88 }, { x: 68, y: 10, w: 50, h: 68 }, { x: 130, y: 16, w: 38, h: 56, r: 14, o: 0.88 }] },
  { bg: "#0C0B09", ph: [{ x: 20, y: 10, w: 44, h: 68 }, { x: 76, y: 14, w: 38, h: 60, r: -5, o: 0.8 }, { x: 128, y: 10, w: 28, h: 44, r: 16, o: 0.6 }] },
];

/* Phase 86 — Asset-aware preset thumb (Mockup mode).
 *
 * Shots.so'da operator yüklediği asset'i değiştirdiğinde sağ rail
 * preset thumbnails da o asset paletiyle yeniden render oluyor —
 * statik decoration değil, **canlı karar destek yüzeyi**. Phase 86
 * fix: opsiyonel `palette` prop ile preset thumb'lar selected slot
 * paletini taşır. Yoksa Phase 77 baseline statik karanlık deko.
 *
 * Palette geldiğinde: device fill = palette[0] (warm tone), gölge
 * tarafı = palette[1] (deep tone), thumb arka planı = palette[0]
 * + soft warm tint. Operator için "kendi asset'i ile yan yana 6
 * layout varyasyonu" karar verme yüzeyi. */
function MockupPhWithPalette({
  x,
  y,
  w,
  h,
  r = 0,
  o = 1,
  palette,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  o?: number;
  palette: readonly [string, string];
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  // palette[0] = warm/light, palette[1] = deep/shadow.
  // Device frame: deep palette tone; screen area: light palette tone.
  // Operator için renkler aynı asset'in iki tonu olarak okunur.
  return (
    <g transform={`rotate(${r} ${cx} ${cy})`} opacity={o}>
      <rect x={x} y={y} width={w} height={h} rx={3.5} fill={palette[1]} />
      <rect x={x + 2.5} y={y + 5} width={w - 5} height={h - 9} rx={2.5} fill={palette[0]} />
      <rect x={cx - 5} y={y + 2} width={10} height={3} rx={1.5} fill="rgba(0,0,0,0.32)" />
      <rect x={x + 0.75} y={y + 0.75} width={w - 1.5} height={h * 0.45} rx={3} fill="rgba(255,255,255,0.08)" />
    </g>
  );
}

export function PresetThumbMockup({
  idx,
  palette,
  sceneBg,
  displayCount,
}: {
  idx: number;
  palette?: readonly [string, string];
  /** Phase 89 + Phase 98 — Scene-aware bg override. */
  sceneBg?:
    | { kind: "solid"; color: string }
    | { kind: "gradient"; from: string; to: string }
    | {
        kind: "glass";
        variant: "light" | "dark" | "frosted";
        palette: readonly [string, string] | undefined;
        lensBlur: boolean;
      };
  /** Phase 96 — Layout count Shell state. */
  displayCount?: 1 | 2 | 3;
}) {
  const c = MOCKUP_PRESETS[idx] ?? MOCKUP_PRESETS[0]!;
  const phones =
    displayCount !== undefined ? c.ph.slice(0, displayCount) : c.ph;
  const isGradient = idx === 1;
  const hasPalette = !!palette;
  const bgFromPalette = palette ? darkenForPresetBg(palette[1]) : null;
  // Phase 89 + 98 — Scene-aware bg override (solid / gradient / glass)
  const sceneGradientId =
    sceneBg?.kind === "gradient"
      ? `ks-ptm-scn-${idx}`
      : sceneBg?.kind === "glass" && sceneBg.palette
        ? `ks-ptm-glass-${idx}`
        : null;
  const sceneFill =
    sceneBg?.kind === "solid"
      ? sceneBg.color
      : sceneBg?.kind === "gradient"
        ? `url(#${sceneGradientId!})`
        : sceneBg?.kind === "glass" && sceneBg.palette
          ? `url(#${sceneGradientId!})`
          : sceneBg?.kind === "glass" && !sceneBg.palette
            ? "#1f1c18"
            : null;
  /* Phase 98 — Glass overlay color for thumb (variant-aware).
   * Operator rail'e bakınca stage glass effect'ini görür: alt katmanda
   * palette gradient, üstünde variant-tinted semi-transparent overlay. */
  const glassOverlayColor =
    sceneBg?.kind === "glass"
      ? sceneBg.variant === "dark"
        ? "rgba(15,12,8,0.42)"
        : sceneBg.variant === "frosted"
          ? "rgba(255,255,255,0.18)"
          : "rgba(255,255,255,0.28)" // light
      : null;
  const lensBlurFilterId =
    sceneBg?.kind === "glass" && sceneBg.lensBlur
      ? `ks-ptm-lens-${idx}`
      : null;
  return (
    <svg viewBox="0 0 184 88" style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
      {sceneBg?.kind === "gradient" ? (
        <defs>
          <linearGradient id={sceneGradientId!} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={sceneBg.from} />
            <stop offset="100%" stopColor={sceneBg.to} />
          </linearGradient>
        </defs>
      ) : null}
      {sceneBg?.kind === "glass" && sceneBg.palette ? (
        <defs>
          <linearGradient id={sceneGradientId!} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={sceneBg.palette[0]} />
            <stop offset="100%" stopColor={sceneBg.palette[1]} />
          </linearGradient>
        </defs>
      ) : null}
      {lensBlurFilterId ? (
        <defs>
          <filter id={lensBlurFilterId} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
      ) : null}
      {isGradient && !hasPalette && !sceneBg ? (
        <defs>
          <linearGradient id="ks-ptmg1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#181513" />
            <stop offset="100%" stopColor="#0C0B09" />
          </linearGradient>
        </defs>
      ) : null}
      {isGradient && hasPalette && !sceneBg ? (
        <defs>
          <linearGradient id={`ks-ptmg1-p${idx}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette![0]} stopOpacity="0.18" />
            <stop offset="100%" stopColor={palette![1]} stopOpacity="0.32" />
          </linearGradient>
        </defs>
      ) : null}
      <rect
        width="184"
        height="88"
        fill={
          sceneFill ??
          (isGradient
            ? hasPalette
              ? `url(#ks-ptmg1-p${idx})`
              : "url(#ks-ptmg1)"
            : (bgFromPalette ?? c.bg))
        }
      />
      <g filter={lensBlurFilterId ? `url(#${lensBlurFilterId})` : undefined}>
        {phones.map((p, i) =>
          hasPalette ? (
            <MockupPhWithPalette key={i} {...p} palette={palette!} />
          ) : (
            <MockupPh key={i} {...p} />
          ),
        )}
      </g>
      {/* Phase 98 — Glass overlay rect (variant-tinted). Operator rail'e
       *  bakınca stage'in glass effect'ini görür: alt katmandaki
       *  palette/gradient + üstüne variant-tone semi-transparent overlay
       *  (cam-üstü hissi). */}
      {glassOverlayColor ? (
        <rect
          x="0"
          y="0"
          width="184"
          height="88"
          fill={glassOverlayColor}
        />
      ) : null}
    </svg>
  );
}

/* Phase 86 — Helper: palette[1] (deep tone) → preset bg için subtle
 * dark tint. Hex tone'u doğrudan göstermek yerine alpha üzerinden
 * dark surface'le karıştırırız (dark Studio shell ile uyumlu).
 *
 * Phase 90 — Visual parity correction:
 * Phase 86 baseline lerp 0.18/0.82 ile preset thumb'lar neredeyse
 * tamamen dark görünüyordu — palette ipucu %18 zayıf, Shots'taki
 * vivid scene thumb'larından çok uzak. Phase 90'da lerp 0.55/0.45
 * (palette tone'u %55 görünür) — operator preset rail'inde "scene
 * dolu" hissini alır, stage scene'iyle visual parity yakalanır. */
function darkenForPresetBg(hex: string): string {
  // Phase 90: palette tone %55 görünür, %45 dark Studio bg.
  // "Var ve sahne içinde" tonu (Phase 86'nın "var ama ezici değil"
  // çok subtle pozisyonundan vurgu ekseni güncellendi).
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#1A1612";
  const hexStr = m[1]!;
  const r = parseInt(hexStr.substring(0, 2), 16);
  const g = parseInt(hexStr.substring(2, 4), 16);
  const b = parseInt(hexStr.substring(4, 6), 16);
  const lerp = (c: number, target: number) =>
    Math.round(c * 0.55 + target * 0.45);
  const rr = lerp(r, 0x0c);
  const gg = lerp(g, 0x0b);
  const bb = lerp(b, 0x09);
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
}

/* ─── Preset thumbs — Frame mode ────────────────────────── */
function FramePh({
  x,
  y,
  w,
  h,
  r = 0,
  o = 1,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  o?: number;
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g transform={`rotate(${r} ${cx} ${cy})`} opacity={o}>
      <rect x={x} y={y} width={w} height={h} rx={3} fill="#3A3735" />
      <rect x={x + 2} y={y + 4} width={w - 4} height={h - 8} rx={2} fill="#4E4A47" />
      <rect x={cx - 4.5} y={y + 1.5} width={9} height={2.5} rx={1.3} fill="#252220" />
      <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h * 0.42} rx={3} fill="rgba(255,255,255,0.055)" />
    </g>
  );
}

function Fr({
  x,
  y,
  w,
  h,
  fill,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={fill} />
      <rect x={x} y={y} width={w} height={h * 0.38} rx={3} fill="rgba(255,255,255,0.06)" />
      <rect x={x} y={y} width={w} height={h} rx={3} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={0.75} />
    </g>
  );
}

const FRAME_PRESETS: ReadonlyArray<{
  bg: string;
  f: { x: number; y: number; w: number; h: number; fill: string };
  ph?: ReadonlyArray<{ x: number; y: number; w: number; h: number; r?: number; o?: number }>;
  split?: boolean;
}> = [
  { bg: "#0E0C0A", f: { x: 30, y: 8, w: 124, h: 72, fill: "#E4DDD1" }, ph: [{ x: 73, y: 13, w: 38, h: 54 }] },
  { bg: "#0D0C0B", f: { x: 26, y: 8, w: 130, h: 72, fill: "#DDD5CA" }, ph: [{ x: 35, y: 14, w: 36, h: 50 }] },
  { bg: "#0C0B0A", f: { x: 38, y: 10, w: 120, h: 68, fill: "#E0D8CC" }, ph: [{ x: 73, y: 5, w: 38, h: 64 }] },
  { bg: "#0E0D0B", f: { x: 30, y: 8, w: 124, h: 72, fill: "#DDD4C5" }, ph: [{ x: 73, y: 13, w: 38, h: 54, r: -9 }] },
  { bg: "#0C0B09", f: { x: 22, y: 8, w: 140, h: 72, fill: "#D8D0C4" }, ph: [{ x: 30, y: 13, w: 36, h: 52 }, { x: 118, y: 13, w: 36, h: 52 }] },
  { bg: "#0D0C0A", f: { x: 67, y: 4, w: 50, h: 80, fill: "#E6DED4" }, ph: [{ x: 73, y: 9, w: 38, h: 68 }] },
  { bg: "#0C0B09", f: { x: 22, y: 8, w: 140, h: 72, fill: "#D8D0C4" }, split: true },
  { bg: "#0E0C0A", f: { x: 26, y: 5, w: 132, h: 78, fill: "#EAE0D5" }, ph: [{ x: 60, y: 9, w: 64, h: 68, r: -5 }] },
];

/* Phase 86 — Asset-aware FramePh.
 *
 * Frame preset thumb içindeki device fill, palette geldiğinde
 * selected slot asset'inin renklerine geçer. Operator için "aynı
 * kompozisyonun farklı presentation varyasyonları" hissi —
 * Shots.so'nun preset thumb davranışı. */
function FramePhWithPalette({
  x,
  y,
  w,
  h,
  r = 0,
  o = 1,
  palette,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  o?: number;
  palette: readonly [string, string];
}) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g transform={`rotate(${r} ${cx} ${cy})`} opacity={o}>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={palette[1]} />
      <rect x={x + 2} y={y + 4} width={w - 4} height={h - 8} rx={2} fill={palette[0]} />
      <rect x={cx - 4.5} y={y + 1.5} width={9} height={2.5} rx={1.3} fill="rgba(0,0,0,0.28)" />
      <rect x={x + 0.5} y={y + 0.5} width={w - 1} height={h * 0.42} rx={3} fill="rgba(255,255,255,0.08)" />
    </g>
  );
}

export function PresetThumbFrame({
  idx,
  palette,
  sceneBg,
}: {
  idx: number;
  palette?: readonly [string, string];
  /** Phase 89 — Scene-aware bg override (Frame Solid/Gradient
   *  swatch tıklamasıyla shell sceneOverride). undefined → Phase 86
   *  baseline (sabit Frame thumb bg). */
  sceneBg?:
    | { kind: "solid"; color: string }
    | { kind: "gradient"; from: string; to: string };
}) {
  const c = FRAME_PRESETS[idx] ?? FRAME_PRESETS[0]!;
  const hasPalette = !!palette;
  // Phase 86 — Frame bg + canvas (Fr) renkleri sabit kalır
  // (presentation surface kimliği) ama device fill operator
  // paletini alır. Frame canvas: bizim Frame mode'un cream tonunda
  // kalır (operator için "bounded canvas içinde aynı kompozisyon").
  // Phase 89 — Scene-aware bg override: operator Frame Solid/Gradient
  // swatch tıklayınca thumb bg de scene'i yansıtır.
  const sceneGradientId = sceneBg?.kind === "gradient" ? `ks-ptf-scn-${idx}` : null;
  const sceneFill =
    sceneBg?.kind === "solid"
      ? sceneBg.color
      : sceneGradientId
        ? `url(#${sceneGradientId})`
        : null;
  return (
    <svg viewBox="0 0 184 88" style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
      {sceneBg?.kind === "gradient" ? (
        <defs>
          <linearGradient id={sceneGradientId!} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={sceneBg.from} />
            <stop offset="100%" stopColor={sceneBg.to} />
          </linearGradient>
        </defs>
      ) : null}
      <rect width="184" height="88" fill={sceneFill ?? c.bg} />
      <Fr {...c.f} />
      {c.split ? (
        <>
          {hasPalette ? (
            <FramePhWithPalette x={c.f.x + 4} y={c.f.y + 6} w={(c.f.w - 12) / 2} h={c.f.h - 12} palette={palette!} />
          ) : (
            <FramePh x={c.f.x + 4} y={c.f.y + 6} w={(c.f.w - 12) / 2} h={c.f.h - 12} />
          )}
          <line
            x1={c.f.x + c.f.w / 2}
            y1={c.f.y + 2}
            x2={c.f.x + c.f.w / 2}
            y2={c.f.y + c.f.h - 2}
            stroke="rgba(0,0,0,0.14)"
            strokeWidth={1}
          />
          {hasPalette ? (
            <FramePhWithPalette x={c.f.x + c.f.w / 2 + 2} y={c.f.y + 6} w={(c.f.w - 12) / 2} h={c.f.h - 12} o={0.65} palette={palette!} />
          ) : (
            <FramePh x={c.f.x + c.f.w / 2 + 2} y={c.f.y + 6} w={(c.f.w - 12) / 2} h={c.f.h - 12} o={0.65} />
          )}
        </>
      ) : (
        (c.ph ?? []).map((p, i) =>
          hasPalette ? (
            <FramePhWithPalette key={i} {...p} palette={palette!} />
          ) : (
            <FramePh key={i} {...p} />
          ),
        )
      )}
    </svg>
  );
}

/* Phase 86 — Magic Preset thumb (sidebar Magic Preset row).
 *
 * Shots.so'da Magic Preset operator'ın yüklediği asset'in
 * renklerinden auto-generated thumb gösteriyor — operator için
 * "asset'imden ne çıkacak" sinyali. Bizde palette[0]→palette[1]
 * gradient mini swatch ile aynı role oturuyor. Palette yoksa
 * (hiç slot atanmamış) k-orange fallback gradient (Studio
 * accent ile tutarlı).
 *
 * Operator için: sidebar Magic Preset row artık statik label
 * değil, "kendi asset'iyle Magic ne üretir" preview'u. */
export function MagicPresetThumb({
  palette,
  size = 22,
}: {
  palette?: readonly [string, string];
  size?: number;
}) {
  const colors: readonly [string, string] = palette ?? ["#E85D25", "#8E3A12"];
  const id = `ks-magicpresetthumb-${colors[0].slice(1)}-${colors[1].slice(1)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      aria-hidden
      style={{ display: "block", borderRadius: 5 }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <rect width="22" height="22" rx={4.5} fill={`url(#${id})`} />
      <rect width="22" height="22" rx={4.5} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={0.5} />
    </svg>
  );
}

/* ─── Phase 82 — Product-type aware stage devices ─────────
 *
 * Phase 77-81 baseline'da stage hardcoded PhoneSVG cascade idi (final
 * HTML Hero Phone Bundle referansı). Operator wall_art / sticker /
 * bookmark / tshirt set'i ile Studio'ya girdiğinde de iPhone görüyordu
 * — placeholder hissi en güçlü kaynağı. Phase 82 productType.key'e
 * göre device shape döner: wall art frame, sticker die-cut card,
 * bookmark vertical strip, tshirt silhouette (hoodie/dtf parity).
 *
 * Mockup mode = "how it looks" — asset gerçek ürün surface'inde
 * (wall art frame / sticker die-cut / tshirt front / bookmark strip
 * / poster / canvas) önizlenir. Telefon yalnız bilinmeyen kategori +
 * phone/app-screenshot use case için fallback olarak kalır.
 *
 * Schema-zero: yeni device tipi eklemek yeni dosya değil, bu helper'a
 * yeni branch. SVG path tutarlılığı için her shape aynı w/h kontrat'ı
 * + isEmpty placeholder + design.colors palette. PhoneSVG bozulmadan
 * kalır (legacy fallback + final HTML parity).
 */

export type StudioStageDeviceKind =
  | "phone"
  | "wall_art"
  | "canvas"
  | "printable"
  | "sticker"
  | "clipart"
  | "bookmark"
  | "tshirt"
  | "hoodie"
  | "dtf";

/** ProductType.key (Phase 64 enum) → stage device kind. Bilinmeyen
 *  key → "phone" fallback (operator yine de Studio kullanır). */
export function stageDeviceForProductType(
  productTypeKey: string | null | undefined,
): StudioStageDeviceKind {
  switch (productTypeKey) {
    case "wall_art":
      return "wall_art";
    case "canvas":
      return "canvas";
    case "printable":
      return "printable";
    case "sticker":
      return "sticker";
    case "clipart":
      return "clipart";
    case "bookmark":
      return "bookmark";
    case "tshirt":
      return "tshirt";
    case "hoodie":
      return "hoodie";
    case "dtf":
      return "dtf";
    default:
      return "phone";
  }
}

/** Operator-facing label for each device kind. Toolbar template
 *  pill / stage caption opsiyonel kullanım için. */
export function studioDeviceLabel(kind: StudioStageDeviceKind): string {
  switch (kind) {
    case "wall_art":
      return "Wall art frame";
    case "canvas":
      return "Canvas";
    case "printable":
      return "Printable";
    case "sticker":
      return "Sticker";
    case "clipart":
      return "Clipart bundle";
    case "bookmark":
      return "Bookmark";
    case "tshirt":
      return "T-shirt";
    case "hoodie":
      return "Hoodie";
    case "dtf":
      return "DTF transfer";
    case "phone":
    default:
      return "Phone";
  }
}

interface StageDeviceSVGProps {
  kind: StudioStageDeviceKind;
  w?: number;
  h?: number;
  design?: StudioDesign | null;
  isEmpty?: boolean;
  idx?: number;
}

/** Wall art / canvas / printable / poster framed surface. Operator
 *  gerçek "frame on wall" hissini görür — outer wood/black frame +
 *  inner cream mat + asset interior. */
function WallArtFrameSVG({
  w = 200,
  h = 250,
  design,
  isEmpty,
  idx = 0,
}: Omit<StageDeviceSVGProps, "kind">) {
  const frameW = 9;
  const matW = 14;
  const innerX = frameW + matW;
  const innerY = frameW + matW;
  const innerW = w - 2 * innerX;
  const innerH = h - 2 * innerY;
  const dc = design ? design.colors : null;
  const gid = `wag${idx}kf`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" display="block" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2={w * 0.6} y2={h} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={dc ? dc[0] : "#2A2622"} />
          <stop offset="100%" stopColor={dc ? dc[1] : "#161412"} />
        </linearGradient>
      </defs>
      {/* Outer frame */}
      <rect width={w} height={h} rx={3} fill="#1A1612" />
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={2} stroke="rgba(255,255,255,0.06)" strokeWidth={1} fill="none" />
      {/* Cream mat */}
      <rect x={frameW} y={frameW} width={w - 2 * frameW} height={h - 2 * frameW} fill="#F5F1E9" />
      {/* Interior — asset surface */}
      <rect x={innerX} y={innerY} width={innerW} height={innerH} fill={`url(#${gid})`} />
      {/* Phase 98 — Real asset image overlay (Sözleşme #9). */}
      {design?.imageUrl ? (
        <image
          href={design.imageUrl}
          x={innerX}
          y={innerY}
          width={innerW}
          height={innerH}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : dc ? (
        <>
          <rect x={innerX + 8} y={innerY + 12} width={innerW * 0.7} height={3} rx={1} fill="rgba(22,19,15,0.18)" />
          <rect x={innerX + 8} y={innerY + 20} width={innerW * 0.5} height={3} rx={1} fill="rgba(22,19,15,0.12)" />
          <rect x={innerX + 8} y={innerY + 34} width={innerW - 16} height={innerH * 0.45} rx={3} fill="rgba(22,19,15,0.1)" />
        </>
      ) : null}
      {isEmpty ? (
        <text x={w / 2} y={h / 2 + 8} textAnchor="middle" fill="rgba(22,19,15,0.22)" fontSize={20} fontFamily="ui-sans-serif" style={{ userSelect: "none" }}>+</text>
      ) : null}
    </svg>
  );
}

/** Sticker / clipart die-cut card. Rounded card silhouette, white
 *  edge ring, asset full-bleed interior. */
function StickerCardSVG({
  w = 200,
  h = 200,
  design,
  isEmpty,
  idx = 0,
}: Omit<StageDeviceSVGProps, "kind">) {
  const r = Math.min(22, Math.min(w, h) * 0.16);
  const pad = 10;
  const dc = design ? design.colors : null;
  const gid = `stg${idx}kf`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" display="block" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2={w} y2={h} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={dc ? dc[0] : "#E4DDD1"} />
          <stop offset="100%" stopColor={dc ? dc[1] : "#C8C0B4"} />
        </linearGradient>
      </defs>
      {/* White sticker outer edge */}
      <rect x={0} y={0} width={w} height={h} rx={r} fill="#FFFFFF" />
      {/* Asset surface */}
      <rect x={pad} y={pad} width={w - 2 * pad} height={h - 2 * pad} rx={r - 4} fill={`url(#${gid})`} />
      {/* Phase 98 — Real asset image overlay (Sözleşme #9). */}
      {design?.imageUrl ? (
        <>
          <defs>
            <clipPath id={`stg${idx}clip`}>
              <rect x={pad} y={pad} width={w - 2 * pad} height={h - 2 * pad} rx={r - 4} />
            </clipPath>
          </defs>
          <image
            href={design.imageUrl}
            x={pad}
            y={pad}
            width={w - 2 * pad}
            height={h - 2 * pad}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#stg${idx}clip)`}
          />
        </>
      ) : dc ? (
        <>
          <circle cx={w / 2} cy={h / 2 - 8} r={Math.min(w, h) * 0.18} fill="rgba(22,19,15,0.12)" />
          <rect x={pad + 16} y={h - pad - 22} width={w - 2 * pad - 32} height={3} rx={1} fill="rgba(22,19,15,0.16)" />
        </>
      ) : null}
      {isEmpty ? (
        <text x={w / 2} y={h / 2 + 8} textAnchor="middle" fill="rgba(22,19,15,0.22)" fontSize={22} fontFamily="ui-sans-serif" style={{ userSelect: "none" }}>+</text>
      ) : null}
      <rect x={0.5} y={0.5} width={w - 1} height={h - 1} rx={r - 0.5} stroke="rgba(0,0,0,0.1)" strokeWidth={1} fill="none" />
    </svg>
  );
}

/** Bookmark — narrow vertical strip, tassel knot top, gradient body. */
function BookmarkStripSVG({
  w = 80,
  h = 280,
  design,
  isEmpty,
  idx = 0,
}: Omit<StageDeviceSVGProps, "kind">) {
  const dc = design ? design.colors : null;
  const gid = `bmg${idx}kf`;
  const knotR = 6;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" display="block" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2={0} y2={h} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={dc ? dc[0] : "#E4DDD1"} />
          <stop offset="100%" stopColor={dc ? dc[1] : "#A89878"} />
        </linearGradient>
      </defs>
      {/* Tassel knot */}
      <circle cx={w / 2} cy={knotR + 1} r={knotR} fill="#3A3532" />
      <line x1={w / 2} y1={knotR * 2 + 1} x2={w / 2} y2={20} stroke="#3A3532" strokeWidth={1.2} />
      {/* Bookmark body */}
      <rect x={4} y={20} width={w - 8} height={h - 28} rx={3} fill={`url(#${gid})`} />
      {/* Phase 98 — Real asset image overlay (Sözleşme #9). */}
      {design?.imageUrl ? (
        <>
          <defs>
            <clipPath id={`bmg${idx}clip`}>
              <rect x={4} y={20} width={w - 8} height={h - 28} rx={3} />
            </clipPath>
          </defs>
          <image
            href={design.imageUrl}
            x={4}
            y={20}
            width={w - 8}
            height={h - 28}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#bmg${idx}clip)`}
          />
        </>
      ) : dc ? (
        <>
          <circle cx={w / 2} cy={h * 0.32} r={(w - 8) * 0.22} fill="rgba(22,19,15,0.14)" />
          <rect x={12} y={h * 0.6} width={w - 24} height={2} rx={1} fill="rgba(22,19,15,0.16)" />
          <rect x={12} y={h * 0.66} width={(w - 24) * 0.7} height={2} rx={1} fill="rgba(22,19,15,0.1)" />
        </>
      ) : null}
      {isEmpty ? (
        <text x={w / 2} y={h / 2 + 7} textAnchor="middle" fill="rgba(22,19,15,0.2)" fontSize={18} fontFamily="ui-sans-serif" style={{ userSelect: "none" }}>+</text>
      ) : null}
      <rect x={4.5} y={20.5} width={w - 9} height={h - 29} rx={2.5} stroke="rgba(0,0,0,0.18)" strokeWidth={1} fill="none" />
    </svg>
  );
}

/** T-shirt / hoodie / DTF garment silhouette. Asset chest area
 *  (front print). Hooded variant adds a small hood ellipse above
 *  shoulders. */
function TshirtSilhouetteSVG({
  w = 200,
  h = 240,
  design,
  isEmpty,
  idx = 0,
  hooded = false,
}: Omit<StageDeviceSVGProps, "kind"> & { hooded?: boolean }) {
  const dc = design ? design.colors : null;
  const gid = `tsg${idx}kf`;
  const cx = w / 2;
  const shoulderY = h * 0.18;
  const sleeveOffset = w * 0.18;
  const bodyW = w * 0.62;
  const bodyX = cx - bodyW / 2;
  const bodyY = shoulderY + h * 0.04;
  const bodyH = h - bodyY - h * 0.04;
  const chestX = cx - bodyW * 0.35;
  const chestY = bodyY + bodyH * 0.18;
  const chestW = bodyW * 0.7;
  const chestH = bodyW * 0.7;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" display="block" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2={w} y2={h} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={dc ? dc[0] : "#E4DDD1"} />
          <stop offset="100%" stopColor={dc ? dc[1] : "#A89878"} />
        </linearGradient>
      </defs>
      {/* Shadow under garment */}
      <ellipse cx={cx} cy={h - 6} rx={bodyW * 0.55} ry={4} fill="rgba(0,0,0,0.25)" />
      {/* Garment body + sleeves */}
      <path
        d={`
          M ${cx - bodyW / 2} ${shoulderY}
          Q ${cx - bodyW / 2 - sleeveOffset} ${shoulderY + h * 0.04} ${cx - bodyW / 2 - sleeveOffset * 0.6} ${shoulderY + h * 0.16}
          L ${cx - bodyW / 2} ${shoulderY + h * 0.2}
          L ${bodyX} ${h - bodyY * 0.5}
          L ${bodyX + bodyW} ${h - bodyY * 0.5}
          L ${cx + bodyW / 2} ${shoulderY + h * 0.2}
          L ${cx + bodyW / 2 + sleeveOffset * 0.6} ${shoulderY + h * 0.16}
          Q ${cx + bodyW / 2 + sleeveOffset} ${shoulderY + h * 0.04} ${cx + bodyW / 2} ${shoulderY}
          Z
        `}
        fill="#2A2622"
      />
      {/* Hood (only for hoodie kind) */}
      {hooded ? (
        <ellipse cx={cx} cy={shoulderY - h * 0.04} rx={w * 0.18} ry={h * 0.08} fill="#2A2622" />
      ) : null}
      {/* Neckline */}
      <ellipse cx={cx} cy={shoulderY + 4} rx={w * 0.12} ry={h * 0.05} fill="#161412" />
      {/* Chest area — asset */}
      <rect x={chestX} y={chestY} width={chestW} height={chestH} rx={4} fill={`url(#${gid})`} />
      {/* Phase 98 — Real asset image overlay (Sözleşme #9). */}
      {design?.imageUrl ? (
        <>
          <defs>
            <clipPath id={`tsg${idx}clip`}>
              <rect x={chestX} y={chestY} width={chestW} height={chestH} rx={4} />
            </clipPath>
          </defs>
          <image
            href={design.imageUrl}
            x={chestX}
            y={chestY}
            width={chestW}
            height={chestH}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#tsg${idx}clip)`}
          />
        </>
      ) : dc ? (
        <>
          <circle cx={chestX + chestW / 2} cy={chestY + chestH * 0.4} r={chestW * 0.22} fill="rgba(22,19,15,0.14)" />
          <rect x={chestX + 8} y={chestY + chestH - 16} width={chestW - 16} height={2} rx={1} fill="rgba(22,19,15,0.18)" />
        </>
      ) : null}
      {isEmpty ? (
        <text x={cx} y={chestY + chestH / 2 + 7} textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize={18} fontFamily="ui-sans-serif" style={{ userSelect: "none" }}>+</text>
      ) : null}
    </svg>
  );
}

/** Phase 82 — Stage device dispatcher. ProductType → device shape.
 *  Bilinmeyen / phone fallback → PhoneSVG (final HTML legacy parity).
 *  StageDeviceSVG cascade'in her slot'unda çağrılır; layout per-kind
 *  cascadeLayoutFor() ile MockupStudioStage'de hesaplanır. */
export function StageDeviceSVG({
  kind,
  w = 200,
  h = 250,
  design = null,
  isEmpty = false,
  idx = 0,
}: StageDeviceSVGProps) {
  switch (kind) {
    case "wall_art":
    case "canvas":
    case "printable":
      return <WallArtFrameSVG w={w} h={h} design={design} isEmpty={isEmpty} idx={idx} />;
    case "sticker":
    case "clipart":
      return <StickerCardSVG w={w} h={h} design={design} isEmpty={isEmpty} idx={idx} />;
    case "bookmark":
      return (
        <BookmarkStripSVG
          w={Math.min(w, h * 0.32)}
          h={h}
          design={design}
          isEmpty={isEmpty}
          idx={idx}
        />
      );
    case "tshirt":
    case "dtf":
      return <TshirtSilhouetteSVG w={w} h={h} design={design} isEmpty={isEmpty} idx={idx} />;
    case "hoodie":
      return (
        <TshirtSilhouetteSVG
          w={w}
          h={h}
          design={design}
          isEmpty={isEmpty}
          idx={idx}
          hooded
        />
      );
    case "phone":
    default:
      return <PhoneSVG w={w} h={h} design={design} isEmpty={isEmpty} idx={idx} />;
  }
}
