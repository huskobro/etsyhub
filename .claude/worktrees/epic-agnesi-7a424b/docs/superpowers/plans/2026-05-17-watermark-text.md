# Watermark (text) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mockup Studio Frame mode'a kontrollü bir **text watermark** effect'i ekle (enable + text + opacity + placement: bottom-right / center / diagonal-tile), preview = export parity korunarak.

**Architecture:** BG Effects (Phase 136) + Lens Blur (Phase 139) pattern'i birebir izlenir. Yeni `SceneOverride.watermark?` ekseni (lensBlur/bgEffect gibi mode'dan bağımsız). Tek pure-TS resolver `resolveWatermarkLayout(config, frame)` hem preview (React absolute overlay, z:10) hem export (Sharp SVG buffer composite, vignette sonrası) tarafını besler. Diagonal-tile = deterministik manuel rotated `<text>` grid (SVG `<pattern>` DEĞİL — Sharp 0.33.5 render testiyle doğrulandı).

**Tech Stack:** TypeScript (strict), React 17+, Next.js 14 App Router, Vitest, Sharp 0.33.5 (libvips/librsvg).

**Spec:** `docs/superpowers/specs/2026-05-17-watermark-text-design.md` (operatör onaylı 2026-05-17 + 2 ek uygulama guardrail'i: br/center ihmal edilmemeli — üçü de ürün-ready; watermark kompozisyonu domine etmemeli — browser proof'ta özel kontrol).

**ÖNEMLİ — repo konumu:** Kaynak kod ana repoda: `/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub`. Tüm `src/...` ve `tests/...` yolları bu köke görelidir. Komutlar bu dizinden çalıştırılır (`cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub`). Spec/plan dökümanları worktree'de; kod ana repoda.

---

## File Structure

| Dosya | Sorumluluk | Tip |
|---|---|---|
| `src/features/mockups/studio/frame-scene.ts` (627 satır) | `WatermarkConfig`/`WmOpacity`/`WmPlacement`/`WmAnchor` type, `WM_OPACITY`/`WM_DEFAULT`/`WM_TEXT_MAX` const, `normalizeWatermark`, `resolveWatermarkLayout`, `WatermarkGlyph`/`WatermarkLayout` interface, `SceneOverride.watermark?`, `EffectPanelKey += "watermark"` | Modify |
| `tests/unit/mockup/watermark.test.ts` | `normalizeWatermark` + `resolveWatermarkLayout` unit testleri | Create |
| `src/features/mockups/studio/EffectFlyout.tsx` (306 satır) | `panel === "watermark"` case: enable On/Off + text input (maxLength + sayaç) + opacity 3-segment + placement 3-segment + boş-metin notu | Modify |
| `src/features/mockups/studio/MockupStudioStage.tsx` (1397 satır) | Watermark preview overlay z:10 (vignette bloğundan sonra), `resolveWatermarkLayout`'tan map | Modify |
| `src/providers/mockup/local-sharp/frame-compositor.ts` (1373 satır) | Phase 7c — watermark SVG buffer composite (vignette sonrası), mevcut `escapeXml` reuse | Modify |
| `src/features/mockups/studio/MockupStudioShell.tsx` (1046 satır) | `sceneSnapshot.watermark`, EffectFlyout render koşuluna `"watermark"` ekle | Modify |
| `src/features/mockups/studio/MockupStudioSidebar.tsx` (1702 satır) | watermark tile wired (`data-wired="true"`, opacity 1, onOpenEffectPanel), tile-label | Modify |
| `src/features/mockups/studio/FrameExportResultBanner.tsx` (569 satır) | `isStale` — `watermarkChanged` | Modify |
| `src/server/services/frame/frame-export.service.ts` (418 satır) | persist sceneSnapshot — `watermark` normalize | Modify |
| `docs/claude/mockup-studio-contract.md` + `docs/claude/known-issues-and-deferred.md` | §7.9 Watermark normatif + deferred liste + (varsa) fallback nedeni | Modify |

