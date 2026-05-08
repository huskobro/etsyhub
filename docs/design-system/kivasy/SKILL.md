# Kivasy Design System — Skill Manifest

> Cross-compatible with Claude Code, Agent Skills, and the OM design tab.

## What this is

Kivasy is an operator tool for Etsy sellers producing **digital downloadable
products** (references → AI variations → curation → mockups → listing prep
→ Etsy draft). This system is the **single source of truth** for its
visual + content language. Anything in `docs/design/EtsyHub/` or
`docs/plans/` of the source repo is historical and must be ignored.

The brand name is **Kivasy**. The repo slug `EtsyHub` is a git-history
compat name only and must never appear in product copy.

## When to invoke

Use this skill when the user asks for any of:

- A new screen, page, or modal for Kivasy
- Variations / mockups / explorations of Kivasy UI
- A design review of an existing Kivasy screen
- Marketing collateral that has to feel native to the product
- A component spec for handoff (Button, Card, Sidebar, Toolbar, etc.)

Do NOT invoke for: physical POD / apparel tools, generic AI-SaaS dashboards,
landing pages with marketing-site energy.

## How to use it

1. **Read `README.md`** end-to-end before designing. The file covers brand
   context, IA (locked at 8 nav items), content fundamentals, visual
   foundations, and iconography. Follow the rules verbatim — every visual
   choice is downstream of one of them.
2. **Pull tokens from `ui_kits/kivasy/v4/tokens.css`.** This is the single
   token source of truth. Do not invent colors, spacing, or radii. The
   token names (`--k-orange`, `--k-bg`, `--k-line`, `--space-*`,
   `--radius-*`, `--k-font-display`, `--k-font-sans`, `--k-font-mono`,
   etc.) are stable across v4 / v5 / v6.
3. **Recreate primitives from `ui_kits/kivasy/v4/base.jsx`.** This file
   covers the inline icon set, `KivasyMark`, `KivasyWord`, `Btn`,
   `IconBtn`, `Sidebar`, `Topbar`, `Badge`, `Checkbox`, `SiblingTabs`,
   etc. Per-wave screens build on top: `v4/screens-*.jsx` (A1–A7),
   `v5/screens-*.jsx` (B1–B6), `v6/screens-*.jsx` (C1–C3). Copy the
   files you need rather than rewriting from scratch.
4. **Look at the previews under `preview/`** for an at-a-glance reference
   on color, type, spacing, and component variants. Each card links the
   shared `v4/tokens.css`.

## Surface map

```
v4 — Wave A · production spine
   A1 Library            A2 Batches index       A3 Batch detail
   A4 Review workspace   A5 Product detail      A6 Create variations
   A7 Apply mockups
   Entry: ui_kits/kivasy/Kivasy UI Kit v4.html

v5 — Wave B · sourcing / curation / output
   B1 References         B2 Selections index    B3 Selection detail
   B4 Products index     B5 Add reference       B6 Generate listing
   Entry: ui_kits/kivasy/Kivasy UI Kit v5.html

v6 — Wave C · system layer
   C1 Templates          C2 Settings            C3 Overview rework
   Entry: ui_kits/kivasy/Kivasy UI Kit v6.html
```

The three entry points are intentionally separate — each marks a wave
boundary; do not merge. v3 / v3.1 are kept as direction-history references
only.

## Hard rules (do not negotiate)

- **Information architecture is closed.** Two groups (Produce, System),
  eight items. No new top-level surfaces. Sub-flows live as split-modals
  inside their parent, not new pages.
- **One primary CTA per page**, top-right. One per modal.
- **No emoji** in UI, copy, empty states, or icons. Lucide line icons only.
- **No gradients** on surfaces. No glass, glow, hero illustrations.
- **No card inflation.** Tables stay tables; don't wrap a list row in a
  card. Three card recipes only: Stat / Asset / List.
- **No pill buttons.** Radii are `4 / 6 / 10` only.
- **No uppercase labels.** Mono meta uses Title Case + 0.6px tracking.
- **No bouncy springs.** Two durations: `120ms` (state), `180ms`
  (transforms). Single ease: `cubic-bezier(.2, .7, .3, 1)`.
- **No hover-scale on cards.** Card box never grows. Only thumbnails
  scale (`1.015`). Hover changes border + shadow.
- **Voice is operator-direct.** Sentence case, imperative verbs, no
  marketing energy. "Send to Etsy as Draft" — never "Publish".
- **Brand mark is the custom-K SVG only.** Do not use the deprecated
  two-letter "Ki" typographic mark on any product surface.

## Output checklist

Before delivering a Kivasy design, verify:

- [ ] Sidebar at 232w, `--k-bg-2` band, 1px right border, 8 items max.
- [ ] Topbar at 56h, 1px bottom border, single primary CTA top-right.
- [ ] All accent uses are CTA / active nav / selected row / focus ring.
- [ ] Stage CTA color language honoured (orange create / purple edit /
      blue publish).
- [ ] Mono is used **only** for meta layer (labels, badges, codes).
- [ ] Status conveyed via `tone-soft` Badge — never full-tile fills.
- [ ] Active Tasks panel anchored bottom-right.
- [ ] Density toggle considered (Comfortable / Compact / Dense).
- [ ] `data-density="user"` on user pages, `"admin"` on admin pages.
- [ ] No emoji, no decorative gradients, no glassmorphism.
- [ ] Copy is sentence-case, imperative, operator-direct.
- [ ] Brand mark is the custom-K SVG (`KivasyMark` from `v4/base.jsx`),
      paired with the Clash Display wordmark and orange period.

## Substitution flags

These were CDN-loaded for portability; vendor them locally if the project
must work offline:

- **General Sans + Clash Display + Geist Mono** — currently `@import` from
  Fontshare / Google Fonts. Drop self-hosted `.woff2` files in `fonts/`
  and switch to `@font-face` in `v4/tokens.css`.
- **Lucide icons** — currently inline SVG path data in `v4/base.jsx`; the
  production codebase uses `lucide-react`. For full parity, install
  `lucide-react` and import named icons.
- **Stage CTA color language** is canonical across v4–v6; confirm with
  the user before applying it to any new surface outside the existing
  spine.

## File map

```
README.md                           Brand + content + visual foundations
SKILL.md                            This file
assets/                             Brand mark + sample imagery
preview/                            At-a-glance preview cards
ui_kits/kivasy/
  v4/tokens.css                     Single token source of truth
  v4/base.jsx                       Icons, KivasyMark/Word, Sidebar, Topbar, Btn, …
  v4/screens-*.jsx                  A1–A7 (Library / Batches / Review / Product / …)
  v5/screens-*.jsx                  B1–B6 (References / Selections / Products / …)
  v6/screens-*.jsx                  C1–C3 (Templates / Settings / Overview)
  Kivasy UI Kit v4.html             Wave-A entry
  Kivasy UI Kit v5.html             Wave-B entry
  Kivasy UI Kit v6.html             Wave-C entry
  Kivasy UI Kit v3.html / v3.1.html Direction-history checkpoints
```
