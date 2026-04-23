import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("competitor flow", () => {
  test("login → /competitors → dialog aç/kapat", async ({ page }) => {
    await login(page);
    await page.goto("/competitors");

    // Feature flag açık olduğunda ana başlık ve ekleme butonu görünür.
    await expect(
      page.getByRole("heading", { level: 1, name: /Rakipler/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Rakip Ekle/i }).click();

    // Dialog başlığı ("Rakip Mağaza Ekle") görünür; dialog form alanları render olur.
    await expect(
      page.getByRole("heading", { name: /Rakip Mağaza Ekle/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/Mağaza adı veya URL/i)).toBeVisible();

    // Dialog kapatma butonu dialog'u kapatır.
    await page.getByRole("button", { name: /^Kapat$/ }).click();
    await expect(
      page.getByRole("heading", { name: /Rakip Mağaza Ekle/i }),
    ).toBeHidden();
  });

  test(
    "rakip ekle → liste kartı görünür → detay sayfası açılır (disclaimer + Yeni Tarama)",
    async ({ page }) => {
      await login(page);
      await page.goto("/competitors");

      // Test için benzersiz shop identifier; aynı test tekrar koşarsa
      // varsa mevcut karta tıklayabilir, yoksa yeni oluşturur.
      const shopIdentifier = `test-shop-${Date.now().toString(36)}`;

      await page.getByRole("button", { name: /Rakip Ekle/i }).click();
      await expect(
        page.getByRole("heading", { name: /Rakip Mağaza Ekle/i }),
      ).toBeVisible();

      await page.getByLabel(/Mağaza adı veya URL/i).fill(shopIdentifier);
      await page.getByRole("button", { name: /Rakibi Ekle/i }).click();

      // Dialog kapanır, başarı toast'ı görünür, kart listede belirir.
      await expect(
        page.getByRole("heading", { name: /Rakip Mağaza Ekle/i }),
      ).toBeHidden({ timeout: 15_000 });

      const card = page
        .getByRole("article")
        .filter({ hasText: shopIdentifier });
      await expect(card).toBeVisible({ timeout: 15_000 });

      // Karttaki "Detay" linkine tıkla → detay sayfasına git.
      await card.getByRole("link", { name: /Detay/i }).click();
      await page.waitForURL(/\/competitors\/[^/]+$/);

      // Detay sayfasında shop adıyla başlık ve disclaimer banner.
      await expect(
        page.getByRole("heading", { level: 1, name: shopIdentifier }),
      ).toBeVisible();
      await expect(
        page.getByText(
          /Yorum sayısı tahmini popülerlik göstergesidir; kesin satış rakamı değildir\./,
        ),
      ).toBeVisible();

      // "Yeni Tarama" butonu görünür (click etmiyoruz — scraper tetiklenmesin).
      await expect(
        page.getByRole("button", { name: /Yeni Tarama/i }),
      ).toBeVisible();
    },
  );
});
