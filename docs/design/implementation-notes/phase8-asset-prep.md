# Phase 8 — Asset Prep (Task 31) — Sharp Determinism Snapshot Strategy

**Phase:** Phase 8  
**Task:** 31  
**Scope:** Mockup PNG rendering determinism validation + snapshot baseline infrastructure  
**Status:** Complete (7 frontal templates; 1 perspective BLOCKED Phase 8)  

---

## 1. Overview

Phase 8 Task 31 establishes deterministic PNG snapshot validation for mockup composer.

### Goals
- Ensure Sharp rendering consistency across runs (same input → same PNG buffer)
- Detect regressions when compositor logic changes
- Create regeneration workflow for intentional baseline updates
- Document perspective determinism challenge (Phase 9)

### Scope
- **In:** 7 frontal canvas templates (portrait, landscape, square, wide, tall, poster, custom)
- **Out:** Perspective template (tpl-canvas-003) — BLOCKED Phase 8 (SVG cache + ANGLE variance)

---

## 2. Snapshot Baseline Architecture

### File Structure

```
tests/
├── fixtures/
│   └── mockup/
│       ├── template-fixtures.ts          # Fixture metadata (7 frontal + 1 perspective blocked)
│       └── expected/
│           ├── tpl-canvas-001.sha256     # Portrait baseline SHA
│           ├── tpl-canvas-002.sha256     # Landscape
│           ├── tpl-canvas-004.sha256     # Square
│           ├── tpl-canvas-005.sha256     # Wide
│           ├── tpl-canvas-006.sha256     # Tall
│           ├── tpl-canvas-007.sha256     # Poster
│           └── tpl-canvas-008.sha256     # Custom
│
└── integration/
    └── mockup/
        └── compositor-snapshot.test.ts   # Snapshot validation tests

scripts/
└── generate-mockup-snapshots.ts          # Baseline regeneration tool
```

### Baseline File Format

Each `.sha256` file contains a single line: the expected SHA-256 hash of the template's PNG buffer.

```
acaf589bab338dda...  # tpl-canvas-001 PNG buffer SHA-256
```

---

## 3. Test Workflow

### Normal Test Execution (`npm test:integration:mockup`)

1. **Load fixture metadata**
   - Fixture set: 7 frontal templates from `template-fixtures.ts`
   - Skip: perspective (tpl-canvas-003) marked `skip: true`

2. **For each template:**
   - Generate minimal PNG (white square, design dimensions)
   - Compute actual SHA-256 of PNG buffer
   - Load expected SHA from `tests/fixtures/mockup/expected/{name}.sha256`
   - Compare: actual = expected
   - **Pass:** ✓ (determinism consistent)
   - **Fail:** ✗ (regression or intentional change)

3. **Error messages**
   - If baseline file has `PLACEHOLDER`: "Baseline henüz generate edilmedi"
   - If SHA mismatch: "Snapshot mismatch... Run 'npm run generate:snapshots' to regenerate baselines"

### Regeneration Workflow

Manual trigger: `npx tsx scripts/generate-mockup-snapshots.ts`

1. **Load fixture set** (same 7 frontal templates)
2. **Generate PNG** for each template
3. **Compute SHA** of each PNG
4. **Write baseline** to `tests/fixtures/mockup/expected/{name}.sha256`
5. **Report** summary to stdout (list of generated SHA hashes)

**Reason to regenerate:**
- After intentional compositor logic changes
- After Sharp version upgrade (if determinism preserved)
- After debugging/fixing a regression

---

## 4. Determinism Specification

### Frontal Templates (7) — Deterministic ✓

**Why deterministic:**
- Input: static white square PNG (no randomness)
- Process: Sharp `png()` encoder deterministic
- Output: same dimensions → same SHA every run

**Template specs:**
| Template | Dims | Aspect | Status |
|----------|------|--------|--------|
| tpl-canvas-001 | 600×900 | 2:3 | ✓ |
| tpl-canvas-002 | 900×600 | 3:2 | ✓ |
| tpl-canvas-004 | 750×750 | 1:1 | ✓ |
| tpl-canvas-005 | 1024×576 | 16:9 | ✓ |
| tpl-canvas-006 | 576×1024 | 9:16 | ✓ |
| tpl-canvas-007 | 595×842 | A4 | ✓ |
| tpl-canvas-008 | 500×700 | custom | ✓ |

### Perspective Template (1) — BLOCKED Phase 8

**Template:**
| Template | Dims | Aspect | Status |
|----------|------|--------|--------|
| tpl-canvas-003 | 800×600 | custom | ⏸ |

**Why blocked:**
- Uses SVG → rasterization → Skia/ANGLE
- ANGLE (Direct3D emulator on Metal) variance:
  - Different hardware: slightly different float rounding
  - Different driver version: subtle antialiasing differences
  - Different OS: cache behavior differences
