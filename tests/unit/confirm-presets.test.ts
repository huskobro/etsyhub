import { describe, it, expect } from "vitest";
import { confirmPresets } from "@/components/ui/confirm-presets";

describe("confirmPresets", () => {
  describe("archiveBookmark", () => {
    it("title ve cancelLabel doğru", () => {
      const p = confirmPresets.archiveBookmark();
      expect(p.title).toBe("Bookmark'ı arşivle");
      expect(p.cancelLabel).toBe("Vazgeç");
      expect(p.confirmLabel).toBe("Arşivle");
      expect(p.tone).toBe("destructive");
    });

    it("context parametresi description'da görünür", () => {
      const p = confirmPresets.archiveBookmark("Boho Canvas");
      expect(p.description).toContain('"Boho Canvas"');
    });

    it("context olmadığında genel description üretir", () => {
      const p = confirmPresets.archiveBookmark();
      expect(p.description.length).toBeGreaterThan(10);
      // context içermemeli
      expect(p.description).not.toContain('"');
    });
  });

  describe("archiveReference", () => {
    it("title ve tone doğru", () => {
      const p = confirmPresets.archiveReference();
      expect(p.title).toBe("Referansı arşivle");
      expect(p.tone).toBe("destructive");
    });

    it("context geçilince description'da görünür", () => {
      const p = confirmPresets.archiveReference("Minimalist Poster");
      expect(p.description).toContain('"Minimalist Poster"');
    });
  });

  describe("archiveCollection", () => {
    it("title ve tone doğru", () => {
      const p = confirmPresets.archiveCollection();
      expect(p.title).toBe("Koleksiyonu arşivle");
      expect(p.tone).toBe("destructive");
    });

    it("context geçilince description'da görünür", () => {
      const p = confirmPresets.archiveCollection("Christmas Wall Art");
      expect(p.description).toContain('"Christmas Wall Art"');
    });
  });

  describe("deleteProductType", () => {
    it("tone destructive olmalı", () => {
      const p = confirmPresets.deleteProductType();
      expect(p.tone).toBe("destructive");
      expect(p.confirmLabel).toBe("Sil");
    });

    it("context geçilince description'da görünür", () => {
      const p = confirmPresets.deleteProductType("Canvas");
      expect(p.description).toContain('"Canvas"');
    });
  });

  describe("changeUserRole", () => {
    it("USER → ADMIN geçişinde tone warning olmalı", () => {
      const p = confirmPresets.changeUserRole("test@example.com", "ADMIN");
      expect(p.tone).toBe("warning");
      expect(p.description).toContain("test@example.com");
      expect(p.description).toContain("Admin");
    });

    it("ADMIN → USER geçişinde tone destructive olmalı", () => {
      const p = confirmPresets.changeUserRole("test@example.com", "USER");
      expect(p.tone).toBe("destructive");
      expect(p.description).toContain("Kullanıcı");
    });

    it("confirmLabel doğru", () => {
      const p = confirmPresets.changeUserRole("x@y.com", "ADMIN");
      expect(p.confirmLabel).toBe("Rolü güncelle");
    });
  });

  describe("activateTheme", () => {
    it("tone warning olmalı", () => {
      const p = confirmPresets.activateTheme();
      expect(p.tone).toBe("warning");
      expect(p.confirmLabel).toBe("Aktifleştir");
    });

    it("context geçilince description'da görünür", () => {
      const p = confirmPresets.activateTheme("Dark Mode");
      expect(p.description).toContain('"Dark Mode"');
    });
  });

  describe("deleteApiKey", () => {
    it("tone destructive, label doğru", () => {
      const p = confirmPresets.deleteApiKey("OpenAI");
      expect(p.tone).toBe("destructive");
      expect(p.confirmLabel).toBe("Sil");
      expect(p.description).toContain("OpenAI");
    });
  });

  describe("archiveReferencesBulk", () => {
    it("count'u description'a koyar", () => {
      const p = confirmPresets.archiveReferencesBulk(3);
      expect(p.title).toBe("Seçili referansları arşivle");
      expect(p.description).toMatch(/3 referans arşivlenecek/);
      expect(p.confirmLabel).toBe("Arşivle");
      expect(p.cancelLabel).toBe("Vazgeç");
      expect(p.tone).toBe("destructive");
    });
  });

  describe("Türkçe karakter bütünlüğü", () => {
    it("archiveBookmark Türkçe karakterleri bozmuyor", () => {
      const p = confirmPresets.archiveBookmark("Ürün");
      // ı, İ, ş, ç, ö, ü, ğ içeren metinler
      expect(p.description).toContain("İnbox");
    });

    it("archiveCollection koleksiyon bağlantısı ifadesi doğru", () => {
      const p = confirmPresets.archiveCollection("Test");
      expect(p.description).toContain("bağlantısı");
    });

    it("changeUserRole Türkçe karakter tam", () => {
      const p = confirmPresets.changeUserRole("user@test.com", "ADMIN");
      // "güncelle" içermeli
      expect(p.confirmLabel).toContain("güncelle");
    });
  });
});