**Task sırası mantığı:** Önce saf veri katmanı (Task 1-2: types + resolver + tests — TDD çekirdek). Sonra UI giriş (Task 3-5: flyout + shell + sidebar — operatör state'i değiştirebilsin). Sonra preview render (Task 6 — br/center önce, görünür sonuç). Sonra export render + parity proof (Task 7-8 — diagonal-tile doğrulaması burada). Sonra persistence/stale (Task 9-10). Son: docs + fallback checkpoint + final gate (Task 11-12).

---

### Task 1: Watermark types + `normalizeWatermark` (frame-scene.ts)

**Files:**
- Modify: `src/features/mockups/studio/frame-scene.ts` (types after line 105 `EffectPanelKey`/`BgEffectConfig` block; `EffectPanelKey` at line 97; `SceneOverride` at lines 144–185)
- Test: `tests/unit/mockup/watermark.test.ts` (create)

- [ ] **Step 1: Write the failing test (normalizeWatermark)**

Create `tests/unit/mockup/watermark.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  WM_OPACITY,
  WM_DEFAULT,
  WM_TEXT_MAX,
  normalizeWatermark,
  type WatermarkConfig,
} from "@/features/mockups/studio/frame-scene";

describe("normalizeWatermark", () => {
  it("undefined → WM_DEFAULT clone (disabled, empty text)", () => {
    const r = normalizeWatermark(undefined);
    expect(r).toEqual(WM_DEFAULT);
    expect(r).not.toBe(WM_DEFAULT); // fresh object, not shared ref
  });

  it("null → WM_DEFAULT clone", () => {
    expect(normalizeWatermark(null)).toEqual(WM_DEFAULT);
  });

  it("trims and clamps text to WM_TEXT_MAX", () => {
    const long = "x".repeat(WM_TEXT_MAX + 20);
    const r = normalizeWatermark({
      enabled: true,
      text: `  ${long}  `,
      opacity: "medium",
      placement: "br",
    });
    expect(r.text.length).toBe(WM_TEXT_MAX);
  });

  it("replaces newlines/carriage returns with single space (single-line guarantee)", () => {
    const r = normalizeWatermark({
      enabled: true,
      text: "line1\nline2\r\nline3",
      opacity: "soft",
      placement: "center",
    });
    expect(r.text).toBe("line1 line2 line3");
  });

  it("unknown opacity/placement fall back to WM_DEFAULT values", () => {
    const r = normalizeWatermark({
      enabled: true,
      text: "Shop",
      // @ts-expect-error intentional bad input
      opacity: "ultra",
      // @ts-expect-error intentional bad input
      placement: "spiral",
    });
    expect(r.opacity).toBe(WM_DEFAULT.opacity);
    expect(r.placement).toBe(WM_DEFAULT.placement);
  });

  it("valid config passes through (enabled, text, opacity, placement preserved)", () => {
    const cfg: WatermarkConfig = {
      enabled: true,
      text: "© Kivasy",
      opacity: "strong",
      placement: "tile",
    };
    expect(normalizeWatermark(cfg)).toEqual(cfg);
  });

  it("WM_OPACITY maps soft<medium<strong", () => {
    expect(WM_OPACITY.soft).toBeLessThan(WM_OPACITY.medium);
    expect(WM_OPACITY.medium).toBeLessThan(WM_OPACITY.strong);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx vitest run tests/unit/mockup/watermark.test.ts`
Expected: FAIL — `WM_OPACITY`/`normalizeWatermark` not exported from frame-scene.

- [ ] **Step 3: Add types + normalizeWatermark to frame-scene.ts**

In `src/features/mockups/studio/frame-scene.ts`, locate the `EffectPanelKey` line (line 97):

```typescript
export type EffectPanelKey = "lens" | "bgfx";
```

Replace with:

```typescript
export type EffectPanelKey = "lens" | "bgfx" | "watermark";
```

Then, immediately AFTER the `BgEffectConfig` interface block (after line 105, before `BG_VIGNETTE_ALPHA` at line 110), insert:

```typescript
/* Phase 140 — Watermark (text). Frame-only effect; mode/glass/
 * lensBlur/bgEffect'ten bağımsız eksen (SceneOverride.watermark?).
 * Preview = export aynı resolveWatermarkLayout (§11.0). Image/logo,
 * size, color, font, rotation Phase 2 (scope dışı). */
export type WmOpacity = "soft" | "medium" | "strong";
export type WmPlacement = "br" | "center" | "tile";
export type WmAnchor = "start" | "middle" | "end";

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  opacity: WmOpacity;
  placement: WmPlacement;
}

export const WM_OPACITY: Record<WmOpacity, number> = {
  soft: 0.18,
  medium: 0.3,
  strong: 0.45,
};

/** Layout-safe text clamp (spec §5.2 guardrail 2). */
export const WM_TEXT_MAX = 48;

export const WM_DEFAULT: WatermarkConfig = {
  enabled: false,
  text: "",
  opacity: "medium",
  placement: "br",
};

/** Normalize raw watermark input. Unknown enum → default;
 *  text trimmed, newlines→space (single-line), clamped to
 *  WM_TEXT_MAX. Always returns a fresh object. */
export function normalizeWatermark(
  raw: WatermarkConfig | null | undefined,
): WatermarkConfig {
  if (!raw) {
    return { ...WM_DEFAULT };
  }
  const opacity: WmOpacity =
    raw.opacity === "soft" ||
    raw.opacity === "medium" ||
    raw.opacity === "strong"
      ? raw.opacity
      : WM_DEFAULT.opacity;
  const placement: WmPlacement =
    raw.placement === "br" ||
    raw.placement === "center" ||
    raw.placement === "tile"
      ? raw.placement
      : WM_DEFAULT.placement;
  const text = String(raw.text ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, WM_TEXT_MAX);
  return {
    enabled: Boolean(raw.enabled),
    text,
    opacity,
    placement,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx vitest run tests/unit/mockup/watermark.test.ts`
Expected: PASS — 7 tests green.

- [ ] **Step 5: Typecheck**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx tsc --noEmit`
Expected: exit 0. (`EffectPanelKey` change may surface consumer errors in Sidebar/Shell — those are fixed in Task 4/5. If errors appear ONLY in MockupStudioSidebar.tsx / MockupStudioShell.tsx referencing `EffectPanelKey` union exhaustiveness, that is expected and resolved later; any OTHER file error must be fixed now.)

- [ ] **Step 6: Commit**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
git add src/features/mockups/studio/frame-scene.ts tests/unit/mockup/watermark.test.ts
git -c commit.gpgsign=false commit -m "feat(mockup): Watermark (1/12) — types + normalizeWatermark + EffectPanelKey

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 2: `resolveWatermarkLayout` + `SceneOverride.watermark?`

**Files:**
- Modify: `src/features/mockups/studio/frame-scene.ts` (`SceneOverride` lines 144–185; add resolver near `resolveLensBlurLayout` at lines 457–464)
- Test: `tests/unit/mockup/watermark.test.ts`

- [ ] **Step 1: Write the failing test (resolveWatermarkLayout)**

Append to `tests/unit/mockup/watermark.test.ts`:

```typescript
import {
  resolveWatermarkLayout,
  type WatermarkLayout,
} from "@/features/mockups/studio/frame-scene";

describe("resolveWatermarkLayout — active gating", () => {
  const FRAME = { w: 1080, h: 1080 };

  it("null config → inactive (no glyphs)", () => {
    const r = resolveWatermarkLayout(null, FRAME);
    expect(r.active).toBe(false);
    expect(r.glyphs).toEqual([]);
    expect(r.opacity).toBe(0);
  });

  it("enabled=false → inactive", () => {
    const r = resolveWatermarkLayout(
      { enabled: false, text: "Shop", opacity: "medium", placement: "br" },
      FRAME,
    );
    expect(r.active).toBe(false);
  });

  it("empty/whitespace text → inactive even if enabled", () => {
    const r = resolveWatermarkLayout(
      { enabled: true, text: "   ", opacity: "medium", placement: "center" },
      FRAME,
    );
    expect(r.active).toBe(false);
    expect(r.glyphs).toEqual([]);
  });
});

describe("resolveWatermarkLayout — placement geometry", () => {
  const FRAME = { w: 1080, h: 1080 };

  it("br → single glyph, anchor 'end', bottom-right percentages, no rotation", () => {
    const r = resolveWatermarkLayout(
      { enabled: true, text: "© Kivasy", opacity: "soft", placement: "br" },
      FRAME,
    );
    expect(r.active).toBe(true);
    expect(r.anchor).toBe("end");
    expect(r.glyphs).toHaveLength(1);
    expect(r.glyphs[0].xPct).toBe(95);
    expect(r.glyphs[0].yPct).toBe(93);
    expect(r.glyphs[0].rotateDeg).toBe(0);
    expect(r.glyphs[0].text).toBe("© Kivasy");
    expect(r.opacity).toBe(WM_OPACITY.soft);
  });

  it("center → single glyph, anchor 'middle', centered, no rotation", () => {
    const r = resolveWatermarkLayout(
      { enabled: true, text: "PROOF", opacity: "strong", placement: "center" },
      FRAME,
    );
    expect(r.anchor).toBe("middle");
    expect(r.glyphs).toHaveLength(1);
    expect(r.glyphs[0].xPct).toBe(50);
    expect(r.glyphs[0].yPct).toBe(50);
    expect(r.glyphs[0].rotateDeg).toBe(0);
    expect(r.opacity).toBe(WM_OPACITY.strong);
  });

  it("center → font scales DOWN for long text (spec §5.2 ladder)", () => {
    const short = resolveWatermarkLayout(
      { enabled: true, text: "x".repeat(10), opacity: "medium", placement: "center" },
      FRAME,
    );
    const mid = resolveWatermarkLayout(
      { enabled: true, text: "x".repeat(28), opacity: "medium", placement: "center" },
      FRAME,
    );
    const long = resolveWatermarkLayout(
      { enabled: true, text: "x".repeat(40), opacity: "medium", placement: "center" },
      FRAME,
    );
    expect(short.fontPctOfMin).toBeGreaterThan(mid.fontPctOfMin);
    expect(mid.fontPctOfMin).toBeGreaterThan(long.fontPctOfMin);
  });

  it("tile → multiple glyphs, anchor 'middle', all rotated -30, all same text", () => {
    const r = resolveWatermarkLayout(
      { enabled: true, text: "© Kivasy", opacity: "medium", placement: "tile" },
      FRAME,
    );
    expect(r.anchor).toBe("middle");
    expect(r.glyphs.length).toBeGreaterThan(4);
    expect(r.glyphs.every((g) => g.rotateDeg === -30)).toBe(true);
    expect(r.glyphs.every((g) => g.text === "© Kivasy")).toBe(true);
  });

  it("tile → grid covers frame edges (some glyphs near/below 0 and above 100 pct after offset)", () => {
    const r = resolveWatermarkLayout(
      { enabled: true, text: "WM", opacity: "soft", placement: "tile" },
      FRAME,
    );
    const minX = Math.min(...r.glyphs.map((g) => g.xPct));
    const maxX = Math.max(...r.glyphs.map((g) => g.xPct));
    expect(minX).toBeLessThanOrEqual(5); // starts at/before left edge
    expect(maxX).toBeGreaterThanOrEqual(95); // reaches right edge
  });

  it("tile glyph count is deterministic for a given frame (stable across calls)", () => {
    const a = resolveWatermarkLayout(
      { enabled: true, text: "WM", opacity: "soft", placement: "tile" },
      FRAME,
    );
    const b = resolveWatermarkLayout(
      { enabled: true, text: "WM", opacity: "soft", placement: "tile" },
      FRAME,
    );
    expect(a.glyphs.length).toBe(b.glyphs.length);
  });

  it("tile on portrait frame stays consistent density (min-dimension based steps)", () => {
    const square = resolveWatermarkLayout(
      { enabled: true, text: "WM", opacity: "soft", placement: "tile" },
      { w: 1080, h: 1080 },
    );
    const portrait = resolveWatermarkLayout(
      { enabled: true, text: "WM", opacity: "soft", placement: "tile" },
      { w: 1080, h: 1920 },
    );
    // portrait taller → more rows → more glyphs than square
    expect(portrait.glyphs.length).toBeGreaterThan(square.glyphs.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx vitest run tests/unit/mockup/watermark.test.ts`
Expected: FAIL — `resolveWatermarkLayout` / `WatermarkLayout` not exported.

- [ ] **Step 3: Add SceneOverride.watermark + interfaces + resolver**

In `src/features/mockups/studio/frame-scene.ts`, find the `SceneOverride` interface (ends at line 185 with `bgEffect?: BgEffectConfig;` then `}`). Add the watermark field right before the closing `}`:

```typescript
  /** Phase 140 — Watermark (text). Frame-only; mode/glass/
   *  lensBlur/bgEffect'ten bağımsız. undefined/null = no watermark.
   *  resolveWatermarkLayout ile preview+export aynı geometri (§11.0).
   *  EN ÜST katman (vignette'den sonra composite). */
  watermark?: WatermarkConfig | null;
```

Then add interfaces + resolver immediately AFTER `resolveLensBlurLayout` (after line 464). First add the glyph/layout interfaces near `LensBlurLayout` (after line 455), then the resolver:

```typescript
export interface WatermarkGlyph {
  /** Daima normalize edilmiş config.text. */
  text: string;
  /** 0..100 — frame genişliğinin yüzdesi. */
  xPct: number;
  /** 0..100 — frame yüksekliğinin yüzdesi. */
  yPct: number;
  rotateDeg: number;
}

export interface WatermarkLayout {
  /** false → preview/export hiçbir şey çizmez. */
  active: boolean;
  glyphs: WatermarkGlyph[];
  /** WM_OPACITY[config.opacity] veya 0 (inactive). */
  opacity: number;
  /** font-size = min(frameW,frameH) * fontPctOfMin. */
  fontPctOfMin: number;
  /** Tüm glyph'ler için ortak text-anchor. */
  anchor: WmAnchor;
}

/** Pure-TS, DOM/zoom/bg-bağımsız. Preview (React overlay z:10) ve
 *  export (Sharp SVG buffer composite, vignette sonrası) BU
 *  fonksiyondan beslenir — §11.0 Preview = Export Truth tek yer.
 *  Geometri yüzde tabanlı → frame boyutundan bağımsız. */
export function resolveWatermarkLayout(
  config: WatermarkConfig | null | undefined,
  frame: { w: number; h: number },
): WatermarkLayout {
  const cfg = normalizeWatermark(config);
  if (!cfg.enabled || cfg.text.length === 0) {
    return {
      active: false,
      glyphs: [],
      opacity: 0,
      fontPctOfMin: 0,
      anchor: "middle",
    };
  }
  const opacity = WM_OPACITY[cfg.opacity];

  if (cfg.placement === "br") {
    return {
      active: true,
      glyphs: [{ text: cfg.text, xPct: 95, yPct: 93, rotateDeg: 0 }],
      opacity,
      fontPctOfMin: 0.035,
      anchor: "end",
    };
  }

  if (cfg.placement === "center") {
    // Spec §5.2 — uzun metin font kademesi (taşma engelle, parity korunur)
    const len = cfg.text.length;
    const fontPctOfMin = len <= 16 ? 0.06 : len <= 32 ? 0.045 : 0.034;
    return {
      active: true,
      glyphs: [{ text: cfg.text, xPct: 50, yPct: 50, rotateDeg: 0 }],
      opacity,
      fontPctOfMin,
      anchor: "middle",
    };
  }

  // placement === "tile" — deterministik rotated grid (spec §4.2)
  const minDim = Math.min(frame.w, frame.h);
  // Yüzde-uzayda step: px-step / frame-dim * 100. Step px = minDim * çarpan.
  const stepXPct = ((minDim * 0.42) / frame.w) * 100;
  const stepYPct = ((minDim * 0.16) / frame.h) * 100;
  const glyphs: WatermarkGlyph[] = [];
  // Negatif offset'ten başla ki köşeler boş kalmasın; +step buffer.
  for (let yPct = -stepYPct * 0.5; yPct <= 100 + stepYPct; yPct += stepYPct) {
    for (let xPct = -stepXPct * 0.5; xPct <= 100 + stepXPct; xPct += stepXPct) {
      glyphs.push({
        text: cfg.text,
        xPct: Math.round(xPct * 100) / 100,
        yPct: Math.round(yPct * 100) / 100,
        rotateDeg: -30,
      });
    }
  }
  return {
    active: true,
    glyphs,
    opacity,
    fontPctOfMin: 0.026,
    anchor: "middle",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx vitest run tests/unit/mockup/watermark.test.ts`
Expected: PASS — all watermark tests green (normalize + resolver).

- [ ] **Step 5: Run full mockup suite (regression check)**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx vitest run tests/unit/mockup/`
Expected: PASS — existing bg-effects + all mockup tests still green; new watermark tests included.

- [ ] **Step 6: Typecheck + commit**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
npx tsc --noEmit   # expect 0 (Sidebar/Shell EffectPanelKey exhaustiveness may still warn — fixed Task 4/5)
git add src/features/mockups/studio/frame-scene.ts tests/unit/mockup/watermark.test.ts
git -c commit.gpgsign=false commit -m "feat(mockup): Watermark (2/12) — resolveWatermarkLayout + SceneOverride.watermark

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 3: EffectFlyout watermark panel

**Files:**
- Modify: `src/features/mockups/studio/EffectFlyout.tsx` (`EffectFlyoutProps` lines 26–31; panel cases — bgfx at 199–248, lens at 96–136; add watermark case)

- [ ] **Step 1: Read the flyout structure**

Read `src/features/mockups/studio/EffectFlyout.tsx` fully (306 lines). Note: it switches on `panel` prop (`"lens"` / `"bgfx"`). `SEG_LABEL_STYLE` is a shared const for segment labels. Segments use `className="k-studio__tile"`, `data-active`, `aria-pressed`, inline style with `--ks-or-bright`/`--ks-orb`/`--ks-t2`/`--ks-t3` tokens. `onChangeSceneOverride({...activeScene, <field>})` is the write pattern. There is no test framework for this component (UI verified in browser per Task 6/7) — so NO unit test step here; correctness proven via tsc + browser.

- [ ] **Step 2: Add watermark panel case**

In `EffectFlyout.tsx`, find where `panel === "bgfx"` case block ends (around line 248, before the closing of the panel conditional chain). Add a new `panel === "watermark"` branch parallel to the lens/bgfx branches. Insert this block (place it as a sibling conditional alongside the existing `panel === "lens"` / `panel === "bgfx"` blocks — match the existing conditional structure in the file):

```tsx
{panel === "watermark" ? (
  (() => {
    const wm = normalizeWatermark(activeScene.watermark);
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {/* Enable On/Off */}
        <div style={{ display: "flex", gap: 4 }}>
          {(
            [
              [true, "On"],
              [false, "Off"],
            ] as [boolean, string][]
          ).map(([en, lbl]) => {
            const active = wm.enabled === en;
            return (
              <button
                key={String(en)}
                type="button"
                className="k-studio__tile"
                data-testid={`studio-wm-enable-${en ? "on" : "off"}`}
                data-active={active ? "true" : "false"}
                aria-pressed={active}
                onClick={() =>
                  onChangeSceneOverride({
                    ...activeScene,
                    watermark: { ...wm, enabled: en },
                  })
                }
                style={{
                  flex: 1,
                  minHeight: 30,
                  fontSize: 10.5,
                  color: active ? "var(--ks-or-bright)" : "var(--ks-t2)",
                  borderColor: active
                    ? "var(--ks-orb)"
                    : "rgba(255,255,255,0.12)",
                }}
              >
                {lbl}
              </button>
            );
          })}
        </div>

        {/* Text input + counter */}
        <div>
          <div style={SEG_LABEL_STYLE}>Text</div>
          <input
            type="text"
            data-testid="studio-wm-text"
            value={wm.text}
            maxLength={WM_TEXT_MAX}
            placeholder="e.g. © Your Shop"
            onChange={(e) =>
              onChangeSceneOverride({
                ...activeScene,
                watermark: { ...wm, text: e.target.value },
              })
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              minHeight: 30,
              fontSize: 11,
              padding: "4px 8px",
              color: "var(--ks-t1)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 4,
            }}
          />
          <div
            data-testid="studio-wm-counter"
            style={{
              fontSize: 9.5,
              color: "var(--ks-t3)",
              textAlign: "right",
              marginTop: 2,
            }}
          >
            {wm.text.trim().length} / {WM_TEXT_MAX}
          </div>
          {wm.text.trim().length === 0 ? (
            <div
              data-testid="studio-wm-empty-note"
              style={{ fontSize: 10.5, color: "var(--ks-t3)", padding: "2px 0" }}
            >
              Enter watermark text to preview.
            </div>
          ) : null}
        </div>

        {/* Opacity segment */}
        <div>
          <div style={SEG_LABEL_STYLE}>Opacity</div>
          <div style={{ display: "flex", gap: 4 }}>
            {(
              [
                ["soft", "Soft"],
                ["medium", "Medium"],
                ["strong", "Strong"],
              ] as [WmOpacity, string][]
            ).map(([iv, lbl]) => {
              const active = wm.opacity === iv;
              return (
                <button
                  key={iv}
                  type="button"
                  className="k-studio__tile"
                  data-testid={`studio-wm-opacity-${iv}`}
                  data-active={active ? "true" : "false"}
                  aria-pressed={active}
                  onClick={() =>
                    onChangeSceneOverride({
                      ...activeScene,
                      watermark: { ...wm, opacity: iv },
                    })
                  }
                  style={{
                    flex: 1,
                    minHeight: 30,
                    fontSize: 10.5,
                    color: active ? "var(--ks-or-bright)" : "var(--ks-t2)",
                    borderColor: active
                      ? "var(--ks-orb)"
                      : "rgba(255,255,255,0.12)",
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>

        {/* Placement segment */}
        <div>
          <div style={SEG_LABEL_STYLE}>Placement</div>
          <div style={{ display: "flex", gap: 4 }}>
            {(
              [
                ["br", "Bottom-right"],
                ["center", "Center"],
                ["tile", "Diagonal"],
              ] as [WmPlacement, string][]
            ).map(([pv, lbl]) => {
              const active = wm.placement === pv;
              return (
                <button
                  key={pv}
                  type="button"
                  className="k-studio__tile"
                  data-testid={`studio-wm-placement-${pv}`}
                  data-active={active ? "true" : "false"}
                  aria-pressed={active}
                  onClick={() =>
                    onChangeSceneOverride({
                      ...activeScene,
                      watermark: { ...wm, placement: pv },
                    })
                  }
                  style={{
                    flex: 1,
                    minHeight: 30,
                    fontSize: 10,
                    color: active ? "var(--ks-or-bright)" : "var(--ks-t2)",
                    borderColor: active
                      ? "var(--ks-orb)"
                      : "rgba(255,255,255,0.12)",
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  })()
) : null}
```

- [ ] **Step 3: Add imports**

At the top of `EffectFlyout.tsx`, the existing import from `frame-scene` (it already imports `LENS_BLUR_DEFAULT`, `normalizeLensBlur`, `BgEffectKind`, etc.). Add `normalizeWatermark`, `WM_TEXT_MAX`, `WmOpacity`, `WmPlacement` to that import list. Example — find the import block and extend it:

```typescript
import {
  // ...existing: SceneOverride, EffectPanelKey, normalizeLensBlur,
  // LENS_BLUR_DEFAULT, LensBlurIntensity, BgEffectKind, BgEffectIntensity...
  normalizeWatermark,
  WM_TEXT_MAX,
  type WmOpacity,
  type WmPlacement,
} from "@/features/mockups/studio/frame-scene";
```

(Match the exact existing import style — if it's a single multi-line import, add into it; do not create a duplicate import statement.)

- [ ] **Step 4: Typecheck**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx tsc --noEmit`
Expected: exit 0 for EffectFlyout.tsx. (Sidebar/Shell may still error on `EffectPanelKey` — resolved Task 4/5.)

- [ ] **Step 5: Commit**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
git add src/features/mockups/studio/EffectFlyout.tsx
git -c commit.gpgsign=false commit -m "feat(mockup): Watermark (3/12) — EffectFlyout panel (enable/text/opacity/placement)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 4: Wire watermark tile in Sidebar

**Files:**
- Modify: `src/features/mockups/studio/MockupStudioSidebar.tsx` (`efx` array line 951–956; tile block 1204–1278; tile-label ~1265–1271)

- [ ] **Step 1: Read the tile wiring**

Read `MockupStudioSidebar.tsx` lines 940–1290. Current state: `efx` array has `{ k: "watermark", l: "Watermark", n: "layers" }`. The tile map computes `isWired = isLens || isBgfx` → watermark is `data-wired="false"`, opacity 0.78, title `"Watermark — preview only (Phase 99+ candidate)"`, onClick falls to `setEffect(k)` (no-op for watermark). `onOpenEffectPanel` is the prop that opens the flyout.

- [ ] **Step 2: Make watermark a wired effect**

In `MockupStudioSidebar.tsx`, find the tile-map logic (around line 1206):

```typescript
const isLens = k === "lens";
const isBgfx = k === "bgfx";
const isWired = isLens || isBgfx;
```

Replace with:

```typescript
const isLens = k === "lens";
const isBgfx = k === "bgfx";
const isWm = k === "watermark";
const isWired = isLens || isBgfx || isWm;
```

Then find the `on` computation (around line 1209):

```typescript
const on = isLens
  ? lensActive
  : isBgfx
    ? bgKind !== null
    : effect === k;
```

Replace with (add watermark active = enabled && non-empty text):

```typescript
const wmCfg = normalizeWatermark(activeScene.watermark);
const wmActive = isWm && wmCfg.enabled && wmCfg.text.trim().length > 0;
const on = isLens
  ? lensActive
  : isBgfx
    ? bgKind !== null
    : isWm
      ? wmActive
      : effect === k;
```

Then find the onClick handler (around line 1216):

```typescript
onClick={() => {
  if (k === "lens" || k === "bgfx") {
    if (onOpenEffectPanel) {
      onOpenEffectPanel(
        activeEffectPanel === k ? null : k,
      );
    }
    return;
  }
  setEffect(k);
}}
```

Replace the condition to include watermark:

```typescript
onClick={() => {
  if (k === "lens" || k === "bgfx" || k === "watermark") {
    if (onOpenEffectPanel) {
      onOpenEffectPanel(
        activeEffectPanel === k ? null : k,
      );
    }
    return;
  }
  setEffect(k);
}}
```

Then find `aria-expanded` (around line 1262):

```typescript
aria-expanded={
  k === "lens" || k === "bgfx"
    ? activeEffectPanel === k
    : undefined
}
```

Replace:

```typescript
aria-expanded={
  k === "lens" || k === "bgfx" || k === "watermark"
    ? activeEffectPanel === k
    : undefined
}
```

- [ ] **Step 3: Update tile-label for watermark**

Find the tile-label span (around line 1265–1271):

```typescript
<span className="k-studio__tile-label">
  {k === "lens" && lensCfg.enabled
    ? "Blur"
    : k === "bgfx" && bgKind === "vignette"
      ? "Vignette"
      : k === "bgfx" && bgKind === "grain"
        ? "Grain"
        : l}
</span>
```

Replace with (watermark on → "On"):

```typescript
<span className="k-studio__tile-label">
  {k === "lens" && lensCfg.enabled
    ? "Blur"
    : k === "bgfx" && bgKind === "vignette"
      ? "Vignette"
      : k === "bgfx" && bgKind === "grain"
        ? "Grain"
        : k === "watermark" && wmActive
          ? "On"
          : l}
</span>
```

- [ ] **Step 4: Ensure normalizeWatermark imported**

Check the `frame-scene` import block in `MockupStudioSidebar.tsx` (it already imports `normalizeLensBlur`). Add `normalizeWatermark` to that import list (extend existing import; do not duplicate).

- [ ] **Step 5: Typecheck**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx tsc --noEmit`
Expected: exit 0 for Sidebar. (Shell may still error on EffectFlyout render condition — resolved Task 5.)

- [ ] **Step 6: Commit**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
git add src/features/mockups/studio/MockupStudioSidebar.tsx
git -c commit.gpgsign=false commit -m "feat(mockup): Watermark (4/12) — Sidebar tile wired (data-wired=true, opens flyout)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 5: Shell — render watermark flyout + snapshot field

**Files:**
- Modify: `src/features/mockups/studio/MockupStudioShell.tsx` (`activeEffectPanel` state 226–239; sceneSnapshot 754–765; EffectFlyout render 998–1005)

- [ ] **Step 1: Extend EffectFlyout render condition**

In `MockupStudioShell.tsx`, find the EffectFlyout render (around line 998):

```typescript
{activeEffectPanel === "lens" || activeEffectPanel === "bgfx" ? (
  <EffectFlyout
    panel={activeEffectPanel}
    activeScene={sceneOverride ?? SCENE_AUTO}
    onChangeSceneOverride={setSceneOverride}
    onClose={() => setActiveEffectPanel(null)}
  />
) : null}
```

Replace with:

```typescript
{activeEffectPanel === "lens" ||
activeEffectPanel === "bgfx" ||
activeEffectPanel === "watermark" ? (
  <EffectFlyout
    panel={activeEffectPanel}
    activeScene={sceneOverride ?? SCENE_AUTO}
    onChangeSceneOverride={setSceneOverride}
    onClose={() => setActiveEffectPanel(null)}
  />
) : null}
```

(The `useEffect(() => setActiveEffectPanel(null), [mode])` at lines 226–239 already resets the panel on mode change — no change needed; watermark panel auto-closes on mode switch like lens/bgfx.)

- [ ] **Step 2: Add watermark to sceneSnapshot**

Find the `sceneSnapshot` object (around line 754–765):

```typescript
sceneSnapshot: {
  mode: sceneOverride.mode,
  glassVariant: sceneOverride.glassVariant,
  lensBlur: sceneOverride.lensBlur,
  frameAspect,
  mediaPosition,
  bgEffect: sceneOverride.bgEffect,
}
```

Replace with (add watermark, normalized for stable snapshot):

```typescript
sceneSnapshot: {
  mode: sceneOverride.mode,
  glassVariant: sceneOverride.glassVariant,
  lensBlur: sceneOverride.lensBlur,
  frameAspect,
  mediaPosition,
  bgEffect: sceneOverride.bgEffect,
  watermark: normalizeWatermark(sceneOverride.watermark),
}
```

- [ ] **Step 3: Import normalizeWatermark in Shell**

Extend the existing `frame-scene` import in `MockupStudioShell.tsx` to include `normalizeWatermark` (do not duplicate import statement).

- [ ] **Step 4: Typecheck (now should be fully clean)**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx tsc --noEmit`
Expected: exit 0 — ALL files clean now (EffectPanelKey union fully consumed across Sidebar/Shell/Flyout).

- [ ] **Step 5: Run full mockup suite**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx vitest run tests/unit/mockup/`
Expected: PASS — no regression.

- [ ] **Step 6: Commit**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
git add src/features/mockups/studio/MockupStudioShell.tsx
git -c commit.gpgsign=false commit -m "feat(mockup): Watermark (5/12) — Shell renders flyout + sceneSnapshot.watermark

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 6: Preview overlay (br + center FIRST — visible result + guardrail 1 on br/center)

**Files:**
- Modify: `src/features/mockups/studio/MockupStudioStage.tsx` (vignette block line 988–1005; `.k-studio__stage-plate` parent ~820–880; resolvePlateEffects call ~735)

- [ ] **Step 1: Read the preview layer structure**

Read `MockupStudioStage.tsx` lines 700–1010. Note: `.k-studio__stage-plate` contains grain (z:1), glass (z:1), media-pos/cascade, vignette (z:9). `plateEffects` is computed from `resolvePlateEffects(sceneOverride)`. The watermark overlay goes AFTER the vignette block, inside `.k-studio__stage-plate`, at **z-index 10**. There is no unit test for this JSX — verified in browser (Step 4).

- [ ] **Step 2: Compute watermark layout near plateEffects**

Find where `vignetteActive` / `grainActive` are computed (around line 735):

```typescript
const vignetteActive = plateEffects.vignetteAlpha > 0;
const grainActive = plateEffects.grainOpacity > 0;
```

Add right after:

```typescript
// Phase 140 — Watermark layout (preview = export aynı resolver).
// frame.w/h: stage-plate'in render boyutu değil, ASPECT oranını
// temsil eden referans (yüzde-tabanlı geometri olduğu için mutlak
// px önemli değil — sadece w/h oranı tile step'lerini etkiler).
const wmFrame = { w: frameAspectW, h: frameAspectH };
const wmLayout = resolveWatermarkLayout(
  sceneOverride.watermark,
  wmFrame,
);
```

> **NOTE for implementer:** `frameAspectW`/`frameAspectH` may not be the exact variable names in this file. Find how the current frame aspect ratio is available in MockupStudioStage (search for `frameAspect`, `aspect`, the values feeding the plate sizing). Use the width/height ratio source already used for plate layout. If only a single `frameAspect` enum/string exists, derive `{ w, h }` from it the same way the compositor does (frame-aspects.ts helper). The ONLY requirement: same w:h ratio as export uses, so tile density matches. Confirm the chosen source produces the same ratio the export path (Task 7) will use.

- [ ] **Step 3: Add watermark preview overlay after vignette**

Find the vignette block (lines 988–1005) ending with `) : null}`. Immediately AFTER it (still inside `.k-studio__stage-plate`), add:

```tsx
{wmLayout.active ? (
  <div
    aria-hidden
    data-wm-overlay
    data-testid="studio-stage-watermark"
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      overflow: "hidden",
      zIndex: 10,
    }}
  >
    {wmLayout.glyphs.map((g, i) => (
      <span
        key={i}
        style={{
          position: "absolute",
          left: `${g.xPct}%`,
          top: `${g.yPct}%`,
          // anchor: end → sağa hizalı (translate X -100%);
          // middle → ortalı (-50%); start → sol (0).
          transform:
            `translate(${
              wmLayout.anchor === "end"
                ? "-100%"
                : wmLayout.anchor === "middle"
                  ? "-50%"
                  : "0"
            }, -50%) rotate(${g.rotateDeg}deg)`,
          transformOrigin: "center",
          whiteSpace: "nowrap",
          fontFamily: "sans-serif",
          fontWeight: 600,
          fontSize: `calc(min(100cqw, 100cqh) * ${wmLayout.fontPctOfMin})`,
          color: `rgba(255,255,255,${wmLayout.opacity})`,
          userSelect: "none",
        }}
      >
        {g.text}
      </span>
    ))}
  </div>
) : null}
```

> **NOTE for implementer (font-size sizing):** The export uses `font-size = min(outputW,outputH) * fontPctOfMin` in px. Preview must match the SAME visual ratio relative to the plate. `cqw`/`cqh` (container query units) require `.k-studio__stage-plate` to have `container-type: size`. **Check `studio.css` for `.k-studio__stage-plate`** — if it does NOT have `container-type`, do NOT add it (could affect existing layout). Instead use the plate's measured pixel size if MockupStudioStage already has a ref/measured dimension for the plate (search for existing `plateRef`, `useResizeObserver`, measured width in this file — grain/vignette use `inset:0` so they don't need size, but watermark font does). If a measured plate px size exists, compute `fontSize: \`${Math.min(platePxW, platePxH) * wmLayout.fontPctOfMin}px\``. If NO measured size is readily available, add a minimal `ResizeObserver` on the plate element scoped to watermark only (do not refactor existing layout). The chosen approach must produce font size = min(plate render W, plate render H) × fontPctOfMin, matching export's min(outputW,outputH) × fontPctOfMin ratio. This is the core preview/export parity point — verify in Step 4.

- [ ] **Step 4: Browser verification — br + center (guardrail 1 check)**

Start dev server fresh (don't trust hot-reload):

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
rm -rf .next
npm run dev
```

Then via Claude in Chrome (Kivasy tab):
1. Open Mockup Studio, enter Frame mode, select a template with a clear plate.
2. Click the **Watermark** tile → flyout opens.
3. Enable On, type `© Test Shop`, opacity Medium, placement **Bottom-right**.
4. `preview_snapshot` / screenshot — confirm: watermark visible at bottom-right, readable, NOT cut off, NOT dominating the product (guardrail 1 — br must look product-ready, not secondary). Console clean (no errors).
5. Switch placement to **Center** — confirm centered, larger, still product visible underneath at Medium; try Strong opacity — product still discernible (guardrail 2 — composition not killed).
6. Long text test: type a 48-char string in Center — confirm font scales down, no frame overflow.
7. Save screenshots to disk for the final report.

Fix any issue (read source, edit, re-check from Step 4) before commit. Do NOT proceed to Task 7 until br + center look product-ready in browser.

- [ ] **Step 5: Import resolveWatermarkLayout in Stage**

Extend the `frame-scene` import in `MockupStudioStage.tsx` to include `resolveWatermarkLayout` (do not duplicate import).

- [ ] **Step 6: Typecheck + commit**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
npx tsc --noEmit   # expect 0
git add src/features/mockups/studio/MockupStudioStage.tsx
git -c commit.gpgsign=false commit -m "feat(mockup): Watermark (6/12) — preview overlay z:10 (br+center browser-verified)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 7: Export composite — Phase 7c (br + center first)

**Files:**
- Modify: `src/providers/mockup/local-sharp/frame-compositor.ts` (vignette phase 1354–1369; `FrameSceneInput` 160–180; `escapeXml` 383–390; outputW/outputH ~404–408)

- [ ] **Step 1: Read the compositor phase chain**

Read `frame-compositor.ts` lines 350–420 and 1340–1373. Note: `escapeXml` already exists (lines 383–390). Vignette is "Phase 7b" — the LAST composite, gated on `bgFx.vignetteAlpha > 0`, using `Buffer.from(svgString)` → `sharp(canvasBuffer).composite([{input, top:0, left:0}])`. `outputW`/`outputH` are the final canvas dimensions. `FrameSceneInput` mirrors `SceneOverride` fields.

- [ ] **Step 2: Add watermark to FrameSceneInput**

Find `FrameSceneInput` (lines 160–180), with `bgEffect?: import(...)BgEffectConfig;`. Add right after the bgEffect field:

```typescript
  /** Phase 140 — Watermark (text). frame-scene.ts WatermarkConfig
   *  mirror; resolveWatermarkLayout ile çözülür (preview = export
   *  §11.0). undefined/null → no-op (active=false). EN ÜST katman
   *  (vignette'den sonra composite — Phase 7c). */
  watermark?:
    | import("@/features/mockups/studio/frame-scene").WatermarkConfig
    | null;
```

- [ ] **Step 3: Add Phase 7c watermark composite after vignette (7b)**

Find the end of the vignette block (line 1369, after `.toBuffer();` and its closing `}`). Immediately AFTER the vignette `if` block, add:

```typescript
// Phase 7c — Watermark (text). EN ÜST katman: vignette (7b)
// sonrası. Preview ile AYNI resolveWatermarkLayout → §11.0.
// frame.w/h = outputW/outputH (yüzde geometri mutlak boyuta map).
{
  const wmLayout = resolveWatermarkLayout(input.watermark, {
    w: outputW,
    h: outputH,
  });
  if (wmLayout.active) {
    const fontPx = Math.min(outputW, outputH) * wmLayout.fontPctOfMin;
    const texts = wmLayout.glyphs
      .map((g) => {
        const x = (g.xPct / 100) * outputW;
        const y = (g.yPct / 100) * outputH;
        return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="${wmLayout.anchor}" dominant-baseline="middle" font-family="sans-serif" font-weight="600" font-size="${fontPx.toFixed(2)}" fill="rgba(255,255,255,${wmLayout.opacity})" transform="rotate(${g.rotateDeg} ${x.toFixed(2)} ${y.toFixed(2)})">${escapeXml(g.text)}</text>`;
      })
      .join("");
    const wmSvg = `<svg width="${outputW}" height="${outputH}" xmlns="http://www.w3.org/2000/svg">${texts}</svg>`;
    canvasBuffer = await sharp(canvasBuffer)
      .composite([{ input: Buffer.from(wmSvg), top: 0, left: 0 }])
      .png()
      .toBuffer();
  }
}
```

> **Parity note:** Preview `transform: translate(anchor-offset, -50%) rotate()` ↔ export `text-anchor` + `dominant-baseline="middle"` + `transform="rotate(deg cx cy)"`. The explicit rotation center `(x, y)` matches preview's `transform-origin: center` on a point-anchored element. `dominant-baseline="middle"` ↔ preview's `translate(..., -50%)` vertical centering. These are the parity-critical pairings — verified in Step 5.

- [ ] **Step 4: Import resolveWatermarkLayout in compositor**

Find how `frame-compositor.ts` imports from frame-scene. It uses inline `import("@/features/mockups/studio/frame-scene").BgEffectConfig` for types. For the RUNTIME function `resolveWatermarkLayout`, add a top-level import (check if there's already a top import from frame-scene for runtime values like `resolvePlateEffects`; if so extend it, else add):

```typescript
import { resolveWatermarkLayout } from "@/features/mockups/studio/frame-scene";
```

(If `resolvePlateEffects` is already imported at top for the bg/lens composite, add `resolveWatermarkLayout` to that same import line.)

- [ ] **Step 5: Verify export path passes watermark through**

Search the codebase for where `FrameSceneInput` is constructed from the request/scene (grep `bgEffect:` in the frame export call path — likely in `frame-export.service.ts` or a mapper). Ensure `watermark: input.scene.watermark` (or equivalent) is passed into the compositor input alongside `bgEffect`. Add the field if missing:

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && grep -rn "bgEffect:" src/server src/providers/mockup/local-sharp --include=*.ts | grep -v test`
For each place that maps scene → compositor input, add `watermark:` next to `bgEffect:`.

- [ ] **Step 6: Typecheck + browser export proof (br + center)**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
npx tsc --noEmit   # expect 0
```

Browser (dev server running): with watermark On / `© Test Shop` / Medium / **Bottom-right**, trigger a real frame export. Download the exported PNG. Compare side-by-side with the preview screenshot from Task 6:
- Watermark present in export at bottom-right, same relative position.
- Font/size/opacity visually matches preview (font-metric difference acceptable if minor — record it).
- Repeat for **Center**.
Save both exported PNGs + comparison to disk for final report. If parity is broken for br/center (structural, not minor font metric), diagnose root cause (read both render paths) and fix before commit.

- [ ] **Step 7: Commit**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
git add src/providers/mockup/local-sharp/frame-compositor.ts src/server src/providers
git -c commit.gpgsign=false commit -m "feat(mockup): Watermark (7/12) — export Phase 7c composite (br+center parity-proven)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 8: Diagonal-tile parity verification + fallback checkpoint

**Files:**
- (No new code if tile passes — this is the experiment/decision task. Code only if fallback triggers: `frame-scene.ts` placement enum.)

This task is the explicit experiment alt-turu (spec §9) and the fallback decision point (spec §6).

- [ ] **Step 1: Browser — diagonal-tile preview across 3 aspects**

Dev server running. For frame aspects **1:1**, **4:5**, **9:16** (switch template/aspect each time), set watermark On / `© Test Shop` / Medium / placement **Diagonal**:
- `preview_snapshot` + screenshot each aspect.
- Gözle kontrol (spec §4.2 + guardrail 1+2): grid yoğunluğu "koruyucu ama satılabilir" mi? Ürün tamamen ölmüş mü? Stock-photo hissi var mı? Spacing çok sıkı mı? Strong opacity'de de kontrol et.

- [ ] **Step 2: Export — diagonal-tile real Sharp output across 3 aspects**

For each of the same 3 aspects, trigger a real export with Diagonal placement. Download each PNG.

- [ ] **Step 3: Side-by-side parity comparison**

For each aspect, place preview screenshot next to exported PNG:
- Tile positions match? Rotation (-30°) matches? Opacity matches? Glyph spacing matches?
- Record findings explicitly (this goes in the final report).

- [ ] **Step 4: Apply fallback decision (spec §6)**

Evaluate the 3 fallback triggers (any one true → fallback):
1. Parity divergence that the single resolver CANNOT close (e.g. librsvg `transform="rotate()"` baseline structurally differs from CSS — tile visibly misaligned in export vs preview, not a minor font-metric thing).
2. Making tile parity-safe needs architecture beyond the single-resolver + SVG-text-grid approach (custom font embed, fontconfig, separate pipeline).
3. Sales-image quality unrecoverable: density tuning (§4.2) tried, tile either kills the product or gives no protection — no middle ground.

**If NONE true → tile stays.** Document "tile verified, parity OK, no fallback" with evidence. No code change. Skip to Step 6.

**If ANY true → execute fallback:** In `frame-scene.ts`, change `WmPlacement`:

```typescript
export type WmPlacement = "br" | "center" | "tile";
```
to:
```typescript
export type WmPlacement = "br" | "center" | "bar";
```

Then in `resolveWatermarkLayout`, replace the entire `// placement === "tile"` block with a `// placement === "bar"` block (bottom-bar = edge-to-edge single text strip):

```typescript
  // placement === "bar" — fallback (spec §6): edge-to-edge tek
  // <text> şerit. Tek glyph → parity riski minimum (br/center yolu).
  return {
    active: true,
    glyphs: [{ text: cfg.text, xPct: 50, yPct: 95, rotateDeg: 0 }],
    opacity,
    fontPctOfMin: 0.03,
    anchor: "middle",
  };
```

Update these references for the rename `tile`→`bar`:
- `tests/unit/mockup/watermark.test.ts` — replace the `placement: "tile"` describe block with `placement: "bar"` tests: single glyph, `xPct:50`, `yPct:95`, `rotateDeg:0`, `anchor:"middle"`, `fontPctOfMin:0.03`. Remove the multi-glyph/grid/portrait-density tile tests (no longer applicable); add: `bar → single glyph at bottom strip`.
- `EffectFlyout.tsx` placement segment — change `["tile", "Diagonal"]` to `["bar", "Bottom-bar"]`.
- Re-run Task 6 + Task 7 browser proof for the `bar` placement (it uses the simple single-glyph path — low risk).

- [ ] **Step 5: Re-run tests after fallback (only if fallback executed)**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx vitest run tests/unit/mockup/ && npx tsc --noEmit`
Expected: PASS + tsc 0 (all `tile`→`bar` references consistent).

- [ ] **Step 6: Commit (decision recorded either way)**

If tile kept:
```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
git -c commit.gpgsign=false commit --allow-empty -m "test(mockup): Watermark (8/12) — diagonal-tile parity verified, no fallback (evidence in report)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

If fallback executed:
```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
git add src/features/mockups/studio/frame-scene.ts src/features/mockups/studio/EffectFlyout.tsx tests/unit/mockup/watermark.test.ts
git -c commit.gpgsign=false commit -m "feat(mockup): Watermark (8/12) — fallback tile→bottom-bar (spec §6 trigger: <reason>)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 9: Export-result stale detection (FrameExportResultBanner)

**Files:**
- Modify: `src/features/mockups/studio/FrameExportResultBanner.tsx` (`isStale` lines 81–108)

- [ ] **Step 1: Read the isStale computation**

Read `FrameExportResultBanner.tsx` lines 70–115. `isStale` compares `currentSceneSnapshot` vs `result.sceneSnapshot` — mode, glassVariant, lensBlurChanged, mediaPositionChanged, bgEffectChanged, frameAspect. Watermark must join this OR-chain.

- [ ] **Step 2: Add watermarkChanged to isStale**

Find the bgEffectChanged computation (around line 95):

```typescript
const curBg = currentSceneSnapshot.bgEffect;
const snapBg = result.sceneSnapshot.bgEffect;
const bgEffectChanged =
  (curBg?.kind ?? null) !== (snapBg?.kind ?? null) ||
  (curBg?.intensity ?? null) !== (snapBg?.intensity ?? null);
```

Add right after:

```typescript
const curWm = normalizeWatermark(currentSceneSnapshot.watermark);
const snapWm = normalizeWatermark(result.sceneSnapshot.watermark);
const watermarkChanged =
  curWm.enabled !== snapWm.enabled ||
  curWm.text !== snapWm.text ||
  curWm.opacity !== snapWm.opacity ||
  curWm.placement !== snapWm.placement;
```

Then find the `isStale` OR-chain (around line 102):

```typescript
const isStale =
  currentSceneSnapshot.mode !== result.sceneSnapshot.mode ||
  currentSceneSnapshot.glassVariant !== result.sceneSnapshot.glassVariant ||
  lensBlurChanged ||
  mediaPositionChanged ||
  bgEffectChanged ||
  currentSceneSnapshot.frameAspect !== result.sceneSnapshot.frameAspect;
```

Add `watermarkChanged ||`:

```typescript
const isStale =
  currentSceneSnapshot.mode !== result.sceneSnapshot.mode ||
  currentSceneSnapshot.glassVariant !== result.sceneSnapshot.glassVariant ||
  lensBlurChanged ||
  mediaPositionChanged ||
  bgEffectChanged ||
  watermarkChanged ||
  currentSceneSnapshot.frameAspect !== result.sceneSnapshot.frameAspect;
```

- [ ] **Step 3: Import + typecheck**

Extend the `frame-scene` import in `FrameExportResultBanner.tsx` to include `normalizeWatermark`. Also ensure the `sceneSnapshot` TYPE used by this banner + Shell + frame-export.service includes `watermark?` — if there is a shared `SceneSnapshot` type/interface, add `watermark?: WatermarkConfig | null` to it (search: `grep -rn "sceneSnapshot" src --include=*.ts --include=*.tsx | grep -i "interface\|type \|: {"`). If snapshot is structurally typed inline, the field addition in Task 5 + Task 10 is enough.

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
git add src/features/mockups/studio/FrameExportResultBanner.tsx
git -c commit.gpgsign=false commit -m "feat(mockup): Watermark (9/12) — export-result stale detection (watermarkChanged)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 10: Persist watermark in frame-export.service

**Files:**
- Modify: `src/server/services/frame/frame-export.service.ts` (sceneSnapshot persist 248–283)

- [ ] **Step 1: Read the persist block**

Read `frame-export.service.ts` lines 240–290. The `sceneSnapshot` persisted object normalizes lensBlur (false/true/object) and bgEffect (object or null). Watermark must be normalized to a stable shape the same way.

- [ ] **Step 2: Add watermark to persisted sceneSnapshot**

Find the persisted `sceneSnapshot` (around line 248–283), ending with the `bgEffect: input.scene.bgEffect ? {...} : null,` field. Add right after the bgEffect field (before the closing `},` of sceneSnapshot):

```typescript
  watermark: input.scene.watermark
    ? {
        enabled: Boolean(input.scene.watermark.enabled),
        text: String(input.scene.watermark.text ?? "")
          .replace(/[\r\n]+/g, " ")
          .trim()
          .slice(0, 48),
        opacity: input.scene.watermark.opacity,
        placement: input.scene.watermark.placement,
      }
    : null,
```

> Note: 48 = `WM_TEXT_MAX`. This service may not import frame-scene constants (server boundary). If it already imports from frame-scene, use `WM_TEXT_MAX` and `normalizeWatermark` instead of the inline literal/logic (preferred — DRY). Check existing imports: if `normalizeWatermark` can be imported here without pulling client-only code (frame-scene.ts is pure-TS, safe), prefer:
> ```typescript
>   watermark: input.scene.watermark
>     ? normalizeWatermark(input.scene.watermark)
>     : null,
> ```
> Use the `normalizeWatermark` form if the import is clean (it should be — frame-scene.ts is pure TypeScript with no React/DOM imports, already imported server-side by frame-compositor.ts). Fall back to inline only if an import cycle appears.

- [ ] **Step 3: Pass watermark into compositor input**

In the same file (or wherever the compositor `FrameSceneInput` is built — Task 7 Step 5 located these), ensure `watermark: input.scene.watermark` is passed alongside `bgEffect`. Verify:

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && grep -n "watermark" src/server/services/frame/frame-export.service.ts`
Expected: watermark appears both in persisted sceneSnapshot AND in the compositor input mapping.

- [ ] **Step 4: Typecheck + full test + build**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
npx tsc --noEmit                          # expect 0
npx vitest run tests/unit/mockup/         # expect PASS
npm run build                             # expect PASS
```

- [ ] **Step 5: End-to-end browser proof (full round-trip)**

Dev server: set watermark On / text / opacity / placement, export, confirm:
- Exported PNG has watermark (Task 7/8 already proved render).
- After export, change watermark text in flyout → FrameExportResultBanner shows **stale** (Task 9 wiring proven live).
- Reload page → if snapshot persisted, the export result still reflects the watermark it was made with.
Save proof screenshots.

- [ ] **Step 6: Commit**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
git add src/server/services/frame/frame-export.service.ts
git -c commit.gpgsign=false commit -m "feat(mockup): Watermark (10/12) — persist watermark in sceneSnapshot + compositor input

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 11: Documentation — Contract §7.9 + known-issues

**Files:**
- Modify: `docs/claude/mockup-studio-contract.md`
- Modify: `docs/claude/known-issues-and-deferred.md`

- [ ] **Step 1: Read current contract + known-issues**

Read `docs/claude/mockup-studio-contract.md` (find §7.7 BG Effects / §7.8 Effect Settings Flyout — watermark §7.9 goes after) and `docs/claude/known-issues-and-deferred.md` (§A area). Note the §0 "Son güncelleme: Phase 139" line in both — update to Phase 140.

- [ ] **Step 2: Add Contract §7.9 (normative)**

After §7.8 in `mockup-studio-contract.md`, add a new section. Content must state (write it as normative spec, Turkish, matching the doc's existing tone):

- §7.9 Watermark (text) — Frame-only effect, `SceneOverride.watermark?`, independent of mode/glass/lensBlur/bgEffect.
- Resolver: `resolveWatermarkLayout(config, frame)` pure-TS, single source for preview (React overlay z:10) + export (Sharp Phase 7c, after vignette 7b). §11.0 parity.
- Scope: text only; enable + text + opacity (soft 0.18 / medium 0.30 / strong 0.45) + placement (br / center / `<tile|bar — whichever Task 8 settled on>`).
- Guardrails (normative): text clamp `WM_TEXT_MAX=48`, newline→space single-line, empty→inactive, `escapeXml` mandatory; center long-text font ladder (≤16:0.060 / ≤32:0.045 / >32:0.034); diagonal-tile density (rotate -30, stepX min×0.42, stepY min×0.16, font 0.026) — OR document the fallback if Task 8 triggered it.
- Font: `sans-serif` generic family both sides (no custom font name — fontconfig out of scope).
- Layer: watermark is the TOP layer (after vignette in both preview z-order and export composite order). State this in the §11 layered model list too.
- Deferred (Phase 2): image/logo, size, color, font choice, free rotation, per-store default.

Also update the §11 compositing-order list to append watermark as the topmost layer (after vignette).

- [ ] **Step 3: Add known-issues entry**

In `known-issues-and-deferred.md`, add a Watermark entry under the deferred section:
- Phase 2 deferred: image/logo watermark, size control, color presets, font choice, free rotation, per-store default.
- Font parity residual risk: preview OS sans-serif ↔ export librsvg sans-serif glyph-metric difference (minor, documented, accepted for v1).
- **If Task 8 fallback triggered:** add a clear entry — "diagonal-tile deferred; buggy/parity-unsafe under current single-resolver + librsvg; replaced with bottom-bar in v1; revisit with font infra + rotated-tile parity solution. Trigger that caused fallback: <which of spec §6 conditions, with evidence>."
- **If tile kept:** note "diagonal-tile shipped; parity verified <date> across 1:1/4:5/9:16; residual font-metric risk only."

- [ ] **Step 4: Update §0 dates + commit**

Change "Son güncelleme: Phase 139" → "Son güncelleme: Phase 140" in both docs.

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
git add docs/claude/mockup-studio-contract.md docs/claude/known-issues-and-deferred.md
git -c commit.gpgsign=false commit -m "docs(mockup): Watermark (11/12) — Contract §7.9 normatif + known-issues + §11 layer order

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

### Task 12: Final gate — code↔comment↔doc parity + quality gates + dev server clean

**Files:**
- Review only (fix inline if drift found).

- [ ] **Step 1: Stale comment / drift scan (CLAUDE.md Madde V)**

Run: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && grep -rn "Phase 99+ candidate\|preview only\|watermark" src/features/mockups/studio/MockupStudioSidebar.tsx`
Confirm: NO stale "Watermark — preview only (Phase 99+ candidate)" wording remains for the watermark tile (it's now wired). Scan the watermark-touched files for any comment that contradicts the shipped behavior (e.g. a comment saying "tile" if fallback shipped "bar", or vice versa). Fix any code↔comment drift inline.

- [ ] **Step 2: Full quality gate (CLAUDE.md "Model Esnekliği")**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
npx tsc --noEmit                     # expect exit 0
npx vitest run tests/unit/mockup/    # expect PASS (watermark + bg-effects + all mockup)
npm run build                        # expect PASS (✓ Compiled successfully)
```

If any fails: diagnose root cause (no `--no-verify`, no skipping), fix, re-run. Do not mark done with a failing gate.

- [ ] **Step 3: Final browser verification — all placements + console**

Dev server fresh (`rm -rf .next && npm run dev`). In Mockup Studio Frame mode, exercise:
- Watermark Off → no overlay, no console error.
- On / text / each opacity (soft/medium/strong) / each placement (br / center / tile-or-bar).
- One real export per placement; download; confirm parity vs preview (final proof set).
- Console clean throughout (`preview_console_logs` / network).
- Confirm guardrail 1 (br/center/tile all product-ready, none feels secondary) and guardrail 2 (strong opacity doesn't kill the product) hold in final state.
Save the final proof screenshots/exports to disk.

- [ ] **Step 4: Leave dev server clean + running (memory rule)**

Ensure dev server is running cleanly at the end (user tests immediately after). If it was stopped for the build, restart: `cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub && rm -rf .next && npm run dev` and confirm it compiles and the Mockup Studio loads with no 500 / console errors.

- [ ] **Step 5: Push all commits**

```bash
cd /Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub
git push
```

- [ ] **Step 6: Final report**

Write the final report (Turkish) covering exactly what the user asked for:
- Diagonal-tile için seçilen teknik yaklaşım (manuel rotated `<text>` grid, neden patternTransform değil) ve sonucu.
- Preview/export parity durumu — kanıtla (hangi aspect'lerde test edildi, font-metric sapması ölçüldü mü, ekran görüntüsü/export dosyaları).
- Etsy satıcısı açısından kullanılabilirlik (br/center/tile gözlemi, guardrail 1+2 sonucu).
- Fallback'e dönüldü mü? (tile vs bar — hangi koşul, kanıt). Spec §6'ya atıf.
- İlk turda gelen yetenekler + bilerek Phase 2'ye bırakılanlar.
- Hangi dosya katmanları değişti.
- Kalan riskler (font-metric residual, vb.) dürüstçe.
- Quality gates sonucu (tsc / vitest / build / browser).

---

## Self-Review

**1. Spec coverage:**

| Spec bölümü | Karşılayan task |
|---|---|
| §2.1 scope (text/layer/flyout 4-control/sans-serif) | Task 1-3, 6, 7 |
| §2.2 deferred list | Task 11 (docs) |
| §3.1 SceneOverride.watermark + types + WM_OPACITY/WM_TEXT_MAX | Task 1, 2 |
| §3.2 resolveWatermarkLayout sözleşmesi + placement geometri + anchor | Task 2 |
| §3.3 preview z:10 / export Phase 7c | Task 6, 7 |
| §3.4 EffectPanelKey += watermark | Task 1 |
| §4 diagonal-tile manuel rotated grid + density | Task 2 (resolver), Task 8 (verify) |
| §5.1 guardrail 1 (tile sales-quality) | Task 6, 8 browser checks |
| §5.2 guardrail 2 (text layout-safe: empty/clamp/escapeXml/newline/center ladder) | Task 1 (normalize), Task 2 (resolver ladder), Task 3 (maxLength+counter), Task 7 (escapeXml) |
| §6 fallback tam koşul + tile→bar | Task 8 |
| §7 10-dosya katmanı | Task 1-11 |
| §8 parity risk çerçeve | Task 7, 8 proof |
| §9 experiment alt-turu | Task 6 (br/center first), Task 8 (tile decision) |
| §10 quality gates | Task 12 |
| User extra guardrail: br/center ürün-ready | Task 6 Step 4, Task 12 Step 3 |
| User extra guardrail: kompozisyon domine etmesin | Task 6 Step 4 (strong opacity check), Task 8, Task 12 Step 3 |

No gaps.

**2. Placeholder scan:** No "TBD/TODO/implement later". Implementer NOTEs (Task 6 font sizing, Task 7 mapping location) are explicit investigation instructions with concrete success criteria + exact grep commands, not vague placeholders — acceptable because the exact variable name for frame aspect / mapping site is codebase-state-dependent and the note pins down exactly what to find and the parity invariant it must satisfy.

**3. Type consistency:** `WatermarkConfig`/`WmOpacity`/`WmPlacement`/`WmAnchor`/`WatermarkGlyph`/`WatermarkLayout`/`WM_OPACITY`/`WM_DEFAULT`/`WM_TEXT_MAX`/`normalizeWatermark`/`resolveWatermarkLayout` — names identical across Tasks 1-11. `SceneOverride.watermark?` consistent. `EffectPanelKey` extended once (Task 1), consumed consistently (Task 3/4/5). Fallback rename `tile`→`bar` (Task 8) propagated to resolver + test + flyout + docs consistently. Snapshot field `watermark` consistent across Shell (Task 5) / Banner (Task 9) / service (Task 10).

Plan internally consistent.
