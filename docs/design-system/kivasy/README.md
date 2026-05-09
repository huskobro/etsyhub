# Kivasy Design System

> Public product name: **Kivasy**. Repo slug `EtsyHub` is a git-history compat
> name only — **never use it as a brand**. This system is the single source of
> truth; anything under `docs/design/EtsyHub/` or `docs/plans/` in the source
> repo is historical and must be ignored.

Kivasy is an operator tool for Etsy sellers producing **digital downloadable
products** end-to-end: references → AI variations → curation → mockups →
listing prep → Etsy draft. It is **not** a physical POD or apparel tool.

The same UI scales from a **small job** (1 batch, ~10 assets, ~15 min) to a
**big operation** (10+ batches, 200+ assets, multi-mockup). It is web today
and Tauri-ready (macOS / Windows shell) tomorrow.

---

## Sources used

- **Codebase** — `huskobro/etsyhub` @ branch `claude/epic-agnesi-7a424b`
  - `docs/CLAUDE_DESIGN_CONTEXT.md` — single source of truth (Turkish)
  - `tailwind.config.ts` — design token bindings
  - `src/app/globals.css` — original CSS variable definitions
  - `src/components/ui/*` — primitives (Button, Card, Sidebar, NavItem,
    PageShell, Input, Chip, Badge, Toolbar, Thumb, StateMessage, …)

Anything inside `docs/design/EtsyHub/` or `docs/design/EtsyHub_mockups/` is
**ignored** per the design context (old brand, out-of-scope flows).

---

## Index

| File / folder | What it is |
|---|---|
| `README.md` | This file. Brand context + content + visual + iconography fundamentals. |
| `SKILL.md` | Cross-compatible skill manifest for Claude Code / Agent Skills. |
| `ui_kits/kivasy/v4/tokens.css` | **Single token source of truth.** All `--k-*` variables (surface, ink, line, orange, blue, purple, status, font, radius, ease) plus semantic component recipes (`.k-btn`, `.k-card`, `.k-thumb`, `.k-input`, …). |
| `ui_kits/kivasy/v4/` | Wave-A primitives + screens — A1 Library, A2 Batches index, A3 Batch detail, A4 Review workspace, A5 Product detail, A6 Create variations, A7 Apply mockups. |
| `ui_kits/kivasy/v5/` | Wave-B sourcing / curation / output screens — B1 References, B2 Selections index, B3 Selection detail, B4 Products index, B5 Add reference modal, B6 Generate listing modal. |
| `ui_kits/kivasy/v6/` | Wave-C system layer — C1 Templates, C2 Settings (detail-list), C3 Overview rework. |
| `ui_kits/kivasy/Kivasy UI Kit v3.html`, `v3.1.html` | Direction-history checkpoints. Kept as visual reference; not the canonical UI kit. |
| `ui_kits/kivasy/Kivasy UI Kit v4.html`, `v5.html`, `v6.html` | Live UI kit entry points — one per wave. Each is intentionally separate; do not merge. |
| `assets/` | Brand mark + sample imagery. |
| `preview/` | Small HTML cards rendered into the Design System tab. |

### Surface map (waves)

```
v4 — Wave A · production spine
   A1 Library            A2 Batches index       A3 Batch detail
   A4 Review workspace   A5 Product detail      A6 Create variations
   A7 Apply mockups

v5 — Wave B · sourcing / curation / output
   B1 References         B2 Selections index    B3 Selection detail
   B4 Products index     B5 Add reference       B6 Generate listing

v6 — Wave C · system layer
   C1 Templates          C2 Settings            C3 Overview rework
```

### Implementation status (which design surfaces ship live today)

Updated 2026-05-09 (post R11.5). MVP omurgası canlı.

