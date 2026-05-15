# Global Media-Position Pad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Shots.so-style global media-position pad to the Kivasy Mockup Studio — a draggable handle + safe-area rectangle that pans the composition within the plate via a new normalized canonical `mediaPosition` state that flows through preview, right-rail thumbs, and Sharp export.

**Architecture:** New pure-TS shared resolver `media-position.ts` (single px formula, single `K=0.5`, used by preview + rail + export). Canonical Shell `mediaPosition: {x,y} ∈ [-1,1]` (`{0,0}` = byte-identical no-op). An **outer wrapper div** inside the plate applies `translate(ox,oy)`; the existing `.k-studio__stage-inner` (Phase 125 zoom scale) is the **inner wrapper, untouched**. Pad UI is an **overlay on the existing `StageScenePreview`** (no new renderer). Sharp compositor adds the same offset to `cascadeOffsetX/Y`. Tilt is honest-disabled; the separate "Precision" view-tab is removed (Shift modifier only).

**Tech Stack:** Next.js 14 App Router, React + TypeScript strict, Vitest, Sharp (`sharp`), Zod, MinIO storage. Spec: `docs/superpowers/specs/2026-05-16-global-media-position-pad-design.md`.

---

## Hard invariants (do NOT break — verify each task)

- `{x:0,y:0}` is **sacred no-op**: zoom=100 + mediaPos {0,0} must be DOM-byte-identical to current Phase 125 baseline.
- Single render path: pad = overlay on existing `StageScenePreview`; NO new renderer; `StageScene` shared path untouched.
- Outer wrapper = `mediaPosition` translate (NEW div). Inner `.k-studio__stage-inner` = `previewZoom` scale (Phase 125 — DO NOT modify its transform).
- Single `resolveMediaOffsetPx` + single `MEDIA_POSITION_PAN_K`. No copied formula. Preview offset == export offset (pixel-verified).
- zoom = kategori 2 preview-only (NOT in export, rail-independent — Phase 125 preserved). mediaPosition = kategori 1 canonical (IN export, rail reflects it).
- Pad overlay must NOT drown the preview — `StageScenePreview`'s live-preview character preserved (subtle overlay, not a separate UI slab).
- Preserve: chromeless rail, aspect-aware/container-aware rail, selected ring + overlay badge, no unselected dim/hover-glow, no frame plate caption, Product MockupsTab continuity, export persistence/handoff. No schema migration. No WorkflowRun.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/features/mockups/studio/media-position.ts` | Pure-TS shared resolver: `K`, types, neutral, `resolveMediaOffsetPx`, `clampMediaPosition`, `normalizePadPointToPosition`, `mediaPositionsEqual` | **Create** |
| `tests/unit/mockup/media-position.test.ts` | Unit tests for the resolver (pure math) | **Create** |
| `src/features/mockups/studio/MockupStudioShell.tsx` | `mediaPosition` state + wire to Stage / PresetRail / export body | Modify |
| `src/features/mockups/studio/MockupStudioStage.tsx` | Outer wrapper (mediaPosition translate) around composition inside plate; `StageScene` prop | Modify |
| `src/features/mockups/studio/StageScenePreview.tsx` | Pad overlay (safe-area rect + handle + framing dim) + pointer drag/Shift; pass `mediaPosition` to StageScene | Modify |
| `src/features/mockups/studio/MockupStudioPresetRail.tsx` | Remove "Precision" view-tab, Tilt honest-disabled, pad wiring (pass mediaPosition + setter) | Modify |
| `src/features/mockups/studio/studio.css` | `.k-studio__pad-safearea` / `-handle` / `-viewfinder` recipes | Modify |
| `src/app/api/frame/export/route.ts` | Zod body `mediaPosition` optional | Modify |
| `src/server/services/frame/frame-export.service.ts` | `mediaPosition` → compositor input + `sceneSnapshot` serialize | Modify |
| `src/providers/mockup/local-sharp/frame-compositor.ts` | Apply `resolveMediaOffsetPx` to `cascadeOffsetX/Y` (export parity) | Modify |
| `src/features/mockups/components/FrameExportResultBanner.tsx` | Stale indicator includes `mediaPosition` (epsilon) | Modify |
| `CLAUDE.md` | Phase 126 entry | Modify |

---

## Task 1: Shared resolver `media-position.ts` (pure math + tests)

**Files:**
- Create: `src/features/mockups/studio/media-position.ts`
- Test: `tests/unit/mockup/media-position.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/mockup/media-position.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  MEDIA_POSITION_PAN_K,
  MEDIA_POSITION_NEUTRAL,
  resolveMediaOffsetPx,
  clampMediaPosition,
  normalizePadPointToPosition,
  mediaPositionsEqual,
} from "@/features/mockups/studio/media-position";

