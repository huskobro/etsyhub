# Global Media-Position Pad — Design Spec (Phase 126)

> Status: Approved (brainstorming, 2026-05-16). Next: writing-plans.
> Branch: `main`. Repo: EtsyHub (Kivasy).

## 1. Goal

Bring Shots.so's "panel above the zoom slider" product behavior into the
Kivasy Mockup Studio as a **global media-position pad**:

- A draggable handle that pans the composition's media within the plate.
- A fixed safe-area / visible-area rectangle (the plate window).
- A current-framing indicator.
- "Hold ⇧ for precision" fine-step modifier.
- A new **canonical, global** `mediaPosition` visual parameter that lives
  in preview, exports, right-rail thumbs, and is carryable to Product.

Out of scope this round (explicitly): per-slot media editing, Tilt as a
real feature, full Remotion migration, schema migration, WorkflowRun.

## 2. Why these decisions (short, honest)

**No full Remotion migration now.** Shots.so is entirely Remotion
(live evidence: 10 `.__remotion-player` instances; editor preview =
export = same composition, DOM-rendered, canvas only for video
"Animate"). Kivasy's right-rail / StageScene / Sharp-export /
Preview=Export-Truth balance was built over ~30 phases at high cost. A
renderer migration rewrites that whole chain — high regression, zero
user value (mockup PNG is identical). Remotion is the right tool later
for **animate / Etsy video / motion export** (a new pipeline anyway),
not for static mockups.

**Global media-position (not per-slot) this round.** Main flow =
fast decision (Mockup Studio); precise per-slot = a future separate
Advanced Layout Editor. Per-slot in the main screen now would heavy
the UX, create selection ambiguity, and over-stress the preview /
export / rail / state chain. Global = fast, clear, safe; architecture
still extends to per-slot later without API change
(`slot.mediaPositionOverride ?? global`).

**media-position is canonical (kategori 1), not a preview-only
helper.** Zoom is kategori 2 (preview-only, NOT in export, rail-
independent — Phase 125 baseline, untouched). media-position is
kategori 1: lives in preview, **enters export**, rail thumbs reflect
it, it is part of the final visual. The two are kept physically
separate (separate DOM wrappers, separate state).

## 3. Shots.so research — what was confirmed, and the honest limit

Live Chrome DOM measurement of the Shots.so editor pad
(`.position-pad-safearea`):

- `.position-pad-safearea` = the pad container; its mini-render uses
  the same `.frame`/`.frame-content` classes as the main stage (a
  scaled live composition preview).
- `.shadow-layer` (≈115×115 rounded rect + drop-shadow, fixed in pad)
  = the **plate's visible-area boundary** — fixed "window"; does NOT
  move on pan.
- `.drag-handle` (`cursor: grab`, `z-index: 2`, `pointer-events: all`,
  transform-translate positioned) = the **draggable media-position
  anchor** (the "circle"). A successful drag in an earlier session
  shifted the main composition `<img>` y from -534 → -508 → handle
  pans the media.
- `.viewfinder-div` = media framing/crop indicator.
- `Zoom | Tilt` tabs = mode toggle; slider becomes zoom% (Zoom) or
  rotation° (Tilt). "Hold ⇧ for precision" = Shift fine-step modifier.
- Zoom scales `.component` (composition content); plate fixed-size
  (already matched in Kivasy Phase 125).

**Honest limit:** the exact pad-px → media-offset *ratio* could not
be measured with live interaction because the Chrome extension
**blocks file upload to Shots.so**, and the default placeholder does
not make the handle respond. The pad's *behavior and semantics* are
confirmed; the *encoding* is therefore a deliberate design choice (a
normalized model — the correct resolution-independent encoding for
Preview=Export-Truth), not a guess at behavior.

## 4. Canonical state & encoding

- New Shell state: `mediaPosition: { x: number; y: number }`,
  `x, y ∈ [-1, +1]`. `{x:0,y:0}` = today's behavior, **byte-identical
  no-op** (backward-compat: missing/old → `{0,0}`).
- **State stays normalized only.** No px / no plateDims in the state.
  Preview, rail, and export each derive px from their own render
  dimensions.
- Pan-range constant `K = 0.5` (single source, in the shared helper).
  x=+1 → composition shifts +50% of plate width; plate `overflow:
  hidden` clips overflow (Shots.so safe-area behavior).
- **Two physically separate wrappers (NOT one combined transform
  string):**
  - **Outer wrapper** (new div) = canonical `mediaPosition` →
    `translate(ox, oy)` where `(ox,oy) = resolveMediaOffsetPx(pos,
    renderW, renderH)`.
  - **Inner wrapper** = `.k-studio__stage-inner` = `previewZoom`
    scale (Phase 125 — untouched).
  - Kategori 1 (canonical translate) and kategori 2 (preview-only
    zoom scale) are distinct DOM layers → export parity safe, no
    mixing.

## 5. Shared resolver (drift protection — single source)

New pure-TS module `src/features/mockups/studio/media-position.ts`
(no DOM/React/sharp imports → importable by client preview/rail AND
server-side Sharp compositor; respects CLAUDE.md Madde V build-
boundary):