| Surface | Wave | Implementation | Live route |
|---|---|---|---|
| A1 Library | A | ✓ R2 | `/library` |
| A2 Batches index | A | ✓ R3 | `/batches` |
| A3 Batch detail | A | ✓ R3 | `/batches/[batchId]` |
| A4 Review workspace | A | ✓ R3 | `/batches/[batchId]/review` |
| A5 Product detail | A | ✓ R5 | `/products/[id]` |
| A6 Create Variations modal | A | ✓ R3 | from Library detail panel |
| A7 Apply Mockups modal | A | ✓ R5 | from Selections → Mockups CTA |
| B1 References (single-surface) | B | ⏳ post-MVP | sub-view'lar şimdilik ayrı top-level route'larda (`/references`, `/trend-stories`, `/bookmarks`, `/competitors`, `/collections`) |
| B2 Selections index | B | ✓ R4 | `/selections` |
| B3 Selection detail | B | ✓ R4 | `/selections/[setId]` |
| B4 Products index | B | ✓ R5 | `/products` |
| B5 Add Reference modal | B | ✓ R6 | from References surfaces |
| B6 Generate Listing modal | B | ✓ R5 | from Products → Listing tab |
| C1 Templates | C | ✓ R6+R7 | `/templates?sub=prompts\|styles\|mockups\|recipes` |
| C2 Settings | C | ✓ R6+R7+R11.5 | `/settings` (8 live + 4 deferred panes) |
| C3 Overview rework | C | ⏳ post-MVP | `/overview` minimal stub; bağlı route'lardaki veri yeterli |
| D1 AI Providers pane | D | ✓ R6+R7+R10+R11.5 | `/settings?pane=providers` (real backing + budget enforcement + watchdog) |
| D2 A6 Prompt Preview | D | ✓ R3 | inside A6 modal |

**Capability layer (R8 → R11.5):**

| Capability | Implementation | Live |
|---|---|---|
| Recipe runner (chain + run modal + audit history) | R8+R9+R11 | from Templates → Recipes |
| Mockup PSD upload + smart-object detection | R8+R9 | from Templates → Mockup Templates → Upload |
| Settings persistence (UserSetting key-scoped) | R7+R8 | all live panes |
| AI Provider budget enforcement (variation + listing-copy) | R10 | call-path's `assertWithinBudget` |
| In-app notifications inbox (15s polling) | R9+R11+R11.5 | `/settings?pane=notifications` |
| Cost summary aggregation | R7 | AI Providers 4-stat row |
| Recipe audit history | R9+R10 | inside Run Recipe modal |

### Removed in housekeeping pass

Out-of-scope / superseded — do not reintroduce:

- `colors_and_type.css` (root) — superseded by `ui_kits/kivasy/v4/tokens.css`.
- `ui_kits/kivasy/Kivasy UI Kit.html` (v1 loader) — replaced by v4–v6 waves.
- `ui_kits/kivasy/Primitives.jsx`, `Shell.jsx`, `Screens.jsx` — v1-era,
  replaced by `v4/base.jsx` and the per-wave screen files.

---

## 1 · Information Architecture (locked)

Two groups, eight items. **Closed list — no new top-level surfaces.**

```
PRODUCE                        SYSTEM
  Overview                       Templates
  References                     Settings
  Batches
  Library
  Selections
  Products
```

Sub-views live inside their parent (e.g. `References → Pool / Stories /
Inbox / Shops / Collections`). Admin scope is a small footer badge — **not**
a separate sidebar.

The production chain is one-way and visible:

```
Reference → Batch → Library → Selection → Product → Etsy Draft
```

Each arrow is a **single primary CTA**, usually opening a **split modal**,
not a new page.

---

## 2 · Content Fundamentals

**Voice.** Calm, precise, operator-direct. The product is a cockpit, not a
cheerleader. It tells you the next step in two or three words and gets out
of the way.

**Person.** Second person, plural-implicit. "Add reference", "Send to Etsy as
Draft", "Apply mockups". Avoid "Let's…", "Welcome back!", "We'll get you
started" — they slow operators down. The Turkish source UI uses the same
register: *"Hoş geldin"*, *"Çalışma alanının güncel durumu"* — direct, no
exclamation marks.