describe("media-position resolver", () => {
  it("K is 0.5 and neutral is {0,0}", () => {
    expect(MEDIA_POSITION_PAN_K).toBe(0.5);
    expect(MEDIA_POSITION_NEUTRAL).toEqual({ x: 0, y: 0 });
  });

  it("resolveMediaOffsetPx neutral = {0,0} (sacred no-op)", () => {
    expect(resolveMediaOffsetPx({ x: 0, y: 0 }, 1000, 600)).toEqual({
      ox: 0,
      oy: 0,
    });
  });

  it("resolveMediaOffsetPx = pos * render * K", () => {
    // x=1 → 1000 * 0.5 = 500 ; y=-1 → 600 * 0.5 * -1 = -300
    expect(resolveMediaOffsetPx({ x: 1, y: -1 }, 1000, 600)).toEqual({
      ox: 500,
      oy: -300,
    });
    // half: x=0.5 → 1000*0.5*0.5 = 250
    expect(resolveMediaOffsetPx({ x: 0.5, y: 0 }, 1000, 600)).toEqual({
      ox: 250,
      oy: 0,
    });
  });

  it("resolveMediaOffsetPx is resolution-independent (same pos, different render → proportional)", () => {
    const a = resolveMediaOffsetPx({ x: 0.4, y: 0.2 }, 1000, 600);
    const b = resolveMediaOffsetPx({ x: 0.4, y: 0.2 }, 200, 120);
    expect(a.ox / b.ox).toBeCloseTo(5, 5);
    expect(a.oy / b.oy).toBeCloseTo(5, 5);
  });

  it("clampMediaPosition clamps to [-1,1]", () => {
    expect(clampMediaPosition({ x: 2, y: -3 })).toEqual({ x: 1, y: -1 });
    expect(clampMediaPosition({ x: -0.4, y: 0.7 })).toEqual({
      x: -0.4,
      y: 0.7,
    });
  });

  it("normalizePadPointToPosition maps pad center → {0,0}", () => {
    const rect = { left: 0, top: 0, width: 200, height: 156 };
    const r = normalizePadPointToPosition(
      100,
      78,
      rect,
      false,
      { x: 0, y: 0 },
    );
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo(0, 6);
  });

  it("normalizePadPointToPosition maps pad edges → ±1 (clamped)", () => {
    const rect = { left: 0, top: 0, width: 200, height: 156 };
    // far right/bottom → +1,+1
    expect(
      normalizePadPointToPosition(200, 156, rect, false, { x: 0, y: 0 }),
    ).toEqual({ x: 1, y: 1 });
    // far left/top → -1,-1
    expect(
      normalizePadPointToPosition(0, 0, rect, false, { x: 0, y: 0 }),
    ).toEqual({ x: -1, y: -1 });
    // beyond bounds still clamps
    expect(
      normalizePadPointToPosition(400, -50, rect, false, { x: 0, y: 0 }),
    ).toEqual({ x: 1, y: -1 });
  });

  it("normalizePadPointToPosition Shift = precision (delta from prev / 4)", () => {
    const rect = { left: 0, top: 0, width: 200, height: 156 };
    // without shift: point at right edge x=1
    const full = normalizePadPointToPosition(200, 78, rect, false, {
      x: 0,
      y: 0,
    });
    expect(full.x).toBeCloseTo(1, 6);
    // with shift from prev {0,0}: target x=1, applied = 0 + (1-0)/4 = 0.25
    const fine = normalizePadPointToPosition(200, 78, rect, true, {
      x: 0,
      y: 0,
    });
    expect(fine.x).toBeCloseTo(0.25, 6);
    expect(fine.y).toBeCloseTo(0, 6);
  });

  it("mediaPositionsEqual epsilon 1e-3 (no false stale)", () => {
    expect(
      mediaPositionsEqual({ x: 0.1, y: 0.2 }, { x: 0.1000004, y: 0.2 }),
    ).toBe(true);
    expect(
      mediaPositionsEqual({ x: 0.1, y: 0.2 }, { x: 0.15, y: 0.2 }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/mockup/media-position.test.ts`
Expected: FAIL — "Cannot find module '@/features/mockups/studio/media-position'"

- [ ] **Step 3: Write the resolver**

Create `src/features/mockups/studio/media-position.ts`:

```typescript
/* Phase 126 — Global media-position shared resolver.
 *
 * Shots.so canlı browser araştırması: pad'in `.drag-handle`'ı media'yı
 * plate içinde pan ediyor; `.shadow-layer` plate'in görünür alanını
 * temsil ediyor (sabit). Kivasy karşılığı: global canonical
 * `mediaPosition {x,y} ∈ [-1,1]` ({0,0} = no-op, Phase 125 byte-
 * identical). Bu modül TEK formül kaynağı: preview outer-wrapper +
 * rail thumb + Sharp export hepsi `resolveMediaOffsetPx` çağırır
 * (drift YASAK, spec §5). Pure-TS — DOM/React/sharp import YOK →
 * client (preview/rail) + server (compositor) ikisi de import eder
 * (CLAUDE.md Madde V build-boundary). */

export const MEDIA_POSITION_PAN_K = 0.5;

export type MediaPosition = { x: number; y: number };

export const MEDIA_POSITION_NEUTRAL: MediaPosition = { x: 0, y: 0 };

const clamp1 = (n: number): number => Math.max(-1, Math.min(1, n));

/** Normalized {x,y} → px offset, render-boyutuna göre türetilir.
 *  TEK formül: preview/rail/export hepsi bunu kullanır. neutral
 *  {0,0} → {ox:0,oy:0} (sacred no-op). */
export function resolveMediaOffsetPx(
  pos: MediaPosition,
  renderW: number,
  renderH: number,
): { ox: number; oy: number } {
  return {
    ox: pos.x * renderW * MEDIA_POSITION_PAN_K,
    oy: pos.y * renderH * MEDIA_POSITION_PAN_K,
  };
}

export function clampMediaPosition(p: MediaPosition): MediaPosition {
  return { x: clamp1(p.x), y: clamp1(p.y) };
}

/** Pure math: pad-px → normalized. Pad rect'in -1..+1 koordinat
 *  uzayını temsil eder (merkez = {0,0}). shiftKey → uygulanan
 *  delta `prev`'ten ÷4 (precision; Shots.so "Hold ⇧"). DOM/event
 *  objesi YOK (kolay test). */
export function normalizePadPointToPosition(
  clientX: number,
  clientY: number,
  padRect: { left: number; top: number; width: number; height: number },
  shiftKey: boolean,
  prev: MediaPosition,
): MediaPosition {
  const halfW = padRect.width / 2;
  const halfH = padRect.height / 2;
  const rawX = clamp1((clientX - padRect.left - halfW) / halfW);
  const rawY = clamp1((clientY - padRect.top - halfH) / halfH);
  if (!shiftKey) return { x: rawX, y: rawY };
  return clampMediaPosition({
    x: prev.x + (rawX - prev.x) / 4,
    y: prev.y + (rawY - prev.y) / 4,
  });
}

/** Epsilon eşitlik (stale indicator — float drift'ten sahte stale
 *  üretme; spec guardrail 3). */
export function mediaPositionsEqual(
  a: MediaPosition,
  b: MediaPosition,
): boolean {
  return Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/mockup/media-position.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (clean)

- [ ] **Step 6: Commit**

```bash
git add src/features/mockups/studio/media-position.ts tests/unit/mockup/media-position.test.ts
git commit -m "feat(mockup): Phase 126 task 1 — media-position shared resolver (pure math, K=0.5, single formula)"
```

---

## Task 2: StageScene outer wrapper (mediaPosition translate, inner zoom untouched)

**Files:**
- Modify: `src/features/mockups/studio/MockupStudioStage.tsx`

Context: `StageScene` renders `.k-studio__stage-plate` containing `MockupComposition`/`FrameComposition` (each is `.k-studio__stage-inner` with the Phase 125 `scale(grp.scale × previewZoom)` transform). We add an **outer wrapper div** *inside the plate* and *around the composition* that applies `translate(ox,oy)` from `mediaPosition`. The inner `.k-studio__stage-inner` transform is NOT touched.

- [ ] **Step 1: Add `mediaPosition` to `StageSceneProps`**

In `src/features/mockups/studio/MockupStudioStage.tsx`, find `interface StageSceneProps` (search `interface StageSceneProps` or the props near `chromeless?: boolean;`). Add:

```typescript
  /** Phase 126 — Global canonical media-position. {0,0} = no-op
   *  (Phase 125 byte-identical). Outer wrapper translate; inner
   *  .k-studio__stage-inner zoom scale ayrı (kat 1 vs kat 2). Rail
   *  thumb da yansıtır (canonical — zoom'un AKSİNE). */
  mediaPosition?: import("./media-position").MediaPosition;
```

- [ ] **Step 2: Destructure with neutral default in `StageScene`**

Find the `StageScene` function signature destructuring (where `chromeless = false` is destructured). Add:

```typescript
  mediaPosition = { x: 0, y: 0 },
```

- [ ] **Step 3: Import the resolver at top of file**

Near the existing studio imports in `MockupStudioStage.tsx`, add:

```typescript
import { resolveMediaOffsetPx } from "./media-position";
```

- [ ] **Step 4: Wrap composition with outer media-position wrapper (mockup branch)**

In `StageScene`'s plate JSX, the composition is rendered as `{mode === "mockup" ? (<MockupComposition .../>) : (<FrameComposition .../>)}`. Replace that ternary block by wrapping BOTH branches in a single outer wrapper div. The wrapper uses `plateDims` as renderW/renderH (the plate's px is the media render space at this surface):

```tsx
          {(() => {
            const { ox, oy } = resolveMediaOffsetPx(
              mediaPosition,
              plateDims.w,
              plateDims.h,
            );
            return (
              <div
                className="k-studio__media-pos"
                data-testid="studio-stage-media-pos"
                data-media-x={mediaPosition.x}
                data-media-y={mediaPosition.y}
                style={{
                  position: "absolute",
                  inset: 0,
                  // Phase 126 — canonical media-position translate
                  // (outer). Inner .k-studio__stage-inner zoom scale
                  // AYRI (Phase 125 dokunulmaz). neutral → translate
                  // (0,0) = DOM byte-identical no-op.
                  transform: `translate(${ox}px, ${oy}px)`,
                  transformOrigin: "center center",
                  // composition zaten plate ortasında konumlanır;
                  // wrapper sadece offset taşır, layout etkilemez.
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {mode === "mockup" ? (
                  <MockupComposition
                    slots={slots}
                    selectedSlot={selectedSlot}
                    onSelect={setSelectedSlot}
                    isPreview={isPreview}
                    deviceKind={deviceKind}
                    plateDims={plateDims}
                    layoutCount={layoutCount}
                    layoutVariant={layoutVariant}
                    previewZoom={effectiveZoom}
                  />
                ) : (
                  <FrameComposition
                    isEmpty={isEmpty}
                    isPreview={isPreview}
                    deviceKind={deviceKind}
                    frameAspect={frameAspect}
                    slots={slots}
                    selectedSlot={selectedSlot}
                    plateDims={plateDims}
                    layoutCount={layoutCount}
                    layoutVariant={layoutVariant}
                    previewZoom={effectiveZoom}
                  />
                )}
              </div>
            );
          })()}
```

IMPORTANT: Copy the exact `MockupComposition`/`FrameComposition` prop lists from the existing code in this file (they currently pass `slots`, `selectedSlot`, `onSelect`, `isPreview`, `deviceKind`, `plateDims`, `layoutCount`, `layoutVariant`, `previewZoom={effectiveZoom}`). Do NOT change those props — only move them inside the new wrapper. If the existing code differs, preserve the existing props verbatim.

- [ ] **Step 5: Pass `mediaPosition` through `MockupStudioStage` → `StageScene`**

`MockupStudioStage` is the public component that renders `<StageScene .../>`. Find its props interface (`MockupStudioStageProps`) and add:

```typescript
  /** Phase 126 — Global canonical media-position (Shell state).
   *  StageScene'e iletilir; rail thumb da yansıtır. {0,0} no-op. */
  mediaPosition?: import("./media-position").MediaPosition;
```

In `MockupStudioStage`'s destructuring add `mediaPosition = { x: 0, y: 0 },` and in the `<StageScene ...>` render add the prop:

```tsx
      mediaPosition={mediaPosition}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add src/features/mockups/studio/MockupStudioStage.tsx
git commit -m "feat(mockup): Phase 126 task 2 — StageScene outer media-position wrapper (inner Phase 125 zoom untouched; {0,0} no-op)"
```

---

## Task 3: Shell `mediaPosition` state + wire to Stage/PresetRail

**Files:**
- Modify: `src/features/mockups/studio/MockupStudioShell.tsx`

- [ ] **Step 1: Add the import**

In `src/features/mockups/studio/MockupStudioShell.tsx` near studio imports add:

```typescript
import type { MediaPosition } from "./media-position";
```

- [ ] **Step 2: Add the canonical state**

Find the existing Shell state block (where `const [previewZoom, setPreviewZoom] = useState(100);` is — around line 169). Add directly below it:

```typescript
  /* Phase 126 — Global canonical media-position (Shots.so pad).
   *  Kategori 1 shared visual param (zoom'un AKSİNE: zoom kat 2
   *  preview-only). {0,0} = no-op (Phase 125 byte-identical).
   *  Preview + rail thumb + export hepsi bunu kullanır (tek
   *  resolveMediaOffsetPx). İleride per-slot override eklenir
   *  (slot.override ?? global) — bu turda global. */
  const [mediaPosition, setMediaPosition] = useState<MediaPosition>({
    x: 0,
    y: 0,
  });
```

- [ ] **Step 3: Pass to `<MockupStudioStage>`**

Find the `<MockupStudioStage ... />` render. Add the prop alongside the existing ones:

```tsx
          mediaPosition={mediaPosition}
```

- [ ] **Step 4: Pass to `<MockupStudioPresetRail>`**

Find the `<MockupStudioPresetRail ... />` render (the rail). Add:

```tsx
            mediaPosition={mediaPosition}
            onChangeMediaPosition={setMediaPosition}
```

- [ ] **Step 5: Add `mediaPosition` to the Frame export body**

Find `handleExportFrame` (≈ line 574). Inside it the `fetch("/api/frame/export", { ... body: JSON.stringify({ ... }) })` call builds the body with `setId`, `frameAspect`, `scene: sceneBody`, `slots: slotsPayload`, `stageInnerW: 572`, `stageInnerH: ...`, `deviceShape`. Add one field to that JSON object:

```typescript
          mediaPosition,
```

(Place it next to `frameAspect` in the body object. Do NOT add `previewZoom` — zoom stays preview-only per Phase 125.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (PresetRail props not yet added → if it errors on `mediaPosition`/`onChangeMediaPosition` unknown prop, that is expected and fixed in Task 4; if so, proceed to Task 4 then re-run. If tsc is clean because PresetRail uses loose props, fine.)

- [ ] **Step 7: Commit**

```bash
git add src/features/mockups/studio/MockupStudioShell.tsx
git commit -m "feat(mockup): Phase 126 task 3 — Shell mediaPosition canonical state + wire Stage/rail/export-body"
```

---

## Task 4: PresetRail — pad wiring, remove Precision tab, Tilt honest-disabled

**Files:**
- Modify: `src/features/mockups/studio/MockupStudioPresetRail.tsx`

Context: PresetRail has the view-tabs (`Zoom | Tilt | Precision`) and renders `<StageScenePreview .../>` (the rail-head live thumb). We: (a) add `mediaPosition` + `onChangeMediaPosition` props and forward them to `StageScenePreview`, (b) remove the `Precision` view-tab entirely, (c) make `Tilt` honest-disabled.

- [ ] **Step 1: Add props to `MockupStudioPresetRailProps`**

In `src/features/mockups/studio/MockupStudioPresetRail.tsx` find `MockupStudioPresetRailProps` interface. Add:

```typescript
  /** Phase 126 — Global media-position (canonical). Rail head pad
   *  bunu sürer; StageScenePreview overlay'ine iletilir. Rail thumb
   *  candidate preview'ları da yansıtır (canonical — zoom'un
   *  AKSİNE). */
  mediaPosition?: import("./media-position").MediaPosition;
  onChangeMediaPosition?: (
    next: import("./media-position").MediaPosition,
  ) => void;
```

- [ ] **Step 2: Destructure**

In the `MockupStudioPresetRail({ ... })` destructuring add:

```typescript
  mediaPosition = { x: 0, y: 0 },
  onChangeMediaPosition,
```

- [ ] **Step 3: Find and remove the "Precision" view-tab**

Search the file for the view-tabs render (it maps over something like `["Zoom","Tilt","Precision"]` or has three buttons labelled Zoom/Tilt/Precision; search `Precision`). There are two cases:

CASE A — tabs are an array `const VIEW_TABS = ["Zoom", "Tilt", "Precision"]` (or similar): change it to `const VIEW_TABS = ["Zoom", "Tilt"] as const;` and ensure the rendered list uses it.

CASE B — three explicit buttons: delete the `Precision` `<button>...</button>` JSX block entirely.

After this change there must be NO element rendering the text "Precision" as a view tab.

- [ ] **Step 4: Make the `Tilt` tab honest-disabled**

Locate the `Tilt` view-tab button. Apply (adapt to existing button JSX shape, keep its class names but add disabled state):

```tsx
            <button
              type="button"
              className="k-studio__view-tab"
              data-testid="studio-rail-view-tilt"
              disabled
              aria-disabled="true"
              title="Tilt — coming soon"
              style={{ cursor: "not-allowed", opacity: 0.45 }}
            >
              Tilt
              <span className="k-studio__view-tab-soon"> · Soon</span>
            </button>
```

If the existing Tilt button has an `onClick`, REMOVE it (no no-op handler). The button must not be clickable and must not change any state.

- [ ] **Step 5: Forward `mediaPosition` + setter to `StageScenePreview`**

Find the `<StageScenePreview ... />` render in this file. Add the props:

```tsx
            mediaPosition={mediaPosition}
            onChangeMediaPosition={onChangeMediaPosition}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (StageScenePreview props added in Task 5 — if tsc errors here on unknown StageScenePreview props, that is expected; proceed to Task 5 then re-run.)

- [ ] **Step 7: Commit**

```bash
git add src/features/mockups/studio/MockupStudioPresetRail.tsx
git commit -m "feat(mockup): Phase 126 task 4 — rail pad wiring, remove Precision tab, Tilt honest-disabled (Shift-only precision)"
```

---

## Task 5: StageScenePreview pad overlay (safe-area + handle + framing) + pointer drag

**Files:**
- Modify: `src/features/mockups/studio/StageScenePreview.tsx`
- Modify: `src/features/mockups/studio/studio.css`

Context: `StageScenePreview` renders the scaled `<StageScene chromeless ... />` (rail-head live thumb). We add: (a) `mediaPosition`+`onChangeMediaPosition` props, forward `mediaPosition` to `StageScene` (so the thumb reflects it — canonical), (b) an overlay layer with safe-area rect + framing dim + draggable handle, (c) pointer drag mapping via `normalizePadPointToPosition`.

- [ ] **Step 1: Add CSS recipes**

In `src/features/mockups/studio/studio.css` append (after the last `.k-studio__*` rule):

```css
/* Phase 126 — Global media-position pad overlay (Shots.so parity).
 * StageScenePreview canlı preview'ı boğmaz: overlay subtle, ayrı
 * UI slab değil — yalnız safe-area çerçevesi + küçük handle. */
.k-studio__pad-overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: auto;
  cursor: crosshair;
}
.k-studio__pad-safearea {
  position: absolute;
  left: 14%;
  top: 14%;
  width: 72%;
  height: 72%;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 7px;
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.28),
    inset 0 0 0 1px rgba(0, 0, 0, 0.18);
  pointer-events: none;
}
.k-studio__pad-dim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* safe-area dışını hafif karart (Shots.so viewfinder dim
   * rgba(100,100,100,0.2) paritesi) — preview'ı boğmadan. */
  background:
    linear-gradient(rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.16));
  -webkit-mask:
    linear-gradient(#000 0 0) padding-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
}
.k-studio__pad-handle {
  position: absolute;
  width: 18px;
  height: 18px;
  margin-left: -9px;
  margin-top: -9px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.35);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  cursor: grab;
  z-index: 6;
  pointer-events: auto;
  touch-action: none;
}
.k-studio__pad-handle:active {
  cursor: grabbing;
}
.k-studio__view-tab-soon {
  font-size: 9px;
  opacity: 0.6;
}
```

- [ ] **Step 2: Add props to `StageScenePreviewProps`**

In `src/features/mockups/studio/StageScenePreview.tsx` find `StageScenePreviewProps`. Add:

```typescript
  /** Phase 126 — Global canonical media-position. StageScene'e
   *  iletilir (rail thumb yansıtır — canonical). Pad overlay
   *  handle bunu sürer. Undefined → {0,0} no-op. */
  mediaPosition?: import("./media-position").MediaPosition;
  /** Pad handle drag setter (Shell setMediaPosition). Verilmezse
   *  pad overlay görünmez (rail candidate thumb'lar yalnız
   *  yansıtır, sürmez — yalnız rail-head pad sürer). */
  onChangeMediaPosition?: (
    next: import("./media-position").MediaPosition,
  ) => void;
```

- [ ] **Step 3: Destructure + imports + refs**

Add import at top of `StageScenePreview.tsx`:

```typescript
import { useRef } from "react";
import {
  normalizePadPointToPosition,
  type MediaPosition,
} from "./media-position";
```

(Merge `useRef` into the existing React import if one exists.)

In the component destructuring add:

```typescript
  mediaPosition = { x: 0, y: 0 },
  onChangeMediaPosition,
```

Inside the component body (before `return`), add the pad ref + drag handlers:

```typescript
  const padRef = useRef<HTMLDivElement | null>(null);
  const prevPosRef = useRef<MediaPosition>(mediaPosition);

  const applyFromEvent = (clientX: number, clientY: number, shift: boolean) => {
    const el = padRef.current;
    if (!el || !onChangeMediaPosition) return;
    const r = el.getBoundingClientRect();
    const next = normalizePadPointToPosition(
      clientX,
      clientY,
      { left: r.left, top: r.top, width: r.width, height: r.height },
      shift,
      prevPosRef.current,
    );
    prevPosRef.current = next;
    onChangeMediaPosition(next);
  };

  const onPadPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onChangeMediaPosition) return;
    e.preventDefault();
    prevPosRef.current = mediaPosition;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    applyFromEvent(e.clientX, e.clientY, e.shiftKey);
  };
  const onPadPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    applyFromEvent(e.clientX, e.clientY, e.shiftKey);
  };
  const onPadPointerUpCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget as HTMLDivElement;
    if (el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  };