- `export const MEDIA_POSITION_PAN_K = 0.5;`
- `export type MediaPosition = { x: number; y: number };`
- `export const MEDIA_POSITION_NEUTRAL: MediaPosition = { x: 0, y: 0 };`
- `resolveMediaOffsetPx(pos, renderW, renderH) → { ox, oy }`
  = `{ ox: pos.x * renderW * K, oy: pos.y * renderH * K }`.
  **The single formula.** Preview outer-wrapper, rail thumb, and
  Sharp compositor all call this.
- `clampMediaPosition(p) → MediaPosition` (x,y clamped to [-1,1]).
- `normalizePadPointToPosition(clientX, clientY, padRect, shiftKey,
  prev) → MediaPosition` — **pure math** (inputs: numbers + a
  `{left,top,width,height}` rect + boolean + previous position; NO
  DOM/event object). Maps pad-px → normalized; with shiftKey the
  applied delta from `prev` is divided by 4 (precision). Returns
  clamped result.
- `mediaPositionsEqual(a, b) → boolean` — epsilon equality
  (`Math.abs(a.x-b.x) < 1e-3 && Math.abs(a.y-b.y) < 1e-3`) for the
  stale indicator (no false stale from float drift).

## 6. Pad UI (overlay on existing StageScenePreview)

The pad is an **overlay on the existing rail-head `StageScenePreview`
live thumb interior** — NO new renderer, NO separate thumb system.
The existing chromeless scaled StageScene (Phase 117-118 single-
renderer) stays exactly as-is; a `pointer-events`-active overlay layer
is added on top.

Three overlay layers (Shots.so parity):

1. **Safe-area rectangle** `.k-studio__pad-safearea` — fixed,
   centered rounded rect (≈72% of pad), subtle border/shadow.
   Represents the plate's visible window. Does NOT move on pan.
2. **Framing indicator** `.k-studio__pad-viewfinder` — light dim
   outside the safe-area rect (Shots.so `rgba(100,100,100,0.2)`
   parity) so the current framing reads clearly. The existing
   StageScene mini-render already shows the composition; the rect
   frames it. Handle ↔ safe-area must feel visually consistent
   (handle moves in pad space; the rect is the operator's reference
   window).
3. **Drag handle** `.k-studio__pad-handle` — small round handle
   ("circle", `cursor: grab`, top z-index, `pointer-events: all`).
   Position derived from `mediaPosition`: handle center maps the
   pad's -1..+1 coordinate space (center = `{0,0}`).

Interaction:

- `onPointerDown` on handle → `setPointerCapture`; `pointermove` →
  `normalizePadPointToPosition` → `setMediaPosition`.
- Shift held → precision (delta from previous ÷ 4).
- Click on pad (outside handle) → handle jumps to that point
  (`normalizePadPointToPosition` on the click point). Clamp + drag
  clean.
- `pointerup` / `pointercancel` → release capture, clean teardown.
- On change, the outer-wrapper translate updates → middle-panel
  composition + all rail thumbs (canonical state) move in sync,
  immediately.

User model for the panel (exactly this — no extra modes):

- **Zoom** — existing zoom slider (Phase 125, untouched).
- **Tilt** — honest **disabled** (`disabled`, "Soon" caption,
  `cursor: not-allowed`, NOT clickable, no no-op).
- **Hold ⇧ for precision** — Shift modifier only.
- The existing separate **"Precision" view-tab is removed** (it is
  not a mode; precision is only the Shift modifier during pad drag).

Rail thumbs: because `mediaPosition` is canonical, chromeless
StageScene instances also get the outer-wrapper translate → rail
candidate previews **reflect media-position** (opposite of zoom,
which is rail-independent). Single render path preserved (StageScene
already shared).

## 7. Export / Sharp pipeline / Product handoff parity

§11.0 Preview = Export Truth — media-position is canonical, so it
**enters export** (unlike zoom).

1. **Request body:** `MockupStudioShell` Frame export adds
   `mediaPosition: {x,y}` to the existing serialized scene payload
   (Phase 99/125 pattern). `previewZoom` is NOT added (kategori 2,
   Phase 125 baseline preserved).
2. **API + service:** `/api/frame/export` Zod body gets optional
   `mediaPosition` (default `{0,0}` → backward-compat no-op).
   `frame-export.service.ts` forwards to `frame-compositor.ts` and
   serializes it into `FrameExport.sceneSnapshot` (existing JSON
   field — NO schema migration).
3. **Sharp compositor (`frame-compositor.ts`):** when placing the
   composition into the plate area (Phase 111 `compositionGroup`
   plate-fit + Phase 125 zoom-less placement), apply
   `resolveMediaOffsetPx(mediaPosition, plateW, plateH)` — the SAME
   helper, SAME K. Plate-area mask clips overflow (Phase 125 parity)
   → preview-panned == export-panned. Pixel-verified
   (browser DOM offset ↔ exported PNG offset).
