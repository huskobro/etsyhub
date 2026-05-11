# `docs/design/` — pre-Kivasy history (ignored)

Files in this folder are **pre-Kivasy** ("Editorial Cockpit", EtsyHub-branded)
design artefacts. They are kept for git-history compatibility ONLY and must
not be referenced by:

- Rollout implementation work — use [`docs/IMPLEMENTATION_HANDOFF.md`](../IMPLEMENTATION_HANDOFF.md).
- Claude Design / handoff context — use [`docs/CLAUDE_DESIGN_CONTEXT.md`](../CLAUDE_DESIGN_CONTEXT.md).
- Visual parity audits — use [`docs/design-system/kivasy/`](../design-system/kivasy/) UI kits.

## What lives here

| Path | Status | Superseded by |
|---|---|---|
| `EtsyHub/` | Pre-Kivasy design language + spec + jsx primitives. Pre-rollout. | `docs/design-system/kivasy/` |
| `EtsyHub_mockups/` | Pre-Kivasy mockup studio mocks. Pre-rollout. | `docs/design-system/kivasy/ui_kits/kivasy/v5.html` (B-tier) |
| `claude-design-brief.md` | Pre-Kivasy Claude Design brief draft. | `docs/CLAUDE_DESIGN_HANDOFF_BRIEF.md` |
| `implementation-brief.md` | Pre-Kivasy implementation brief draft. | `docs/IMPLEMENTATION_HANDOFF.md` |
| `implementation-notes/` | Phase 5–9 manual QA notes, dashboard widget proposals, stabilisation runbooks. Phase planning history. | (no replacement — these were phase artefacts, not rollout artefacts) |

`EtsyHub.zip` (the redundant archive of `EtsyHub/`) was removed in the
R3.5 housekeeping pass.

## Source of truth — current

- **Project rules** → [`CLAUDE.md`](../../CLAUDE.md)
- **Implementation handoff** → [`docs/IMPLEMENTATION_HANDOFF.md`](../IMPLEMENTATION_HANDOFF.md)
- **Design system (Kivasy)** → [`docs/design-system/kivasy/`](../design-system/kivasy/)
  - Live UI kits: `ui_kits/kivasy/v4.html` (A1-A7), `v5.html` (B1-B6),
    `v6.html` (C1-C3), `v7.html` (D1-D2)
  - Tokens: `ui_kits/kivasy/v4/tokens.css`
- **Design context (handoff brief)** → [`docs/CLAUDE_DESIGN_CONTEXT.md`](../CLAUDE_DESIGN_CONTEXT.md)
- **Design parity checkpoint** → [`docs/DESIGN_PARITY_CHECKPOINT.md`](../DESIGN_PARITY_CHECKPOINT.md)

## Why this folder still exists

The phase planning artefacts in `implementation-notes/` and the original
EtsyHub design language are part of the project's history. They tell the
story of how the design got from "Editorial Cockpit" to "Kivasy Operator
Cockpit." Deleting them would erase that trail. Keeping them, badged
clearly, lets future contributors understand the evolution without
mistaking history for current truth.

If you find yourself opening a file in this folder for **production work**,
stop. The answer you want is one of the source-of-truth links above.