```

- [ ] **Step 4: Forward `mediaPosition` to the inner `<StageScene>` (rail thumb reflects it)**

Find the `<StageScene ... chromeless ... />` render inside `StageScenePreview`. Add:

```tsx
        mediaPosition={mediaPosition}
```

(This makes the rail thumb composition reflect media-position — canonical, opposite of zoom which is rail-independent.)

- [ ] **Step 5: Add the pad overlay JSX (only when `onChangeMediaPosition` is provided)**

Find the JSX root that `StageScenePreview` returns (the wrapper around the scaled StageScene). Inside that wrapper, AFTER the StageScene render, add the overlay. The handle position is derived from `mediaPosition` mapped to the pad's 0..100% space (center = {0,0}):

```tsx
        {onChangeMediaPosition ? (
          <div
            ref={padRef}
            className="k-studio__pad-overlay"
            data-testid="studio-rail-media-pad"
            data-media-x={mediaPosition.x}
            data-media-y={mediaPosition.y}
            onPointerDown={onPadPointerDown}
            onPointerMove={onPadPointerMove}
            onPointerUp={onPadPointerUpCancel}
            onPointerCancel={onPadPointerUpCancel}
          >
            <div className="k-studio__pad-dim" aria-hidden />
            <div
              className="k-studio__pad-safearea"
              data-testid="studio-rail-pad-safearea"
              aria-hidden
            />
            <div
              className="k-studio__pad-handle"
              data-testid="studio-rail-pad-handle"
              style={{
                left: `${50 + mediaPosition.x * 50}%`,
                top: `${50 + mediaPosition.y * 50}%`,
              }}
              aria-label="Media position handle"
            />
          </div>
        ) : null}
