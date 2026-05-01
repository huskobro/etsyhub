import { describe, it, expect } from "vitest";
import { selectQuickPackDefault } from "@/features/mockups/server/quick-pack.service";

describe("selectQuickPackDefault — Spec §2.6", () => {
  // Helper: minimal template fixture
  function makeTpl(id: string, aspectRatios: string[], tags: string[]) {
    return { id, aspectRatios, tags };
  }

  it("returns [] when no compatible templates", () => {
    const result = selectQuickPackDefault({
      set: { variants: [{ aspectRatio: "1:1" }] },
      allActiveTemplates: [
        makeTpl("tpl-1", ["2:3"], ["modern"]),
        makeTpl("tpl-2", ["3:4"], ["boho"]),
      ],
    });
    expect(result).toEqual([]);
  });

  it("vibe diversity: each unique vibe represented at least once", () => {
    const result = selectQuickPackDefault({
      set: { variants: [{ aspectRatio: "2:3" }] },
      allActiveTemplates: [
        makeTpl("tpl-modern-1", ["2:3"], ["modern"]),
        makeTpl("tpl-modern-2", ["2:3"], ["modern", "neutral"]),
        makeTpl("tpl-boho", ["2:3"], ["boho"]),
        makeTpl("tpl-scandi", ["2:3"], ["scandinavian"]),
      ],
    });
    // Beklenen: modern (1 tane — ilk vibe match), boho, scandi (3 farklı vibe)
    // Lex sort: tpl-boho, tpl-modern-1, tpl-modern-2, tpl-scandi
    // 2a iteration:
    //   tpl-boho → vibe "boho" yeni → push
    //   tpl-modern-1 → vibe "modern" yeni → push
    //   tpl-modern-2 → vibe "modern" usedVibes'da, "neutral" VIBE_TAGS'de yok → atlanır
    //   tpl-scandi → vibe "scandinavian" yeni → push
    // 2b: targetSize 6 ama 3 result, kalan = [tpl-modern-2]
    //   tpl-modern-2 → push
    // Final: [tpl-boho, tpl-modern-1, tpl-scandi, tpl-modern-2]
    expect(result).toEqual(["tpl-boho", "tpl-modern-1", "tpl-scandi", "tpl-modern-2"]);
  });

  it("lex tie-break for equal vibe candidates (id ASC)", () => {
    const result = selectQuickPackDefault({
      set: { variants: [{ aspectRatio: "2:3" }] },
      allActiveTemplates: [
        makeTpl("tpl-z", ["2:3"], ["modern"]),
        makeTpl("tpl-a", ["2:3"], ["modern"]),
      ],
    });
    // Sort by id ASC: tpl-a, tpl-z
    // 2a: tpl-a → modern push; tpl-z → modern used, no other vibe → atlanır
    // 2b: targetSize 6 ama 1 result; kalan = [tpl-z] → push
    // Final: [tpl-a, tpl-z]
    expect(result).toEqual(["tpl-a", "tpl-z"]);
  });

  it("targetSize=6 default", () => {
    const allTpls = Array.from({ length: 10 }, (_, i) =>
      makeTpl(`tpl-${i.toString().padStart(2, "0")}`, ["2:3"], ["modern"]),
    );
    const result = selectQuickPackDefault({
      set: { variants: [{ aspectRatio: "2:3" }] },
      allActiveTemplates: allTpls,
    });
    expect(result).toHaveLength(6);
  });

  it("targetSize override (custom value)", () => {
    const allTpls = Array.from({ length: 10 }, (_, i) =>
      makeTpl(`tpl-${i.toString().padStart(2, "0")}`, ["2:3"], ["modern"]),
    );
    const result = selectQuickPackDefault({
      set: { variants: [{ aspectRatio: "2:3" }] },
      allActiveTemplates: allTpls,
      targetSize: 3,
    });
    expect(result).toHaveLength(3);
  });

  it("deterministic iteration: same input → same output", () => {
    const input = {
      set: { variants: [{ aspectRatio: "2:3" }] },
      allActiveTemplates: [
        makeTpl("tpl-c", ["2:3"], ["modern"]),
        makeTpl("tpl-a", ["2:3"], ["boho"]),
        makeTpl("tpl-b", ["2:3"], ["scandinavian"]),
      ],
    };
    const r1 = selectQuickPackDefault(input);
    const r2 = selectQuickPackDefault(input);
    expect(r1).toEqual(r2);
  });

  it("compatible filtered by aspect ratio match (multiple aspects)", () => {
    const result = selectQuickPackDefault({
      set: { variants: [{ aspectRatio: "2:3" }, { aspectRatio: "3:4" }] },
      allActiveTemplates: [
        makeTpl("tpl-2-3", ["2:3"], ["modern"]),
        makeTpl("tpl-3-4", ["3:4"], ["boho"]),
        makeTpl("tpl-1-1", ["1:1"], ["minimalist"]),
        makeTpl("tpl-multi", ["2:3", "3:4"], ["scandinavian"]),
      ],
    });
    // 2:3 var, 3:4 var, 1:1 yok set'te
    // Compatible: tpl-2-3, tpl-3-4, tpl-multi (sort id ASC: tpl-2-3, tpl-3-4, tpl-multi)
    // 2a: tpl-2-3 → modern; tpl-3-4 → boho; tpl-multi → scandinavian
    // Final 3 template (set targetSize 6 ama compatible 3)
    expect(result).toEqual(["tpl-2-3", "tpl-3-4", "tpl-multi"]);
  });

  it("falls back to lex order when vibes exhausted", () => {
    // Tüm template'ler ["modern"] tag'i ile (sadece 1 vibe)
    const allTpls = [
      makeTpl("tpl-a", ["2:3"], ["modern"]),
      makeTpl("tpl-b", ["2:3"], ["modern"]),
      makeTpl("tpl-c", ["2:3"], ["modern"]),
    ];
    const result = selectQuickPackDefault({
      set: { variants: [{ aspectRatio: "2:3" }] },
      allActiveTemplates: allTpls,
      targetSize: 6,
    });
    // 2a: tpl-a → modern push; tpl-b/c → modern used, atlanır
    // 2b: kalan tpl-b, tpl-c → push
    // Final: [tpl-a, tpl-b, tpl-c] (3 < targetSize 6, ama compatible 3)
    expect(result).toEqual(["tpl-a", "tpl-b", "tpl-c"]);
  });

  it("ignores tags outside VIBE_TAGS list", () => {
    const result = selectQuickPackDefault({
      set: { variants: [{ aspectRatio: "2:3" }] },
      allActiveTemplates: [
        // İkisi de VIBE_TAGS dışında ("luxe", "rustic" yok)
        makeTpl("tpl-a", ["2:3"], ["luxe"]),
        makeTpl("tpl-b", ["2:3"], ["rustic"]),
      ],
    });
    // 2a: hiç vibe match yok → result boş kalır
    // 2b: kalan tpl-a, tpl-b → push (lex order)
    expect(result).toEqual(["tpl-a", "tpl-b"]);
  });

  it("targetSize=0 returns empty", () => {
    const result = selectQuickPackDefault({
      set: { variants: [{ aspectRatio: "2:3" }] },
      allActiveTemplates: [makeTpl("tpl-1", ["2:3"], ["modern"])],
      targetSize: 0,
    });
    expect(result).toEqual([]);
  });

  it("empty set.variants → empty result", () => {
    const result = selectQuickPackDefault({
      set: { variants: [] },
      allActiveTemplates: [makeTpl("tpl-1", ["2:3"], ["modern"])],
    });
    // setAspects boş set → hiç template aspect uyumsuz
    expect(result).toEqual([]);
  });

  it("empty allActiveTemplates → empty result", () => {
    const result = selectQuickPackDefault({
      set: { variants: [{ aspectRatio: "2:3" }] },
      allActiveTemplates: [],
    });
    expect(result).toEqual([]);
  });
});