4. **Product handoff (Phase 100 pattern):** `sceneSnapshot` carries
   `mediaPosition`. Product MockupsTab shows the real export PNG
   (Phase 101 tile baseline) → media-position already baked into the
   PNG; **MockupsTab code does NOT change** (continuity preserved,
   export PNG is canonical truth).
5. **Stale indicator:** `FrameExportResultBanner` "Preview changed ·
   re-export?" includes `mediaPosition` via `mediaPositionsEqual`
   (epsilon — no false stale; Phase 99 baseline).

## 8. Regression guardrails (explicitly watched)

| Risk | Protection |
|---|---|
| Rail reverts to separate thumb renderer | Pad = overlay on existing StageScenePreview; NO new renderer. StageScene shared path untouched. |
| Outer/inner wrapper mixing | Outer = mediaPosition translate (new div); inner = `.k-studio__stage-inner` zoom scale (Phase 125 unchanged). Distinct layers. |
| `{0,0}` no-op broken | `resolveMediaOffsetPx(0,0,…) = {0,0}` → `translate(0,0)` → DOM byte-identical. Verify: zoom 100 + mediaPos {0,0} == Phase 125 baseline. |
| Preview ≠ export drift | Single `resolveMediaOffsetPx` + single K. Pixel proof: browser DOM offset ↔ exported PNG offset. |
| Zoom mixing | Separate wrapper + separate state (kat 1 vs 2); zoom NOT in export (Phase 125), mediaPosition IS. |
| Product MockupsTab continuity | MockupsTab code unchanged; export PNG canonical truth (Phase 101 baseline). |
| chromeless rail / aspect-aware / selected ring / overlay badge / no dim-hover / no frame-cap / export persistence+handoff | None touched — only pad overlay + outer wrapper added; Phase 117/118/120/121/122/100 baselines preserved. |
| "Precision" appears as a separate mode | "Precision" view-tab removed; Shift modifier only. |
| Tilt fake-works | Tilt honest-disabled, not clickable, no no-op. |
| Float drift false stale | `mediaPositionsEqual` epsilon 1e-3. |

## 9. Test / verification plan

- `tsc --noEmit` clean.
- `vitest tests/unit/{mockup,selection,selections,products,listings}`
  → 730/730 (zero regression).
- `next build` (`NODE_OPTIONS=--max-old-space-size=4096`).
- **Clean restart** (fresh `.next` + port kill; do NOT trust hot-
  reload state).
- **Kivasy large-screen browser verification (Claude in Chrome —
  preview tool screenshots are too small)**:
  - mediaPos {0,0} = no-op (plate/composition == baseline).
  - pad handle drag → composition + rail thumbs move in sync (DOM
    measure + screenshot).
  - Shift precision (delta ÷4).
  - click pad → handle jumps.
  - zoom 150 + mediaPos combined → outer translate + inner scale
    distinct (DOM matrix proof).
  - Tilt disabled (not clickable).
  - Frame export → exported PNG has media-position (pixel proof:
    preview offset ↔ PNG offset).
  - Product MockupsTab → tile continuity, new export has media-
    position.
  - rail / middle / export parity preserved.
- **Shots.so reference re-check (Claude in Chrome)**: confirm pad
  handle/safe-area semantics unchanged.

## 10. File change list (estimated)

1. `src/features/mockups/studio/media-position.ts` — NEW (shared
   resolver, K, types, clamp, pad-map, epsilon-equal).
2. `MockupStudioShell.tsx` — `mediaPosition` state + Stage /
   PresetRail / export-body wiring.
3. `MockupStudioStage.tsx` — outer wrapper (mediaPosition translate)
   inside StageScene; inner Phase 125 zoom untouched.
4. `StageScenePreview.tsx` — pad overlay (safe-area rect + handle +
   framing dim) + pointer drag / Shift interaction.
5. `MockupStudioPresetRail.tsx` — remove "Precision" tab, Tilt
   honest-disabled, pad wiring.
6. `studio.css` — `.k-studio__pad-safearea` / `-handle` /
   `-viewfinder` recipes.
7. `src/app/api/frame/export/route.ts` — Zod body `mediaPosition`
   optional.
8. `frame-export.service.ts` — mediaPosition → compositor +
   sceneSnapshot serialize.
9. `frame-compositor.ts` — `resolveMediaOffsetPx` composition offset
   (export parity).
10. `FrameExportResultBanner.tsx` — stale indicator includes
    mediaPosition (epsilon).
11. `CLAUDE.md` — Phase 126 entry.

## 11. Out of scope (NOT this round)

Per-slot media editing (future Advanced Layout Editor), Tilt feature,
Remotion migration, schema migration, WorkflowRun, new big
abstraction.

## 12. Future extension note

Per-slot later: add `StudioSlotMeta.mediaPositionOverride?:
MediaPosition`; resolve order `slot.mediaPositionOverride ?? global`.
`resolveMediaOffsetPx` unchanged; the global API is untouched. A
separate Advanced Layout Editor surface; main flow not disturbed.
`sceneSnapshot` naming stays simple now (`mediaPosition`); a future
`mediaPositionOverrides` key is added then (no premature abstraction).