```

NOTE: the wrapper element that this overlay is added into must be `position: relative` (or `absolute`) so the `inset:0` overlay aligns. If the existing root wrapper is not positioned, add `position: relative` to its inline style (do not otherwise change it — preserve its existing scale/transform behavior).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 7: Run full mockup unit suite (regression gate)**

Run: `npx vitest run tests/unit/mockup tests/unit/selection tests/unit/selections tests/unit/products tests/unit/listings`
Expected: PASS — 730 baseline + 9 new (Task 1) = **739 passed** (zero regression)

- [ ] **Step 8: Commit**

```bash
git add src/features/mockups/studio/StageScenePreview.tsx src/features/mockups/studio/studio.css
git commit -m "feat(mockup): Phase 126 task 5 — rail-head media-position pad overlay (safe-area + handle + framing dim, pointer drag + Shift precision); rail thumb reflects mediaPosition"
```

---

## Task 6: Sharp export parity — compositor applies `resolveMediaOffsetPx`

**Files:**
- Modify: `src/providers/mockup/local-sharp/frame-compositor.ts`
- Modify: `src/server/services/frame/frame-export.service.ts`
- Modify: `src/app/api/frame/export/route.ts`

Context: The export must bake media-position into the PNG (canonical, §11.0). The compositor computes `cascadeOffsetX/Y` (composition placement in the plate). We add the same media offset to those, using the SAME `resolveMediaOffsetPx` with the plate's px (`plateLayout.plateW/plateH`).

- [ ] **Step 1: Compositor — add `mediaPosition` to `FrameCompositorInput`**

In `src/providers/mockup/local-sharp/frame-compositor.ts` find `export interface FrameCompositorInput`. Add:

```typescript
  /** Phase 126 — Global canonical media-position. Preview outer-
   *  wrapper ile AYNI resolveMediaOffsetPx; plate-area kırpar
   *  (§11.0 Preview=Export Truth). undefined → {0,0} no-op. */
  mediaPosition?: import(
    "@/features/mockups/studio/media-position"
  ).MediaPosition;
