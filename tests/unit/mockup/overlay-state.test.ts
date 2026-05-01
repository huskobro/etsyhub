// Phase 8 Task 15 — useMockupOverlayState unit testleri.
//
// Spec §6.2: drawer + modal URL state. Pure helper `updateOverlayUrl` testleri
// (react hook'ları yok; saf URL logic test).

import { describe, it, expect } from "vitest";
import { updateOverlayUrl } from "@/features/mockups/hooks/useMockupOverlayState";

describe("updateOverlayUrl (Spec §6.2)", () => {
  describe("customize param", () => {
    it("adds ?customize=1", () => {
      const result = updateOverlayUrl("", { customize: "1" });
      expect(result).toContain("customize=1");
    });

    it("removes ?customize=1 when set to undefined", () => {
      const result = updateOverlayUrl("customize=1", { customize: undefined });
      expect(result).not.toContain("customize");
    });

    it("preserves existing ?t= when adding ?customize=1", () => {
      const result = updateOverlayUrl("t=tpl-a%2Ctpl-b", { customize: "1" });
      expect(result).toContain("customize=1");
      expect(result).toContain("t=tpl-a%2Ctpl-b");
    });
  });

  describe("templateId param", () => {
    it("adds ?templateId=X", () => {
      const result = updateOverlayUrl("", { templateId: "tpl-xyz" });
      expect(result).toContain("templateId=tpl-xyz");
    });

    it("removes ?templateId when set to undefined", () => {
      const result = updateOverlayUrl("templateId=tpl-xyz", {
        templateId: undefined,
      });
      expect(result).not.toContain("templateId");
    });

    it("preserves ?customize=1 when adding ?templateId=X", () => {
      const result = updateOverlayUrl("customize=1", {
        templateId: "tpl-xyz",
      });
      expect(result).toContain("customize=1");
      expect(result).toContain("templateId=tpl-xyz");
    });
  });

  describe("combined operations", () => {
    it("removes both customize and templateId", () => {
      const result = updateOverlayUrl("customize=1&templateId=tpl-xyz", {
        customize: undefined,
        templateId: undefined,
      });
      expect(result).not.toContain("customize");
      expect(result).not.toContain("templateId");
    });

    it("removes templateId but keeps customize", () => {
      const result = updateOverlayUrl("customize=1&templateId=tpl-xyz", {
        templateId: undefined,
      });
      expect(result).not.toContain("templateId");
      expect(result).toContain("customize=1");
    });

    it("removes customize and templateId, preserves t=", () => {
      const result = updateOverlayUrl(
        "customize=1&templateId=tpl-xyz&t=tpl-a",
        {
          customize: undefined,
          templateId: undefined,
        }
      );
      expect(result).not.toContain("customize");
      expect(result).not.toContain("templateId");
      expect(result).toContain("t=tpl-a");
    });
  });

  describe("edge cases", () => {
    it("handles empty input string", () => {
      const result = updateOverlayUrl("", { customize: "1" });
      expect(result).toBe("customize=1");
    });

    it("handles partial param updates (only customize)", () => {
      const current = "customize=1&templateId=tpl-xyz&t=tpl-a";
      const result = updateOverlayUrl(current, { customize: undefined });
      expect(result).toContain("templateId=tpl-xyz");
      expect(result).toContain("t=tpl-a");
      expect(result).not.toContain("customize");
    });

    it("handles no updates (empty object)", () => {
      const current = "customize=1&t=tpl-a";
      const result = updateOverlayUrl(current, {});
      expect(result).toBe("customize=1&t=tpl-a");
    });

    it("removes customize correctly from complex query", () => {
      const result = updateOverlayUrl("a=1&customize=1&b=2", {
        customize: undefined,
      });
      expect(result).not.toContain("customize");
      expect(result).toContain("a=1");
      expect(result).toContain("b=2");
    });
  });
});
