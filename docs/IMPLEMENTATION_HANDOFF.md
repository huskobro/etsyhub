# Kivasy — Implementation Handoff

> Single reference for the implementation phase. The design phase is closed;
> everything below is what implementation needs to know without re-reading
> 6+ design briefs.

**Source of truth folder:** `docs/design-system/kivasy/`
**Branch this lands on:** `claude/epic-agnesi-7a424b`
**Status:** Implementation **R1 → R11.5 complete** (2026-05-09). MVP omurgası
canlı; production build PASSING; %99.4 test pass. MVP Final Acceptance gate
operatör onayını bekliyor. Acceptance source of truth:
[`docs/MVP_ACCEPTANCE.md`](MVP_ACCEPTANCE.md).

---

## 1. Brand & scope (locked)

### Brand
- Public-facing product name: **Kivasy**.
- Repo slug `EtsyHub` is git-history compatibility only — **never** as a brand
  name on any rendered surface, label, copy, or docstring.
- Canonical brand mark: custom-K SVG (vertical bar + chevron leg with cut +
  signature dot, 3-stop coral gradient #F58450 / #E85D25 / #C9491A).
  Reference implementation: `docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx → KivasyMark`.
  Standalone files: `docs/design-system/kivasy/assets/kivasy-mark.svg` and
  `kivasy-wordmark.svg` are byte-canonical copies.
- Wordmark: "Kivasy" set in Clash Display 600, `letter-spacing: -0.045em`,
  followed by an orange period (`.` in `--k-orange`). Reference: `KivasyWord`
  in the same base.jsx.
- Deprecated and forbidden: the "Ki" Inter typographic placeholder, any
  Inter or IBM Plex Mono reference, any `colors_and_type.css` import. These
  were removed during housekeeping; do not reintroduce them.

### Product scope (digital-only, not POD)
This product is a digital-downloadable production line for Etsy sellers.

**In scope:**
- Clipart bundles, wall art, bookmarks, stickers / printables, generic
  digital-download packages
- File reality: **ZIP / PNG / PDF / JPG / JPEG** (Settings → Workspace
  defaults; A5 Listing tab checklist; B5 Add Reference upload formats)

**Out of scope, hard line:**
- No physical print partner, no fulfillment, no shipping, no carrier
- No garment / apparel POD (t-shirt, hoodie, mug, DTF, sweatshirt, tank top)
- No made-to-order
- No "Hub" or "EtsyHub" in user-facing copy

If a screen, schema field, or implementation decision drifts toward any of
the out-of-scope categories, stop and re-read this section.

---

## 2. Token & primitive sources

### Tokens — single source of truth
`docs/design-system/kivasy/ui_kits/kivasy/v4/tokens.css`

This file is the only canonical token source. Implementation should:
1. Port these CSS variables into `src/app/globals.css` under the existing
   `@layer base` (or equivalent) so Tailwind's `hsl(var(--color-*) /
   <alpha-value>)` opacity system keeps working.
2. Bind them in `tailwind.config.ts` exactly as v4/tokens.css names them.
   Do not invent shorter names; the `--k-*` prefix is intentional.

**Token surface:**
- 4 surface stops: `--k-bg` `--k-paper` `--k-bg-2` (and lines: `--k-line`
  `--k-line-strong` `--k-line-soft`)
- 4 ink stops: `--k-ink` `--k-ink-2` `--k-ink-3` `--k-ink-4`
- 3 stage colors: orange / blue / purple (each with `-deep`, `-bright`,
  `-soft`, `-ink` modifiers)
- 4 status colors: green / amber / red / blue (each with `-soft`)
- Type stack: Clash Display (display) / General Sans (body) / Geist Mono
  (meta + tabular numerals)
- Radii: 5 / 8 / 14 / 20
- Easing: `--k-ease`, `--k-ease-out-quint`

### Primitives — reference implementation
`docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx`

This is a React+Babel reference, not the production component layer. When
porting to `src/components/ui/`, keep the same primitive surface:
`Btn`, `IconBtn`, `Badge`, `Chip`, `Checkbox`, `Kbd`, `Sidebar`, `Topbar`,
`Tabs`, `SiblingTabs`, `Density`, `FloatingBulk`, `Modal`, `KivasyMark`,
`KivasyWord`. Don't fork them, don't rename them, don't split them further.

The legacy primitives in `src/components/ui/` (Button, Card, Sidebar,
NavItem, PageShell, Input, Chip, Badge, Toolbar, Thumb, StateMessage)
mostly map 1:1 — implementation rollout-1 reconciles them to the v4
surface, deletes the rest.

---

## 3. Designed surfaces (waves)

| Wave | Files | Surfaces |
|---|---|---|
| **A — production spine** | `v4/screens-a1-a2.jsx`, `screens-a3-a4.jsx`, `screens-a5.jsx`, `screens-a6-a7.jsx` | A1 Library · A2 Batches index · A3 Batch detail (4 tabs) · A4 Batch Review (dark workspace, keyboard-first) · A5 Product detail (4 tabs incl. Listing checklist) · A6 Create Variations modal · A7 Apply Mockups modal |
| **B — sourcing / curation / output** | `v5/screens-b1.jsx`, `screens-b2-b3.jsx`, `screens-b4.jsx`, `screens-b5-b6.jsx` | B1 References (5 sub-views: Pool / Stories / Inbox / Shops / Collections) · B2 Selections index · B3 Selection detail (4 tabs) · B4 Products index · B5 Add Reference modal · B6 Generate Listing modal · B6+ post-generation handoff state |
| **C — system layer** | `v6/screens-c1.jsx`, `screens-c2.jsx`, `screens-c3.jsx` | C1 Templates (4 sub-types: Prompts / Style Presets / Mockups / Recipes) · C2 Settings (detail-list pattern, General + Etsy panes live, others stubbed) · C3 Overview rework (4 blocks: pipeline pulse / pending actions / active batches / recent activity) |
| **D — mini completion** | `v7/screens-d.jsx` | D1 Settings → AI Providers pane (provider × task-type matrix) · D2a A6 Prompt Preview collapsed · D2b A6 Prompt Preview expanded + edited |

**Live entry points** (open in browser, navigate via picker):
- `Kivasy UI Kit v4.html` — A1-A7
- `Kivasy UI Kit v5.html` — B1-B6+
- `Kivasy UI Kit v6.html` — C1-C3
- `Kivasy UI Kit v7.html` — D1-D2

Direction-history checkpoints (read-only reference):
`Kivasy UI Kit v3.html`, `v3.1.html`, `v2.html`. Don't modify these.

---

## 4. Information architecture (locked)

```
PRODUCE                        SYSTEM
  Overview                       Templates
  References                     Settings
  Batches
  Library
  Selections
  Products