```

Add import near the top of the file:

```typescript
import { resolveMediaOffsetPx } from "@/features/mockups/studio/media-position";
```

- [ ] **Step 2: Compositor — apply offset to `cascadeOffsetX/Y`**

Find where `cascadeOffsetX` and `cascadeOffsetY` are computed (the lines `const cascadeOffsetX = Math.round(plateCx - (bMinX + bboxW / 2) * cascadeScale,)` and the Y equivalent). Immediately AFTER both are computed, add the media offset:

```typescript
  // Phase 126 — Global media-position offset (canonical). SAME
  // resolveMediaOffsetPx as preview outer-wrapper; render space =
  // plate px → resolution-independent parity. {0,0} → +0 (no-op).
  const mediaOff = resolveMediaOffsetPx(
    input.mediaPosition ?? { x: 0, y: 0 },
    plateLayout.plateW,
    plateLayout.plateH,
  );
  const cascadeOffsetXFinal = Math.round(cascadeOffsetX + mediaOff.ox);
  const cascadeOffsetYFinal = Math.round(cascadeOffsetY + mediaOff.oy);
```

Then **replace all subsequent uses** of `cascadeOffsetX` / `cascadeOffsetY` in the composite-placement code with `cascadeOffsetXFinal` / `cascadeOffsetYFinal`. (Search the file for every `cascadeOffsetX` and `cascadeOffsetY` occurrence AFTER the computation and switch to the `*Final` variants. The plate clip / plate-area mask already exists in this file — keep it; it clips media overflow exactly like preview `overflow:hidden`.)

- [ ] **Step 3: Service — add `mediaPosition` to `ExportFrameInput` + pass to compositor + sceneSnapshot**

In `src/server/services/frame/frame-export.service.ts`:

(a) Find `export interface ExportFrameInput`. Add:

```typescript
  mediaPosition?: import(
    "@/features/mockups/studio/media-position"
  ).MediaPosition;