**Casing.**
- UI labels: **Sentence case** (`Add reference`, `Send to Etsy as Draft`).
- Mono meta labels (above stat numerals, in nav group titles, in badges):
  **Title Case**, **never UPPERCASE**. Tracking is set via `--tracking-meta`
  (0.6px), and the Badge/NavItem components explicitly forbid `uppercase`
  utilities.
- Buttons: imperative verb-first (`Keep`, `Reject`, `Regenerate`, `Apply
  mockups`, `Send to Etsy as Draft`). Never "Click here".

**Numbers / counts.** Tabular numerals, mono only on the Stat Card numeral
and in row counts (e.g. `24` in a sidebar nav badge). Inline counts inside
sentences stay sans.

**Stage CTA color language** (canonical across v4–v6):
- **Orange** = create upstream — `+ New Batch`, `Create variations`, `+ New
  Template`, `+ Add Reference`.
- **Purple** = edit midstream — `Edit color`, `Crop`, `Magic eraser`,
  `Apply mockups`.
- **Blue** = publish downstream — `Send to Etsy as Draft`.

The operator should be able to glance at a button color and infer which
stage of the chain they're touching.

**Emoji.** **No.** Not in copy, not as nav icons, not on cards, not in
empty states. The `StateMessage` component spec explicitly forbids
illustrations and emoji.

**Localisation.** Source repo ships TR strings; the design system is brand-
neutral and accommodates either language at the same densities. Don't pad
microcopy "to match English" — Kivasy copy is short on purpose.

**Examples (good).**
- *"What needs attention now"* — Overview subtitle.
- *"24 of 32 kept"* — review progress meta.
- *"All 25 designs included"* — bundle preview sheet caption.
- *"Better on desktop"* — mobile downgrade hint for high-volume review.
- *"Send to Etsy as Draft"* — never "Publish".

**Examples (avoid).**
- "🎉 Your assets are ready!" (emoji, exclamation, decorative).
- "AWESOME WORK" (caps, hype).
- "Let's create something amazing" (marketing voice).
- "Hub" / "EtsyHub" anywhere in copy.

---

## 3 · Visual Foundations

**Direction.** Editorial cockpit. Premium, calm, modern, operator-friendly.
Bright but warm. Density is first-class — operators may have a sidebar, two
panes, an Active Tasks panel, and a 200-row virtualized grid open at once,
and it should still feel breathable.

**Surfaces.** Warm off-white `--k-bg` is the working canvas. Cards sit on
`--k-paper` (white) with a 1px `--k-line` border. Sidebar and toolbar
bands use `--k-bg-2` — a single step warmer/darker than the canvas.
**No gradients on surfaces. No glass, no glow, no full-bleed hero
illustrations.** A dashboard backdrop is just `bg`; a card is just
`paper + line + shadow-card`.

**Color vibe.** Warm, restrained, clay-leaning. The accent is one tone of
coral (`--k-orange`, `#E85D25`) used for primary CTAs, the active nav rail,
the selected-row tint, and small accent moments. Status colors (success,
warning, danger, info) appear as `tone-soft` chips and `tone` text — never
as full-tile fills.

**Typography.**
- Display: **Clash Display** (500 / 600 / 700) — page H1, stat numerals.
- Body / UI: **General Sans** (300 / 400 / 500 / 600 / 700) — everything else.
- Mono / meta: **Geist Mono** (400 / 500 / 600) — meta labels, badges,
  IDs, tabular numerals.
- Sizes step in single px ticks: 11 / 13 / 14 / 15 / 17 / 20 / 24 / 32.
- Body: 14px General Sans, 1.5 leading. Headings 600 weight, tight leading.
- Mono is *only* for the meta layer: stat-card labels, nav group titles,
  badge text, row counts, code/IDs. Never for body or headings.

**Spacing.** 4-based scale (`4 / 8 / 12 / 16 / 20 / 24 / 28 / 32 / 40 / 48 /
64 / 80`). Default page padding is 24 (user density) or 16 (admin density);
default grid gap is 16/12.

**Radii.** Three steps: `sm 4` (chip / badge), `md 6` (button / input /
card), `lg 10` (dialog). Nothing larger; no pill-shaped buttons.

