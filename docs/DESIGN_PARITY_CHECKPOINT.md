# Kivasy Design Parity Checkpoint

Applied at the **end of every rollout**, before sign-off.

> "It works" is necessary but not sufficient. A rollout is not accepted
> until the visual parity rules below pass.

Design source of truth: [`docs/design-system/kivasy/`](design-system/kivasy/)
(specifically `ui_kits/kivasy/v4.html`, `v5.html`, `v6.html`, `v7.html`).
Implementation handoff: [`IMPLEMENTATION_HANDOFF.md`](IMPLEMENTATION_HANDOFF.md).

---

## A · Token & utility bindings (automated; run on `/library`)

Open `localhost:3000/library` in dev (logged in). In DevTools console:

```js
const cs = getComputedStyle(document.documentElement);
const body = getComputedStyle(document.body).backgroundColor;
const sansEl = document.querySelector('p, span, div'); // any wrapped text
const sans = getComputedStyle(sansEl).fontFamily;
const sidebar = document.querySelector('aside[role="navigation"]');
({
  body_is_warm_paper: body === "rgb(247, 245, 239)",     // --k-bg #F7F5EF
  sans_is_general:    sans.includes("General Sans"),
  sans_no_inter:      !sans.includes("Inter"),
  font_display_works: !!cs.getPropertyValue("--font-display").trim(),
  sidebar_w_248:      cs.getPropertyValue("--layout-sidebar-width").trim() === "248px",
  sidebar_has_grad:   getComputedStyle(sidebar).backgroundImage !== "none",
});
```

Required: every key returns `true` (or `"248px"` for sidebar_w_248).

```js
// Recipes
({
  k_btn_primary_defined: !!Array.from(document.styleSheets).flatMap(s => {
    try { return [...s.cssRules]; } catch { return []; }
  }).find(r => r.selectorText === ".k-btn--primary"),
  k_card_hero_defined:   !!Array.from(document.styleSheets).flatMap(s => {
    try { return [...s.cssRules]; } catch { return []; }
  }).find(r => r.selectorText === ".k-card--hero"),
  k_sidebar_defined:     !!Array.from(document.styleSheets).flatMap(s => {
    try { return [...s.cssRules]; } catch { return []; }
  }).find(r => r.selectorText === ".k-sidebar"),
});
```

---

## B · Per-surface checklist (run for EVERY new route the rollout adds)

For each new route:

- [ ] **H1 family** computed === `'"Clash Display"…'` (NOT Inter, NOT
      IBM Plex Mono).
- [ ] **Mono caption family** computed === `'"Geist Mono"…'`.
- [ ] **Sidebar bg** computed `backgroundImage` !== `"none"` (gradient).
- [ ] **Active nav** has 2px orange left rail (visible `<span>` or
      `::before` pseudo at left edge of active item).
- [ ] **Primary CTA** uses `k-btn k-btn--primary` className —
      `backgroundImage` starts with `"linear-gradient"`.
- [ ] **Brand**: KivasyMark SVG visible in sidebar lockup (NOT "Ki" text).
- [ ] **No legacy class drift in NEW code**: `bg-surface-2`, `bg-bg`,
      `text-text` allowed only in untouched legacy components; new
      components use `bg-k-bg-2`, `bg-paper`, `text-ink`, `border-line`.
- [ ] **Türkçe locale uppercase**: mono-caps captions render as `ITEMS`
      (NOT `İTEMS`). The CSS fix in globals.css `.font-mono.uppercase`
      handles most cases via `-webkit-locale: "en"`; if any caption
      still renders dotted-İ, wrap it in `<span lang="en">…</span>` or
      use literal CAPS text.

---

## C · Reference comparison (manual — at least 1 surface per rollout)

For at least ONE primary route in the rollout:

1. Open dev: `localhost:3000/<route>` at 1440×900.
2. Open the corresponding design reference HTML:
   ```bash
   open "docs/design-system/kivasy/ui_kits/kivasy/Kivasy UI Kit v4.html"
   open "docs/design-system/kivasy/ui_kits/kivasy/Kivasy UI Kit v5.html"
   ```
   Use the picker bar at the bottom to navigate to the matching surface
   (e.g. v4 picker → A2 Batches, A3 Batch detail, A4 Review, etc.).
3. Take screenshots of both at the same viewport.
4. Embed both in the rollout-final report.
5. Note deltas. Classify each as A/B/C:
   - **A · Acceptable transition** — minor token / spacing diff that
     drifts the system but doesn't block release.
   - **B · Real visual deviation** — gradient missing, font wrong,
     surface flat where spec says lifted. Must be fixed before next
     rollout.
   - **C · Blocking parity gap** — must close BEFORE the rollout signs
     off.

If any C-class delta exists: the rollout is **not accepted**. Fix and
re-run the checkpoint.

---

## D · Token-leak audit (automated, run from repo root)

```bash
# No --color-* HSL legacy reference in NEW components written in this
# rollout. (Legacy components are exempt; they're updated incrementally.)
git diff --name-only HEAD~N HEAD -- 'src/**/*.tsx' 'src/**/*.ts' \
  | xargs grep -nE '(--color-|--font-inter|--font-plex-mono)' || echo "✓ no legacy leak"

# Token check passes
npm run check:tokens

# Lint passes for the rollout's new files
npm run lint

# Typecheck passes
npm run typecheck | grep -v "mj-bridge"   # mj-bridge errors are pre-existing
```

---

## Surface ↔ Wave mapping

When checking a route in C, use the design reference matching its wave:

| Live route | Wave | Reference (open this HTML) |
|---|---|---|
| `/overview` | C3 | `v6.html` → C3 picker entry |
| `/library` | A1 | `v4.html` → A1 picker entry |
| `/batches` | A2 | `v4.html` → A2 picker entry |
| `/batches/[id]` | A3 | `v4.html` → A3 picker entry (4 tabs) |
| `/batches/[id]/review` | A4 | `v4.html` → A4 picker entry (dark workspace) |
| `/selections` | B2 | `v5.html` → B2 picker entry |
| `/selections/[id]` | B3 | `v5.html` → B3 picker entry (4 tabs) |
| `/products` | B4 | `v5.html` → B4 picker entry |
| `/products/[id]` | A5 | `v4.html` → A5 picker entry (4 tabs) |
| `/references` | B1 | `v5.html` → B1 picker entry (5 sub-views) |
| `/templates` | C1 | `v6.html` → C1 picker entry (4 sub-types) |
| `/settings` | C2 | `v6.html` → C2 picker entry (detail-list) |
| A6 Create Variations modal | A6 | `v4.html` → A6 + `v7.html` → D2 prompt preview |
| A7 Apply Mockups modal | A7 | `v4.html` → A7 picker entry |
| B5 Add Reference modal | B5 | `v5.html` → B5 picker entry |
| B6 Generate Listing modal | B6 | `v5.html` → B6 picker entry |
| Settings AI Providers pane | D1 | `v7.html` → D1 picker entry |

---

## Sign-off rule

A rollout is **not accepted** until:

1. All A items pass.
2. All B items pass for **every** new route the rollout adds.
3. At least one route has been screenshot-compared in C.
4. D token-leak audit reports 0 leaks in NEW components.
5. `npm run check:tokens`, `npm run lint`, `npm run typecheck` pass.

Note in the rollout-final report: which route was C-compared, what A/B/C
deltas remained (if any), and rationale for any A-class acceptance.