```

**Eight items, two groups, closed list.** No new top-level surfaces.
Admin scope is a small footer badge — not a separate sidebar.

Sub-views live inside their parent:
- References → Pool / Stories / Inbox / Shops / Collections
- Templates → Prompt / Style Preset / Mockup / Recipe (4 sub-types)
- Settings → 10 left-rail panes in 3 groups (Preferences / Connections /
  Governance)

Production chain (one-directional, every arrow = single primary CTA,
usually opening a split modal):

```
Reference → Batch → Library → Selection → Product → Etsy Draft
```

---

## 5. Boundary invariants (must survive implementation)

The four core surfaces are **not synonyms**. If implementation blurs them,
the product breaks.

| Surface | Tagline | Holds | Does NOT hold |
|---|---|---|---|
| **References** | Inputs and inspirations | Pool, Stories feed, Inbox bookmarks, Shop analyses, Collections | Generated outputs |
| **Library** | Every produced asset, raw, filterable | Variation outputs, user uploads, lineage breadcrumbs, kept/rejected filters | Set / curation management |
| **Selections** | Curated sets — mockup-ready | Operator-named sets, edits (bg remove / color edit / crop / upscale), ordering | Mockups, listings |
| **Products** | Output package: mockuped + listing-drafted + Etsy-bound | Lifestyle mockups, bundle previews, listing metadata, digital files, Etsy draft history | Generation, raw curation |
| **Batches** | Generation runs + review workflows | Variation jobs, items, Review tab, parameters, logs, costs | Long-term asset archive |

**State flow (never reverse):**

```
Reference  ─[create variations]─▶  Batch  ─[items succeed]─▶  Library asset
Library asset  ─[add to selection]─▶  Selection set
Selection set  ─[apply mockups]──────▶  Product
Product  ─[generate listing + send]──▶  Etsy draft
```

If a code path tries to write backward in this chain, it's wrong.

---

## 6. Mockup model (3 types, sibling tabs)

Mockup is **three things**, not one. The Apply Mockups modal (A7) shows
all three as sibling tabs; Products → Mockups tab groups them as three
sections; My Templates is persisted under Templates → Mockup Templates,
not as a separate top-level surface.

1. **Lifestyle mockups** — context shots (wall art on a wall, clipart on
   a desk, bookmark in a book, sticker on a laptop)
2. **Bundle preview sheets** — multi-design composites ("All 25 designs
   included", 3-print set composite, sticker sheet layout, 5-bookmark
   composite)
3. **My templates** — operator-uploaded PSD/template files with smart
   objects, persisted in Templates and reusable across Products

Schema-wise: `MockupTemplate.kind: LIFESTYLE | PREVIEW_SHEET | USER_TEMPLATE`.
Verify this enum exists in Prisma; if not, add it as part of rollout-5
(Products) or earlier as schema groundwork.

---

## 7. Manual generation / Midjourney decision

**No separate Midjourney or manual-generation top-level surface.** The
manual-generation flow is fully represented across existing surfaces:

- **C1 Templates → Prompt Templates** — configure prompts
- **A2 Batches → Start Batch CTA** — kick off a run
- **A6 Create Variations** modal — parameters, similarity, count, prompt
  template select, `--sref` / `--oref` / `--cref` toggles, **D2 prompt
  preview** for power-user override
- **A3 Batch detail → Parameters tab** — audit trail of what ran
- **A4 Batch Review → Re-roll shortcut (R)** — in-flight regen
- **CSV/TSV bulk import** — implementation can land this either as an
  A6 4th tab (URL / Upload / Bookmark / **CSV**) or as an A2 secondary
  CTA. This is an implementation choice, not a design gap.

The legacy `/admin/midjourney/*` routes do not return as top-level. They
become redirects to the new structure (rollout-1).

---

## 8. Out-of-scope panes — implementation-time fill

These Settings panes were intentionally left as left-rail entries with
"Wave D" stub content. They do **not** require a fresh design pass —
they compose from existing patterns:

| Pane | Compose from |
|---|---|
| Workspace | A5 file-types checklist + B5 product type chips + B1 toggle row |
| Editor | A4 shortcut legend + Density toggle + number input |
| Notifications | C3 Block 4 status badges + ToggleRow + time-range |
| Storage | C2 Etsy connection card shell, swap field set |
| Scrapers | C2 Etsy connection card shell, repeated per provider |
| Theme | preview/colors-* swatches inside C2 detail-list pane |
| Users | B4 row pattern + role badges |
| Audit | A5/B3 timeline + filter chips + diff slide-in detail panel |
| Feature Flags | ToggleRow + progress bar (rollout %) + chip targeting |

When implementation reaches these, drop in 1-2 hours each. No new tokens,
no new primitives, no design re-litigation.

---

## 9. Cleanup notes carried into implementation

| ID | Item | When |
|---|---|---|
| **CN-1** | A1 Library toolbar's two ambiguous grid/list IconBtns. Density toggle already covers layout density. **Recommendation:** remove unless a Table-view feature is confirmed (deferred). | At Library implementation (rollout-2) |
| **CN-2** | A4 Batch Review `?` shortcut help has no behavior. Wire `?` (and the legend label) to a `modal-md` reference card. | At Batch Review implementation (rollout-3) |
| **CN-3** | Brand mark canonical decision was custom-K SVG. **Already resolved** in this commit; verify implementation keeps it. | Verify across favicon, OG image, app/icon.svg |

---

## 10. Recommended implementation rollout sequence

The design system is built; implementation is sequencing only.

### Rollout 1 — Tokens + shell
**Status:** ✓ Completed (commit `73d13f2…` and follow-up). Token re-bind +
font stack alignment finalised in R3.5 cleanup pass.
- Port `v4/tokens.css` → `src/app/globals.css` + `tailwind.config.ts`
  bindings
- Port `v4/base.jsx` primitives → `src/components/ui/*`; reconcile or
  delete legacy duplicates
- Replace `src/features/app-shell/Sidebar.tsx` with the v4 sidebar (8
  items, 2 groups, custom-K mark, footer admin badge)
- Replace `src/components/ui/PageShell.tsx` topbar with v4 Topbar (back
  arrow + status badge support)
- Add persistent floating Active Tasks panel scaffolding (data wiring
  in rollout-3)
- Route redirects: `/admin/midjourney/library` → `/library`,
  `/admin/midjourney/batches` → `/batches`,
  `/admin/midjourney/kept` → `/selections` (filter view),
  `/admin/midjourney/templates` → `/templates`,
  `/admin/midjourney/preferences` → `/settings`,
  `/dashboard` → `/overview`, `/listings` → `/products`,
  `/listings/draft/[id]` → `/products/[id]`

### Rollout 2 — Library
**Status:** ✓ Completed. Library surface live at `/library` with virtualized
grid, density toggle, filter chips, slide-in detail panel, bulk-select
floating action bar.
- New route `/library` rendering the A1 surface
- Virtualized grid (`@tanstack/react-virtual`)
- Density toggle (Comfortable / Dense), filter chips, saved-view chips
- Right slide-in detail panel with lineage breadcrumb
- Floating bulk-action bar at 2+ selection
- Apply CN-1 cleanup at this point
- Mobile counterpart (browse-only acceptable)

### Rollout 3 — Batches index + detail + Review
**Status:** ✓ Completed. `/batches`, `/batches/[id]` (Overview/Items/Logs/
Costs), `/batches/[id]/review` (dark workspace + keyboard handler + ? help
modal). A6 Create Variations + D2 Prompt Preview live. Active Tasks panel
data-wired to `listRecentBatches`.
- New routes `/batches`, `/batches/[id]`
- Tabs in detail: Items / Parameters / Logs / Costs (Review = dedicated
  full-screen workspace)
- Apply CN-2: `?` modal for shortcut help
- Wire Active Tasks panel data feed (unified active-job stream endpoint
  required — backend dependency)
- A6 Create Variations modal (with D2 Prompt Preview extension)

### Rollout 3.5 — Visual parity cleanup (housekeeping pass)
**Status:** ✓ Completed (this commit). Token re-bind: legacy `--color-*`
HSL tuples reset to Kivasy v4 hex equivalents; `--layout-sidebar-width`
232→248; Tailwind `font-sans`/`mono`/`display` resolve to Kivasy stack;
`.k-btn` family + `.k-card--hero` + `.k-sidebar` recipes ported into
globals.css; 4 primary CTAs (Start Batch / Open Review / Add to Selection /
Create Variations) switched to `k-btn k-btn--primary` className. Stale
docs/design/EtsyHub.zip removed; HISTORY.md badge added. README +
IMPLEMENTATION_HANDOFF + design-system READMEs + CLAUDE.md synced with
rollout progress and source-of-truth links.

### Rollout 4 — Selections index + detail
**Status:** ✓ Completed (commit `87a9737`). `/selections` (B2 stage-aware
CTAs) + `/selections/[setId]` (B3 4-tab: Designs/Edits/Mockups/History) +
edit modals (background remove / color edit / crop / upscale / magic
eraser) live. Library handoff wired.

### Rollout 5 — Products index + detail
**Status:** ✓ Completed (commit `2211c05`, parity polish in `a982db8`).
`/products` (B4) + `/products/[id]` (A5 4-tab: Mockups/Listing/Files/
History) live. A7 Apply Mockups modal (3 sibling tabs: Lifestyle / Bundle
preview / My templates) live. A5 Listing tab digital-file-types checklist
(ZIP / PNG / PDF / JPG / JPEG); no physical fields. `MockupTemplate.kind`
enum (LIFESTYLE | PREVIEW_SHEET | USER_TEMPLATE) in Prisma. B6 Generate
Listing modal + post-generation handoff state live. Etsy draft push via
existing `/api/etsy/oauth`.

### Rollout 6 — Templates family + Settings shell + AI Providers
**Status:** ✓ Completed (commit `fec3e9b`). `/templates` (C1, 4 sub-types
via `k-stabs`) + `/settings` (C2 left-rail detail list, 8 live + 4
deferred panes) + D1 AI Providers pane (provider × task-type matrix)
shell live.

> **Note:** "References consolidation (B1 single surface)" originally
> planned as R6 has been **deferred to post-MVP**. Sub-view'lar (Pool /
> Stories / Inbox / Shops / Collections) bugün ayrı top-level route'larda
> (`/references`, `/trend-stories`, `/bookmarks`, `/competitors`,
> `/collections`); operatör için işlevsel, parity'i bozmayan bir compromise.

### Rollout 7 — Templates CRUD + Settings persistence
**Status:** ✓ Completed (commit `cead59f`). Template editor modals,
prompt versioning, style preset config, mockup template upload, recipe
chain CRUD all live. Settings panes (General / Workspace / Editor /
Notifications / Etsy / Storage / Scrapers) persist via UserSetting
key-scoped rows. AI Providers pane real backing — KIE/Gemini key
encrypt-at-rest, cost summary aggregation.

### Rollout 8 — Recipe runner + Mockup PSD upload + production wiring
**Status:** ✓ Completed (commit `3341db9`). Recipe runner backend +
modal; PSD smart-object detection on upload (Sharp-based suitability
report); Editor / Scrapers / Storage panes live with real persistence;
AI Providers finishing (admin task assignments + spend limits).

### Rollout 9 — Production wiring deepening
**Status:** ✓ Completed (commit `95fe0b6`). Recipe runner real start
(audit log + recipe history + inbox notification); PSD smart-object
binding flow; in-app notifications inbox v1 (recipe run, batch result,
mockup activation, magic eraser job done sinyalleri); enforcement layer
foundation (`assertWithinBudget` helper).

### Rollout 10 — Production call-path migration
**Status:** ✓ Completed (commit `e744e7b`). `assertWithinBudget`
enforcement live in variation + listing-copy call-paths (429 on limit
breach). `notifyUser` dispatch with preference filter. `resolveTtlForUser`
helper with 60s in-memory cache for signed URLs. Recipe runner deeper
(destination resolution + audit history endpoint).

### Rollout 11 — MVP final acceptance hardening
**Status:** ✓ Completed (commit `8d1b983`). Production build PASSING
(was failing in R10 due to lint/type errors); 26 new unit tests for
schema/discriminator logic; AI Providers UI copy synced to R10 reality;
Recipe runner explicit "Continue to destination" CTA (no more silent
redirect); notifications inbox 15s polling; mockup upload SuitabilityReport
component.

### Rollout 11.5 — Settings stabilization
**Status:** ✓ Completed (commit `c7c6564`). PaneAIProviders loading
watchdog (8s retry CTA); explicit `staleTime` + `retry` per query;
PaneNotifications inbox `retry: 1` + inline error retry CTA;
SettingsShell deferred-pane "R9" → "Soon"; PaneDeferred / PaneScrapers /
PaneStorage stale rollout copy → "post-MVP". Browser-verified across
4 routes; production build PASS.

### Rollouts deferred to post-MVP

What is intentionally NOT in MVP (operator sees these as "Soon" / "R12"
labels in UI; not release blockers):

- **References consolidation (B1 single-surface)** — sub-view'lar ayrı
  top-level route'larda kalır
- **Overview rework (C3 — pipeline pulse + pending actions + recent
  activity blocks)** — `/overview` minimal stub; bağlı route'lardaki
  veri yeterli
- **Recipe full chain orchestration** — şu an "Continue to destination"
  CTA; otomatik chain (batch+selection+mockup) post-MVP
- **R12 delivery backend** — desktop push + email digest delivery + SSE
  channel `notifications:user:{id}`
- **R12 provider integration** — OpenAI / Fal.ai / Replicate / Recraft
  persistence + wiring
- **Mockup binding wizard** — LOCAL_SHARP MockupTemplateBinding setup UI
- **Settings GOVERNANCE group panes** — Users / Audit / Feature Flags /
  Theme; legacy `/admin/*` route'lar fonksiyonel
- **Native shell (Tauri)** + **Watch folder** + **Trend Cluster
  Detection (semantic dedupe)** — design ready, post-MVP

Detaylı acceptance matrisi: [`docs/MVP_ACCEPTANCE.md`](MVP_ACCEPTANCE.md).

### Rollout discipline (carried from design phase)
Each rollout fully ships before the next begins. "Fully ships" means:
routes/redirects work, capabilities preserved (nothing dropped without a
replacement), mobile counterpart exists in browse mode, density toggle
functional where applicable, stage-aware CTA color language consistent,
Active Tasks panel surfaces relevant jobs, empty states defined.

If under deadline pressure a rollout cannot meet all completion items,
**shrink scope, don't lower the bar**.

---

## 11. Out-of-scope from implementation rollout (deferred)

- Native macOS / Windows shell (Tauri wrapper) — design is Tauri-feasible
  but no native app build in this rollout
- Mobile production parity (bulk review on phone) — browse-only is
  acceptable; "Better on desktop" hint where needed
- Watch folder (per CLAUDE.md) — design ready, implementation deferred
- Theme editor (Settings → Theme) — read-only preview only

---

## 12. Verification when each rollout completes

For every rollout, before merging:
- [ ] All `--k-*` token references resolve through globals.css
- [ ] No hardcoded hex remaining in surface code (the lint script
  `npm run check:tokens` already exists)
- [ ] Brand: only custom-K SVG, only "Kivasy" in copy, no "EtsyHub"
- [ ] Scope: no physical/POD/shipping/garment field appears in any
  form or surface
- [ ] Boundary: Library has no set CRUD; Selections has no mockup
  generation; Products has no variation generation
- [ ] One primary CTA per screen / modal, stage-colored correctly
- [ ] Mobile counterpart browse-mode functional
- [ ] Density toggle persistent on list/grid surfaces
- [ ] Tests added for the rollout's surfaces

---

## 13. Where the design phase ends

Design phase = closed at this commit. There is no Wave E. The remaining
panes (Workspace, Editor, Notifications, Storage, Scrapers, Theme,
Users, Audit, Feature Flags) are implementation-time work using existing
primitives and patterns documented in §8.

If a real design question surfaces during implementation that cannot be
answered by reading this doc + the v4-v7 source files, that's a signal
worth pausing on — note it, don't paper over it.