**Borders.** 1px, always. `line` for default, `line-strong` for
hover/focus, `line-soft` for table row separators. Hover changes the
border color and bumps the shadow — it does **not** scale the box.

**Shadows.** Three steps: `card` (1px ambient), `card-hover` (4px lift on
hover), `popover` (12px floating menu / dialog). All shadows are warm-
tinted (`rgba(22, 19, 15, …)`) so they read consistent on the off-white
canvas.

**Hover states.**
- Buttons: bg shifts (`bg-orange` → darker) or border darkens (`line` →
  `line-strong`).
- Cards (interactive only): `line` → `line-strong`, `shadow-card` →
  `shadow-card-hover`. **Card box never scales.**
- Thumbnails *do* scale: `transform: scale(1.015)` over 180ms ease-out —
  applied only on the image surface, never the card.
- Nav items: muted text + subtle bg fill on hover; on active they get a
  surface chip + a 2px accent rail on the left edge.

**Press / active.** No shrink/scale on click. Buttons just stay in their
hover bg. Selected list/stat cards get an `orange-soft` background;
selected asset thumbnails get a 2px `orange` outer ring with a 2px ring
offset.

**Focus.** `focus-visible:ring-2 ring-orange ring-offset-2`. Inputs are
the exception — focus colors the wrapper border to `orange` instead of
adding a ring (less noisy in dense forms).

**Motion.** `cubic-bezier(.2, .7, .3, 1)` ease-out, with two durations:
`120ms` (state changes — borders, bg) and `180ms` (transforms — thumbnail
scale). No bouncy springs, no entrance animations on page load. The only
keyframe is `ehPulse` (1.8s opacity 1 ↔ 0.55) for in-progress job rows.

**Backgrounds & imagery.** No decorative backgrounds. Asset thumbnails fall
back to nine named "kind" presets when no source image is present
(`boho`, `christmas`, `nursery`, `poster`, `clipart`, `sticker`,
`abstract`, `landscape`, `neutral`) — these are deliberately matte, never
photo-real. Real generated assets (Midjourney) take over once present.

**Layout rules.**
- Sidebar `232w`, persistent, `bg-2` band, 1px right border.
- Topbar `56h`, sits inside the main column, 1px bottom border.
- Optional toolbar band sits below topbar, `line-soft` bottom.
- Content `max-width 1440`. Page padding 24 (user) / 16 (admin).
- One **primary CTA per page**, top-right. One primary CTA per modal.
- Long subflows → split modal (`1100w`, source 30% / detail 70%), never a
  new page.
- Persistent **Active Tasks** floating panel (bottom-right) — visible on
  every page, not embedded as a dashboard widget.

**Density.** First-class. Every list / grid / table renders a Comfortable /
Compact / Dense toggle that persists. Admin pages default to Compact; user
pages default to Comfortable.

**Transparency / blur.** Avoid. Modal scrim is a flat 60% black
(`rgba(0,0,0,0.6)`); popover surfaces are opaque white with `shadow-
popover`. The codebase never uses `backdrop-filter`.

**Card recipes.**
- **Stat card** — 16 padding, mono title-case label, 32 numeral, optional
  trend badge.
- **Asset card** — 0 padding outer, full-bleed `aspect-card 4:3` thumbnail
  on top, 12 padding meta block below.
- **List card** — 12 padding, horizontal flex with avatar/thumb on the
  left and meta on the right.

**What to avoid.**
- Card inflation: don't wrap a list row in a card. Tables stay tables.
- Decorative gradient backgrounds, glow, glassmorphism.
- Pill buttons, large radii, neon accent ramps.
- Multiple visual styles on one screen — Stat / Asset / List card is
  enough.
- Purple-tinted "AI SaaS" chrome.
- Marketing-site energy: hero illustrations, scroll-triggered animations,
  decorative dot grids.

---

## 4 · Iconography

The source codebase uses **Lucide** (via `lucide-react`) — line icons, 1.5
stroke, square 24×24 viewBox. No icon font, no sprite sheet, no PNG icons.

