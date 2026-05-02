// Phase 8 Task 31 — Snapshot baseline fixture set.
//
// Spec §3.4 + §7.6 (determinism specs). 7 frontal template + 1 perspective
// (BLOCKED). Her template'in expected PNG SHA-256 baseline'ı
// tests/fixtures/mockup/expected/ içinde {name}.sha256 dosyasında saklanır.
//
// Snapshot test workflow:
//   - Test: generate template → PNG → SHA hash oluştur
//   - Compare: actual SHA vs. expected SHA (fixture)
//   - Match: green ✓; Mismatch: red ✗ (regression / intended change)
//
// Baseline regeneration script: scripts/generate-mockup-snapshots.ts
//   (Phase 8 Task 31 — Sharp determinism snapshot baseline üretir; manual review sonra commit)
//
// Template names: tpl-canvas-{n}
//   - tpl-canvas-001: Canvas Portrait (2:3)
//   - tpl-canvas-002: Canvas Landscape (3:2)
//   - tpl-canvas-004: Canvas Square (1:1)
//   - tpl-canvas-005: Canvas Wide (16:9)
//   - tpl-canvas-006: Canvas Tall (9:16)
//   - tpl-canvas-007: Canvas Poster (A4)
//   - tpl-canvas-008: Canvas Custom (custom ratio)
//
// tpl-canvas-003 (perspective): Phase 8 (draft stage) — determinism challenge
// (SVG cache + ANGLE implementation variance). Task 31 BLOCKED bu template.

export interface SnapshotFixture {
  templateName: string;
  description: string;
  designWidthPx: number;
  designHeightPx: number;
  expectedShaPath: string;
  skip?: boolean; // BLOCKED templates
}

export const SNAPSHOT_FIXTURES: SnapshotFixture[] = [
  {
    templateName: "tpl-canvas-001",
    description: "Canvas Portrait (2:3, mockup 600×900px)",
    designWidthPx: 600,
    designHeightPx: 900,
    expectedShaPath: "tests/fixtures/mockup/expected/tpl-canvas-001.sha256",
  },
  {
    templateName: "tpl-canvas-002",
    description: "Canvas Landscape (3:2, mockup 900×600px)",
    designWidthPx: 900,
    designHeightPx: 600,
    expectedShaPath: "tests/fixtures/mockup/expected/tpl-canvas-002.sha256",
  },
  {
    templateName: "tpl-canvas-003",
    description: "Canvas Perspective (BLOCKED — Phase 8 determinism challenge)",
    designWidthPx: 800,
    designHeightPx: 600,
    expectedShaPath: "tests/fixtures/mockup/expected/tpl-canvas-003.sha256",
    skip: true,
  },
  {
    templateName: "tpl-canvas-004",
    description: "Canvas Square (1:1, mockup 750×750px)",
    designWidthPx: 750,
    designHeightPx: 750,
    expectedShaPath: "tests/fixtures/mockup/expected/tpl-canvas-004.sha256",
  },
  {
    templateName: "tpl-canvas-005",
    description: "Canvas Wide (16:9, mockup 1024×576px)",
    designWidthPx: 1024,
    designHeightPx: 576,
    expectedShaPath: "tests/fixtures/mockup/expected/tpl-canvas-005.sha256",
  },
  {
    templateName: "tpl-canvas-006",
    description: "Canvas Tall (9:16, mockup 576×1024px)",
    designWidthPx: 576,
    designHeightPx: 1024,
    expectedShaPath: "tests/fixtures/mockup/expected/tpl-canvas-006.sha256",
  },
  {
    templateName: "tpl-canvas-007",
    description: "Canvas Poster (A4 ratio, mockup 595×842px)",
    designWidthPx: 595,
    designHeightPx: 842,
    expectedShaPath: "tests/fixtures/mockup/expected/tpl-canvas-007.sha256",
  },
  {
    templateName: "tpl-canvas-008",
    description: "Canvas Custom (custom ratio, mockup 500×700px)",
    designWidthPx: 500,
    designHeightPx: 700,
    expectedShaPath: "tests/fixtures/mockup/expected/tpl-canvas-008.sha256",
  },
];

/**
 * Snapshot fixture set (frontal templates only; perspective BLOCKED).
 * Test'ler bu set'i iterate ederek generate → compare → report yapabilir.
 */
export const SNAPSHOT_FIXTURES_FRONTAL = SNAPSHOT_FIXTURES.filter(
  (f) => !f.skip,
);