```

(b) Find the `const compositorInput: FrameCompositorInput = { ... }` object. Add:

```typescript
    ...(input.mediaPosition
      ? { mediaPosition: input.mediaPosition }
      : {}),
```

(c) Find the `db.frameExport.create({ data: { ... sceneSnapshot: { ... } } })`. Inside the `sceneSnapshot` object add (next to `mode`/`glassVariant`):

```typescript
          mediaPosition: input.mediaPosition ?? { x: 0, y: 0 },
```

- [ ] **Step 4: Route — Zod body `mediaPosition` optional + forward**

In `src/app/api/frame/export/route.ts`:

(a) Above `const BodySchema = z.object({`, add a schema:

```typescript
const MediaPositionSchema = z.object({
  x: z.number().min(-1).max(1),
  y: z.number().min(-1).max(1),
});
```

(b) Inside `BodySchema = z.object({ ... })` add:

```typescript
  mediaPosition: MediaPositionSchema.optional(),
```

(c) In the `exportFrameComposition({ ... })` call args add:

```typescript
    ...(parsed.data.mediaPosition
      ? { mediaPosition: parsed.data.mediaPosition }
      : {}),
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: Run regression suite**

Run: `npx vitest run tests/unit/mockup tests/unit/selection tests/unit/selections tests/unit/products tests/unit/listings`
Expected: PASS — **739 passed** (zero regression)

- [ ] **Step 7: Commit**

```bash
git add src/providers/mockup/local-sharp/frame-compositor.ts src/server/services/frame/frame-export.service.ts src/app/api/frame/export/route.ts
git commit -m "feat(mockup): Phase 126 task 6 — Sharp export parity (compositor cascadeOffset += resolveMediaOffsetPx, same K; Zod body + sceneSnapshot serialize; {0,0} no-op)"
```

---

## Task 7: Stale indicator includes mediaPosition (epsilon)

**Files:**
- Modify: `src/features/mockups/components/FrameExportResultBanner.tsx`

Context: `FrameExportResultBanner` shows "Preview changed · re-export?" when the current Studio state differs from the exported snapshot. It must also flag a media-position change (using epsilon equality, no false stale).

- [ ] **Step 1: Inspect the existing staleness comparison**

Run: `grep -n "stale\|changed\|re-export\|frameAspect\|sceneOverride\|previewZoom\|snapshot\|mediaPosition" src/features/mockups/components/FrameExportResultBanner.tsx`
Identify how it compares current state vs exported snapshot (the function/memo that yields a boolean "stale"/"changed"). It receives the export's snapshot and current Shell values.

- [ ] **Step 2: Add `mediaPosition` to the comparison**

Add the import:

```typescript
import { mediaPositionsEqual } from "@/features/mockups/studio/media-position";
```

In the staleness boolean computation, add a media-position term. The banner already receives the current Shell `mediaPosition` (it must — add it as a prop if not present, mirroring how it receives `frameAspect`/`sceneOverride`; pass it from `MockupStudioShell` where the banner is rendered). The exported value lives in the result/snapshot the banner already holds (`...result.sceneSnapshot.mediaPosition` or the export response). Combine:

```typescript
  const mediaPositionChanged = !mediaPositionsEqual(
    currentMediaPosition,
    exportedMediaPosition ?? { x: 0, y: 0 },
  );
  // fold into the existing `isStale` / `changed` boolean:
  // const isStale = aspectChanged || sceneChanged || ... || mediaPositionChanged;
```

If the banner does NOT currently receive enough state to know `currentMediaPosition`/`exportedMediaPosition`:
- Add a `mediaPosition?: MediaPosition` prop to the banner's props, pass `mediaPosition={mediaPosition}` from `MockupStudioShell` where `<FrameExportResultBanner .../>` is rendered.
- The exported value: read from the export result the banner already has (the POST response or the FrameExport snapshot it tracks). If the response does not include it, default `{x:0,y:0}` (backward-compat — old exports had no media-position, so neutral).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Run regression suite**

Run: `npx vitest run tests/unit/mockup tests/unit/selection tests/unit/selections tests/unit/products tests/unit/listings`
Expected: PASS — **739 passed**

- [ ] **Step 5: Commit**

```bash
git add src/features/mockups/components/FrameExportResultBanner.tsx src/features/mockups/studio/MockupStudioShell.tsx
git commit -m "feat(mockup): Phase 126 task 7 — stale indicator includes mediaPosition (epsilon equality, no false stale)"
```

---

## Task 8: Production build + clean restart + live browser verification

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `NODE_OPTIONS="--max-old-space-size=4096" npx next build`
Expected: exit 0 ("Compiled successfully")

- [ ] **Step 2: Clean restart the dev server**

```bash
# stop existing preview server (use preview_list → preview_stop), then:
lsof -ti:3000 | xargs kill -9 2>/dev/null; rm -rf .next; sleep 1
```
Then start fresh via `preview_start` (`reused:false`). Do NOT trust hot-reload state.

- [ ] **Step 3: Auth + open Studio in Claude in Chrome (large screen)**

In the Chrome MCP tab, navigate to `http://localhost:3000`, log in (`admin@etsyhub.local` / `admin12345`), then open `/selection/sets/cmov0ia370019149ljyu7divh/mockup/studio`. Wait for the route to compile + render (poll until `.k-studio__stage` exists).

- [ ] **Step 4: Verify `{0,0}` sacred no-op**

Via Chrome `javascript_tool`: confirm `[data-testid="studio-stage-media-pos"]` exists, `data-media-x="0" data-media-y="0"`, its `transform` computed = `matrix(1, 0, 0, 1, 0, 0)` (translate 0,0), and the plate box dims match the Phase 125 baseline (1066×599 at zoom 100 for this set). Screenshot. Expected: composition identical to before this phase.

- [ ] **Step 5: Verify pad drag pans composition + rail thumbs in sync**

Drag the rail-head pad handle (`[data-testid="studio-rail-pad-handle"]`) by a known delta. Measure: `[data-testid="studio-stage-media-pos"]` transform translate becomes non-zero; `data-media-x/y` updated; the middle composition visibly shifted; the rail candidate thumbs ALSO shifted (canonical — reflect mediaPosition). Screenshot. Expected: middle + rail move together; pad handle moved.

- [ ] **Step 6: Verify Shift precision + click-to-jump + clamp**

Hold Shift while dragging → smaller delta (precision). Click the pad (not on handle) → handle jumps to the point. Drag far outside → mediaPosition clamps to ±1 (`data-media-x` never exceeds 1/-1). Screenshot.

- [ ] **Step 7: Verify zoom × media-position are distinct layers**

Set zoom to 150 (rail slider/pill) AND set a media-position offset. DOM: `.k-studio__media-pos` (outer) has `translate(...)` (mediaPosition), `.k-studio__stage-inner` (inner) has `scale(...)` (zoom × cascadeScale) — two distinct elements, two distinct transforms. Confirm rail thumbs reflect mediaPosition but NOT zoom (zoom rail-independent per Phase 125). Screenshot.

- [ ] **Step 8: Verify Tilt honest-disabled + no Precision tab**

DOM: `[data-testid="studio-rail-view-tilt"]` is `disabled`, not clickable, has "· Soon"; there is NO element with view-tab text "Precision". Click Tilt → no state change.

- [ ] **Step 9: Verify Frame export bakes media-position (pixel parity)**

Set a clear media-position offset (e.g. x≈0.4, y≈-0.3). Trigger Frame export. Fetch the exported PNG; sample pixels / compare composition placement to a {0,0} export — the composition must be shifted by the same proportional offset (preview offset ↔ PNG offset, §11.0). Confirm `FrameExport.sceneSnapshot.mediaPosition` persisted (via the API/DB or the result payload). Screenshot of exported PNG + preview side-by-side.

- [ ] **Step 10: Verify Product MockupsTab continuity**

Open the Product detail (`/products/cmor0wkjt0001iqnwjvearsy0`) → Mockups tab. Confirm tiles render (Phase 101 baseline: `aspect-[4/3] bg-ink object-contain`, 1920×1080), the new export tile shows the media-positioned PNG, count continuity intact. Screenshot.

- [ ] **Step 11: Verify stale indicator**

After an export, change media-position in Studio → `FrameExportResultBanner` shows "Preview changed · re-export?". Reset to the exported value (epsilon) → stale clears. Screenshot.

- [ ] **Step 12: Shots.so reference re-check (Claude in Chrome)**

Open `https://shots.so/`, dismiss any banner/modal, confirm the pad's `.drag-handle`/`.shadow-layer` semantics are unchanged from this design (handle pans media, safe-area = plate window). Document any discrepancy.

- [ ] **Step 13: Regression re-confirm + final commit (CLAUDE.md)**

Re-run: `npx tsc --noEmit` (clean), `npx vitest run tests/unit/mockup tests/unit/selection tests/unit/selections tests/unit/products tests/unit/listings` (739 passed), build was step 1.

Append the Phase 126 entry to `CLAUDE.md` (before `## Marka Kullanımı`) covering: why no full Remotion migration, why global media-position, Shots.so live research + the honest file-upload limit, drag-handle controls media pan, safe-area = plate window, new canonical `mediaPosition` param + shared resolver + K=0.5, outer-translate/inner-zoom split, preview/export/rail parity, regression guardrails, real-asset verification, tests run, browser screenshot proof, future per-slot extension, remaining gaps (Tilt deferred, per-slot deferred), next step.

```bash
git add CLAUDE.md
git commit -m "feat(mockup): Phase 126 — global media-position pad (Shots.so-canonical: drag handle pans media within fixed plate, safe-area rect, Shift precision; new canonical mediaPosition param, shared resolver, export parity; Tilt honest-disabled)"
git push origin main
```

---

## Self-Review

**Spec coverage:** spec §4 canonical state → Task 3; §5 shared resolver → Task 1; §6 pad UI → Task 5 + Task 4; §7 export/Sharp/Product → Task 6; stale §7.5 → Task 7; §8 guardrails → enforced per task + Task 8 verification; §9 test plan → Task 8; §10 file list → File Structure table covers all 11 files; outer/inner wrapper §4 → Task 2; Tilt honest-disabled + remove Precision §6 → Task 4. No gap.

**Placeholder scan:** All code steps contain full code. Task 7 has conditional ("if banner doesn't receive enough state") but gives the explicit fallback action — acceptable because the banner's current prop surface is genuinely variable and the step prescribes the exact resolution either way. No "TBD"/"add validation"/"similar to".

**Type consistency:** `MediaPosition`, `MEDIA_POSITION_PAN_K`, `MEDIA_POSITION_NEUTRAL`, `resolveMediaOffsetPx(pos,renderW,renderH)→{ox,oy}`, `clampMediaPosition`, `normalizePadPointToPosition(clientX,clientY,padRect,shiftKey,prev)`, `mediaPositionsEqual` — defined in Task 1, used identically in Tasks 2/3/4/5/6/7. Prop names `mediaPosition` / `onChangeMediaPosition` consistent across Shell→Stage→PresetRail→StageScenePreview. CSS classes `.k-studio__media-pos` / `.k-studio__pad-overlay` / `.k-studio__pad-safearea` / `.k-studio__pad-dim` / `.k-studio__pad-handle` / `.k-studio__view-tab-soon` consistent between Task 2/5 JSX and Task 5 CSS. `data-testid`s consistent with Task 8 verification (`studio-stage-media-pos`, `studio-rail-media-pad`, `studio-rail-pad-handle`, `studio-rail-pad-safearea`, `studio-rail-view-tilt`). Test count: 730 baseline + 9 Task 1 = 739, used consistently in Tasks 5/6/7/8. No inconsistency.