**Sizing.** 16×16 in nav rows and inline meta; 20×20 in toolbars; 24×24 in
empty-state icon boxes (with a 40×40 `tone-soft` rounded container behind
them). Stroke width stays `1.5` at every size.

**Color.** Icons inherit `currentColor`. In `NavItem` they use
`text-ink-2` inactive and `text-orange` active. In `Btn` they use
`text-current`.

**Custom SVG.** Used sparingly:
- Small chevrons in chips and dropdowns (hand-rolled inline `<svg>`).
- The Kivasy custom-K mark (see brand mark, below).
- `ehPulse` keyframe pulse dot for queued/running job rows.

**Emoji / unicode.** Forbidden as icons. Don't substitute "✨" for a
sparkle, don't use "→" for chevrons, don't use "•" for status dots — use a
real Lucide icon or a Status Badge.

**Brand mark.** The product mark is the **custom-K SVG** defined in
`ui_kits/kivasy/v4/base.jsx` → `KivasyMark` (40×40 viewBox, 3-stop coral
gradient `#F58450 → #E85D25 → #C9491A`, vertical bar + chevron leg +
small signature dot at 29.8/29). The wordmark is **Kivasy** set in Clash
Display 600 with `letter-spacing: -0.045em` followed by an orange period —
defined in the same file as `KivasyWord`. Do not vary either; do not use
the older "Ki" two-letter typographic mark — it is deprecated.

**Substitution flagged — icons.**
This design system **CDN-loads Lucide** rather than copying the SVG set
into `assets/`. If you'd prefer the icons vendored into the project (so it
works fully offline), download the Lucide set into `assets/icons/`. The
codebase already depends on `lucide-react`, so this is a 1:1 swap — same
glyphs, same names.

**Substitution flagged — fonts.**
General Sans, Clash Display, and Geist Mono are loaded from Fontshare /
Google Fonts CDNs. All three are open-source; if you need the project to
be fully offline, drop the woff2 files in `fonts/` and adjust the
`@import` in `ui_kits/kivasy/v4/tokens.css` to a local `@font-face`
block.

---

## 5 · Visual Foundations cheat sheet (TL;DR)

| Token | Value | Use |
|---|---|---|
| `--k-orange` | `#E85D25` | Primary CTA, active nav rail, focus ring |
| `--k-orange-soft` | `#FBEADF` | Selected list row, chip bg |
| `--k-bg` | `#FAFAF7` | App canvas |
| `--k-paper` | `#FFFFFF` | Card, dialog, popover |
| `--k-bg-2` | `#F3F2EC` | Sidebar, toolbar band |
| `--k-ink` | `#1A1715` | Headings, body |
| `--k-ink-2` / `--k-ink-3` | muted / subtle | Meta, secondary copy |
| `--k-line` | `#E7E5DF` | Default 1px border |
| Radius | `4 / 6 / 10` | Chip / button / dialog |
| Sidebar w | `232px` | Persistent left rail |
| Topbar h | `56px` | Page header bar |
| Display | Clash Display | Page H1, stat numerals |
| Sans | General Sans | Body / UI |
| Mono | Geist Mono | Meta labels, badges, codes |

---

## 6 · Caveats / asks for the user

- **Fonts CDN-loaded.** General Sans + Clash Display from Fontshare;
  Geist Mono from Google Fonts. Send self-hosted woff2 files if you need
  offline rendering.
- **Lucide CDN-loaded.** Same story for icons — vendored set on request.
- **Stage CTA color language** (orange = create, purple = edit, blue =
  publish) is canonical across v4–v6; confirm before extending it to any
  new surface.
- **Source UI strings are Turkish** in places — the design system is
  copy-neutral, sample screens use English.
- **Assets folder still contains older `Ki` placeholder SVGs**
  (`assets/kivasy-mark.svg`, `assets/kivasy-wordmark.svg`). The canonical
  brand mark is the custom-K SVG inlined in `v4/base.jsx`; the older
  files are kept for git-history compatibility but should not be used
  on any rendered surface.
