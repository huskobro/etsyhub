# Kivasy — Claude Design Handoff Brief

> **Kullanım:** Aşağıdaki blok, Claude Design'a (veya başka bir tasarım
> ajanına / işbirlikçisine) **olduğu gibi yapıştırılabilir**. Tek-parça,
> kopyala-yapıştır hazır. Repo bağlamı için `docs/CLAUDE_DESIGN_CONTEXT.md`
> ile birlikte verilir.

---

```markdown
# Kivasy — Final Product Design Brief

You are designing the next coherent product shape for Kivasy.

This is not a greenfield app. The core capabilities already exist in code.
What is missing is a clean information architecture, stronger visual
hierarchy, and a more premium, calmer, easier-to-operate interface.

Your job is to design the **whole product**, not a single module.

Before reading on: this brief is a constraint document, not inspiration.
Treat each section as load-bearing. Reference sections by number when you
justify decisions in your output.

> Note on naming. The public-facing product name is **Kivasy**. The repo
> slug is `EtsyHub` for git-history compatibility — that is not the brand.
> Use **Kivasy** in every screen, label, and document you produce.

---

## 1. Product Summary

Kivasy is an operator tool for Etsy sellers producing **digital
downloadable products** end-to-end.

It helps users:
- collect and organize references
- generate AI design variations
- review and curate outputs
- build selection sets
- apply mockups and preview sheets
- prepare listing content
- send Etsy draft listings

This is a **production system**, not a casual creator toy.

The user is an **operator**:
- sometimes working on 1 small batch with a few assets
- sometimes working across 10+ batches and 200+ assets

The product should feel like **one production operating system**, not a
set of disconnected tools.

---

## 2. Scope — This Product Is for Digital Goods

The product is for **digital downloadable products**, especially:

- Clipart bundles
- Wall art (sold as digital files — canvas, framed, poster)
- Bookmarks (digital downloadable bookmark designs)
- Stickers / printables (sticker sheets, transparent PNG sets)
- Generic digital download packages

**Digital delivery formats** (what the buyer downloads):
- ZIP (bundle)
- PNG (transparent or raster)
- PDF (printable, sheet)
- JPG / JPEG (raster)

The Listing Builder shows these formats as a checklist; per-file
resolution / dimensions are entered; "Instant download" is marked.

This product is **not**:
- a physical print-on-demand fulfillment tool
- a print-partner workflow
- a shipping / logistics interface
- a garment POD tool (t-shirts, hoodies, mugs, DTF, etc.)
- a made-to-order workflow

Mockups still exist, but they support **digital listing presentation**,
not physical fulfillment.

If your designs drift toward fulfillment, shipping, print partners, or
apparel POD, that is the wrong direction.

---

## 3. User Behavior — Small Jobs and Big Jobs in the Same UI

The same interface must support both:

### Small jobs
- 1 batch
- a few references
- a few generated assets
- fast review and quick listing prep

### Large operations
- many batches
- hundreds of assets
- bulk review
- bulk selection
- multi-mockup workflows
- product packaging at scale

So the product should feel:
- lightweight and clear for small tasks
- powerful and dense for large tasks

Design for both.

---

## 4. Platform Requirements

Design with these platform realities in mind:

### Desktop web (today)
This is the primary working environment.

### Mobile web (today)
Important flows should still be usable on mobile.
Not every high-density operation needs full parity, but the product should
not collapse.
Mobile should support:
- browsing
- checking status
- small jobs
- lightweight decisions

### Native desktop app later (macOS / Windows)
The product may later become a native shell via Tauri.

So the app should be designed in a way that can later support:
- persistent sidebar
- multi-pane layouts
- split views
- floating task panel
- optional secondary windows for editing workspaces

Do not rely on patterns that only make sense as a browser page.

---

## 5. Current Product Reality

The backend and workflows are already strong.

Existing capabilities include:
- Midjourney-based generation (describe / generate / image-prompt
  API-first; sref / oref / ow / cref reference parameters)
- image-prompt flows
- batch generation
- retry-failed-only
- templates
- asset lineage
- asset library
- batch review
- kept / handoff flows
- selection workspace
- mockup / product downstream surfaces
- Etsy draft preparation (drafts only — no active publish)

So the problem is not "missing AI capability."
The problem is:
- fragmented IA
- too many disconnected surfaces
- inconsistent screen hierarchy
- weak product coherence

Tech stack: Next.js 14 App Router, TypeScript, Tailwind, CSS variables
already exist for tokens (see `tailwind.config.ts` and `globals.css`).
The repo enforces token-driven styling — no hardcoded colors / spacing.

---

## 6. Preferred Final Information Architecture

Preferred top-level navigation:

### PRODUCE
- Overview
- References
- Batches
- Library
- Selections
- Products

### SYSTEM
- Templates
- Settings

This is the preferred direction.

### Meaning of each top-level area

**Overview**
What needs attention now. Active work, pending actions, recent output.

**References**
The entry door of the pipeline and the consolidated home for
pre-production discovery.

It should unify multiple sub-views, including:
- Pool
- Stories
- Inbox
- Shops
- Collections

These are sub-views of References, not separate top-level surfaces.

You may organize them as tabs, left sub-navigation, segmented sections,
saved views, or another tighter pattern. Pick the cleanest container
that keeps References as one top-level area without forcing the operator
to juggle multiple top-level destinations.

**Batches**
Generation runs. Variation jobs, retries, progress, logs, and review.

**Library**
Single source of truth for all produced assets. Search, filters, lineage,
historical exploration.

**Selections**
Curated sets ready for next-stage work. Chosen, organized, edited, or
prepared groups of assets.

**Products**
Mockuped, preview-ready, listing-prepared digital products. This is where
listing packaging becomes concrete.

**Templates**
Prompt templates, style presets, mockup templates, product recipes.

**Settings**
Preferences, providers, users, audit, flags, theme, and operational
configuration.

There is **no separate admin sidebar**. Admin scope becomes a small
badge on the user footer; admin-only sections inside Settings and
Templates are revealed by role, not by nav.

---

## 7. Critical Boundaries Between Core Areas

These distinctions are extremely important.

### References
References contain **inputs and inspirations**.
This includes the curated pool, story-style trend feeds, bookmark inbox,
shop analysis views, and collections — all unified as sub-views inside
References.
References are not generated outputs.

### Library
Library contains **all produced assets**.
It is the place to:
- search
- filter
- browse
- inspect lineage
- find past outputs

It is **not** the place for curated set management.

### Selections
Selections contain **chosen and curated groups** of assets.
It is the place for:
- set organization
- ordering
- edit prep
- preparing for mockup application

It is **not** the place for all raw output discovery.

### Products
Products contain **packaged, presentation-ready, listing-prep-ready
outputs**.
It is the place for:
- lifestyle mockups
- bundle preview sheets
- digital file packaging (ZIP / PNG / PDF / JPG / JPEG)
- listing title / description / 13 tags
- Etsy draft preparation

It is **not** the place for generation or raw curation.

### Batches
Batches are **generation runs and review workflows**.
They are not the long-term asset archive.

---

## 8. Workflow Model

The product should reinforce this production chain clearly:

Reference → Batch → Library → Selection → Product → Etsy Draft

This chain should feel visible and intentional.

Each stage should present a clear "next step" action.

Where possible:
- long subflows should happen in split modals or focused workspaces
- the user should not feel like they are constantly being thrown into
  unrelated pages

---

## 9. Mockup and Preview Model

Mockup in this product is not one thing.

It should support **three modes**:

### 1. Lifestyle mockups
Used for listing presentation.
Examples:
- wall art in room scenes
- bookmark in context
- sticker on object
- clipart shown in styled use context

### 2. Bundle preview sheets
Used to show what the buyer receives.
Examples:
- "25 PNGs included"
- multi-piece wall art set preview
- sticker sheet preview
- bookmark set preview

### 3. User-uploaded custom templates
The user can bring their own templates into the system.
These live under the **Templates** top-level area, specifically as part
of the **Mockup Templates** sub-type, and become reusable across Products.

In the Apply Mockups flow, all three classes should appear as sibling
choices or tabs:
- Lifestyle mockups
- Preview sheets
- My templates

None of the three should become a separate top-level area, and "My
templates" should not feel like an afterthought.

---

## 10. Design Direction

The visual direction should be:

**premium, calm, modern, and operator-friendly**

Not flashy. Not decorative-first. Not generic AI SaaS purple-glow.

### Desired qualities
- a single warm orange / coral accent, used with restraint — primarily
  on primary CTAs, active nav states, and small accent moments
- bright, calm, airy surfaces
- strong spacing and hierarchy
- modern but restrained
- dense data screens that still feel breathable
- strong primary CTA language
- clean grids, tables, and split modals
- confident product shell

The accent should stay in a warm orange / coral family. Refine the exact
tone if needed, but do not drift into brown, muddy terracotta,
pink-heavy red, or yellow-heavy amber.

### Avoid
- card inflation
- decorative gradients everywhere
- noisy top bars
- over-ornamented SaaS chrome
- marketing-site energy
- too many visual styles on one screen

---

## 11. What to Take From the Reference Material

Take these ideas:
- warm premium orange / coral accent
- clear primary CTA per screen
- calm white / off-white working surfaces
- good split-modal workflow patterns
- modern tables and grid cards
- visible task / progress status
- strong workflow continuity from one stage to the next
- clear "next step" actions

Do not copy literally.
Translate them into a cleaner, more cohesive product.

---

## 12. What Not to Take

Do not bring over:
- fulfillment / shipping / print-partner UX
- garment POD patterns
- cluttered top-level nav
- overuse of badges and pills
- too many visible controls at once
- decorative gradient-heavy styling
- visual noise in headers and toolbars
- another tool's brand identity (the product is **Kivasy**)

Be more focused and more mature than the references.

---

## 13. Screen Families To Design

Define the product using a clear screen-family system.

### Dashboard pages
Example: Overview
Purpose: orientation, active work, next steps

### Library pages
Example: Library, References, Products index
Purpose: search, scan, filter, bulk operations

### Review / workspace pages
Example: Batch review, selection preparation
Purpose: focused decision-making and high-volume actions

### Detail pages
Example: Batch detail, selection detail, product detail
Purpose: context + tabs + next actions

### Split workflow modals
Example: create variations, apply mockups, add reference, aspect ratio,
crop
Purpose: keep the user in flow without deep page branching

### Mobile condensed variants
Each major screen family should have a compressed mobile interpretation.

### Desktop / native multi-pane variants
Some workspaces should be designable in a way that could later evolve
into multi-pane or multi-window native flows.

---

## 14. Key UX Principles

1. Structure first, paint second
2. One product, not many disconnected tools
3. One primary CTA per screen
4. Respect density and operator speed
5. Separate browse / curate / package clearly
6. Use split modals for subflows instead of page explosion
7. Keep the system usable at both low and high volume
8. Keep mobile and future native compatibility in mind

---

## 15. Expected Output

Please produce:

1. A refined final information architecture
2. Final navigation recommendation
3. Screen family system
4. A whole-app design direction
5. Clear differentiation between References / Batches / Library /
   Selections / Products
6. Mobile and future native compatibility guidance
7. High-volume workflow guidance
8. Reasoning about rollout priority, based on this intended rollout
   direction:
     Shell → Overview / Library → Batches → Selections → Products →
     References → Templates / Settings
   Confirm whether this order makes sense from a design-system
   standpoint, and call out any dependencies or sequencing risks you
   see. Do not propose an alternative ordering unless this one would
   actively break the design system.
9. If useful, visual / spec-level guidance for:
   - app shell
   - Overview
   - Library
   - Batches

Do not turn this into feature ideation.
Do not redesign it as a physical POD platform.
The product is **Kivasy**, not "EtsyHub" or any other prior name.
Aim for one strong product direction.
```
