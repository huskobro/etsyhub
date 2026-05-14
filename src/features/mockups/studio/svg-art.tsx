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

export function PresetThumbMockup({ idx }: { idx: number }) {
  const c = MOCKUP_PRESETS[idx] ?? MOCKUP_PRESETS[0]!;
  const isGradient = idx === 1;
  return (
    <svg viewBox="0 0 184 88" style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
      {isGradient ? (
        <defs>
          <linearGradient id="ks-ptmg1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#181513" />
            <stop offset="100%" stopColor="#0C0B09" />
          </linearGradient>
        </defs>
      ) : null}
      <rect width="184" height="88" fill={isGradient ? "url(#ks-ptmg1)" : c.bg} />
      {c.ph.map((p, i) => (
        <MockupPh key={i} {...p} />
      ))}
    </svg>
  );
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

export function PresetThumbFrame({ idx }: { idx: number }) {
  const c = FRAME_PRESETS[idx] ?? FRAME_PRESETS[0]!;
  return (
    <svg viewBox="0 0 184 88" style={{ width: "100%", height: "100%", display: "block" }} aria-hidden>
      <rect width="184" height="88" fill={c.bg} />
      <Fr {...c.f} />
      {c.split ? (
        <>
          <FramePh x={c.f.x + 4} y={c.f.y + 6} w={(c.f.w - 12) / 2} h={c.f.h - 12} />
          <line
            x1={c.f.x + c.f.w / 2}
            y1={c.f.y + 2}
            x2={c.f.x + c.f.w / 2}
            y2={c.f.y + c.f.h - 2}
            stroke="rgba(0,0,0,0.14)"
            strokeWidth={1}
          />
          <FramePh x={c.f.x + c.f.w / 2 + 2} y={c.f.y + 6} w={(c.f.w - 12) / 2} h={c.f.h - 12} o={0.65} />
        </>
      ) : (
        (c.ph ?? []).map((p, i) => <FramePh key={i} {...p} />)
      )}
    </svg>
  );
}