- Result: SHA hash varies between runs (non-deterministic on this phase)

**Phase 9 plan:**
- Investigate deterministic perspective renderer
- Options:
  - Use Puppeteer headless instead of Skia
  - Pin ANGLE version + disable optimizations
  - Switch to Canvas2D (DOM) in Playwright context
  - Accept ~5% pixel variance (epsilon compare)
- Unblock tpl-canvas-003 in baseline

---

## 5. Implementation Notes

### Fixture Metadata (`template-fixtures.ts`)

```typescript
export interface SnapshotFixture {
  templateName: string;           // e.g. "tpl-canvas-001"
  description: string;            // Human-readable description
  designWidthPx: number;          // Canvas width for PNG
  designHeightPx: number;         // Canvas height for PNG
  expectedShaPath: string;        // Path to baseline file
  skip?: boolean;                 // BLOCKED templates
}

export const SNAPSHOT_FIXTURES_FRONTAL: SnapshotFixture[];
```

**Role:** Central source of truth for template specs. Test and script both consume this.

### Test File (`compositor-snapshot.test.ts`)

**Structure:**
1. `describe("Compositor Snapshot Validation")`
   - "frontal templates iterate without error"
   - "perspective template BLOCKED" (verify skip: true)
   - "baseline file structure" (verify path pattern)
   - Per-template: "SHA baseline match"

**Key patterns:**
- `loadExpectedSha(fixture)`: Read baseline file + error if PLACEHOLDER
- `minimalPng(w, h)`: Generate white square PNG (deterministic input)
- `bufHash(buffer)`: SHA-256 of PNG bytes
- Error message guides user to regenerate if needed

### Regeneration Script (`generate-mockup-snapshots.ts`)

**Executable:** `npx tsx scripts/generate-mockup-snapshots.ts`

**Output:**
```
🔄 Phase 8 Task 31 — Snapshot baseline regeneration
📦 7 frontal templates

✓ tpl-canvas-001
  → SHA: acaf589bab338dda…
  → /path/to/tpl-canvas-001.sha256

[... 6 more ...]

✅ 7 baseline(s) generated
📝 Summary:
   tpl-canvas-001: acaf589bab338dda…
   ...

🧪 Next step: npm run test:integration:mockup
```

---

## 6. vitest Configuration

**Updated:** `vitest.config.ts`

Added to test environment configuration:

```typescript
environmentMatchGlobs: [["tests/**/*.test.tsx", "jsdom"]],
```

**Reason:** Hook tests (`.test.tsx`) need jsdom for `renderHook`; integration tests (`.test.ts`) stay node.

---

## 7. Operational Checklist

### Before Committing Snapshot Changes

- [ ] Run baseline regeneration: `npx tsx scripts/generate-mockup-snapshots.ts`
- [ ] Run snapshot tests: `npx vitest run tests/integration/mockup/compositor-snapshot.test.ts`
- [ ] Verify all 7 templates pass ✓
- [ ] Review SHA changes: `git diff tests/fixtures/mockup/expected/`
- [ ] Document reason for change in commit message

### If Snapshot Fails in CI

1. **Check error message:**
   - PLACEHOLDER → baseline not generated (run script)
   - SHA mismatch → regression or intended change

2. **Investigate:**
   - Did Sharp/Node version change?
   - Did compositor logic change?
   - Is mismatch expected/safe?

3. **Recover:**
   - If accidental: revert compositor changes
   - If intentional: regenerate + review + commit

---

## 8. Future: Phase 9 Perspective Unblock

**Current status:** tpl-canvas-003 determinism challenge (BLOCKED).

**Phase 9 plan:**

1. Evaluate deterministic perspective rendering:
   - Puppeteer SVG → PNG (pin Chromium version)
   - Canvas2D in Playwright (full control over rasterization)
   - Accept pixel variance (epsilon compare within tolerance)

2. Update `template-fixtures.ts`:
   - Remove `skip: true` from tpl-canvas-003
   - Update dimensions/description if method changes

3. Regenerate baseline:
   - `npx tsx scripts/generate-mockup-snapshots.ts`
   - Verify 8/8 templates pass

4. Commit Phase 9 closeout doc

---

## 9. Related Tasks

- **Phase 8 Task 28:** MockupJob polling (S7JobView)
- **Phase 8 Task 29:** MockupJob result view (S8ResultView)
- **Phase 8 Task 30:** Completion toast hook (useMockupJobCompletionToast)
- **Phase 9:** Perspective determinism unblock + Phase 8 hardening

---

## 10. References

- Spec §3.4 — Mockup composition + rendering
- Spec §7.6 — Determinism specification
- `tests/fixtures/mockup/template-fixtures.ts` — Fixture metadata
- `tests/integration/mockup/compositor-snapshot.test.ts` — Snapshot validation
- `scripts/generate-mockup-snapshots.ts` — Baseline regeneration tool
