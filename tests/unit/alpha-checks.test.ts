import { describe, it, expect } from "vitest";
import path from "node:path";
import { runAlphaChecks } from "@/server/services/review/alpha-checks";

const FIXTURE_DIR = path.join(process.cwd(), "tests", "fixtures", "review");

describe("runAlphaChecks — deterministic alpha kontrolleri", () => {
  it("opaque PNG (alfa kanalı yok) → no_alpha_channel flag döner", async () => {
    const flags = await runAlphaChecks(path.join(FIXTURE_DIR, "opaque.png"));
    expect(flags).toHaveLength(1);
    // Drift #5: alan adı `type` → `kind` (KIE strict JSON schema fix).
    expect(flags[0]!.kind).toBe("no_alpha_channel");
    expect(flags[0]!.confidence).toBeGreaterThanOrEqual(0);
    expect(flags[0]!.confidence).toBeLessThanOrEqual(1);
    expect(flags[0]!.reason.length).toBeGreaterThan(0);
  });

  it("temiz transparent PNG (kenar tamamı alpha=0) → boş array", async () => {
    const flags = await runAlphaChecks(
      path.join(FIXTURE_DIR, "transparent-clean.png"),
    );
    expect(flags).toEqual([]);
  });

  it("kenar artifact'lı transparent PNG → transparent_edge_artifact flag döner", async () => {
    const flags = await runAlphaChecks(
      path.join(FIXTURE_DIR, "transparent-edge-artifact.png"),
    );
    expect(flags).toHaveLength(1);
    expect(flags[0]!.kind).toBe("transparent_edge_artifact");
    expect(flags[0]!.confidence).toBeGreaterThanOrEqual(0);
    expect(flags[0]!.confidence).toBeLessThanOrEqual(1);
    expect(flags[0]!.reason.length).toBeGreaterThan(0);
  });

  it("dosya yoksa fs/sharp hatası fırlatır (sessiz fallback yok)", async () => {
    await expect(
      runAlphaChecks(path.join(FIXTURE_DIR, "nonexistent.png")),
    ).rejects.toThrow();
  });
});
