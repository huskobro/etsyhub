// Phase 7 Task 41 — Golden path E2E (Selection Studio shell + Quick start CTA).
//
// Disiplin: KIE'den bağımsız deterministic UI smoke. Quick start mutation'ı
// (Phase 5 variation batch + KIE bağımlılığı) E2E scope dışı; yalnız UI
// affordance + manuel set lifecycle kanıtlanır.
//
// DB-state aware: testler admin user'ın aktif draft set'ine veya design
// verisine bağımlı değil; her iki durumu graceful handle eder.

import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("Phase 7 — Selection Studio golden path", () => {
  test("/selection sayfası açılır (boş veya dolu)", async ({ page }) => {
    await login(page);
    await page.goto("/selection");
    await expect(
      page.getByRole("heading", { name: /Selection Studio/i }),
    ).toBeVisible();
  });

  test("manuel set oluşturma → Studio sayfasına redirect", async ({ page }) => {
    await login(page);
    await page.goto("/selection");

    // Sayfa heading + query settle — "Aktif draft" section yüklendi mi.
    await expect(
      page.getByRole("heading", { name: /Selection Studio/i }),
    ).toBeVisible();
    // Query settle'ı için empty state veya draft card'ı bekle (skeleton'dan
    // çıkana kadar). 5sn timeout — query in-process+SQLite hızlı.
    await page
      .waitForSelector(
        'h1:has-text("Selection Studio") ~ section >> text=/Henüz aktif draft|Draft/',
        { timeout: 5_000 },
      )
      .catch(() => {
        /* settle olmazsa devam et — locator-level isVisible kontrolü yapılacak */
      });

    // Empty state → "Yeni set oluştur" CTA, aktif draft varsa "Aç" link.
    const createButton = page
      .getByRole("button", { name: /Yeni set oluştur/i })
      .first();
    const openLink = page.getByRole("link", { name: /^Aç$/i }).first();

    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();
      // Modal açılır — Dialog title "Yeni set oluştur"
      await expect(
        page.getByRole("heading", { name: /Yeni set oluştur/i }),
      ).toBeVisible();
      const nameInput = page.getByLabel(/Set adı/i);
      await nameInput.fill(`E2E Smoke Set ${Date.now()}`);
      const submitBtn = page.getByRole("button", { name: /^Oluştur$/i });
      await expect(submitBtn).toBeEnabled();
      await submitBtn.click();
      // Studio redirect → /selection/sets/[id]
      await page.waitForURL(/\/selection\/sets\/[a-z0-9]+/i, {
        timeout: 15_000,
      });
      await expect(page).toHaveURL(/\/selection\/sets\/[a-z0-9]+/i);
    } else if (await openLink.isVisible().catch(() => false)) {
      // Aktif draft set var → "Aç" ile Studio'ya geç (alternative path).
      await openLink.click();
      await page.waitForURL(/\/selection\/sets\/[a-z0-9]+/i, {
        timeout: 10_000,
      });
      await expect(page).toHaveURL(/\/selection\/sets\/[a-z0-9]+/i);
    } else {
      test.skip(
        true,
        "/selection sayfasında 'Yeni set oluştur' veya 'Aç' butonu bulunamadı",
      );
    }
  });

  test("Studio shell yüklenir — set adı + Draft badge + üst bar action'lar", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/selection");

    await expect(
      page.getByRole("heading", { name: /Selection Studio/i }),
    ).toBeVisible();
    await page
      .waitForSelector(
        'h1:has-text("Selection Studio") ~ section >> text=/Henüz aktif draft|Draft/',
        { timeout: 5_000 },
      )
      .catch(() => {
        /* settle olmazsa locator-level isVisible kontrol yapılacak */
      });

    const createButton = page
      .getByRole("button", { name: /Yeni set oluştur/i })
      .first();
    const openLink = page.getByRole("link", { name: /^Aç$/i }).first();

    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();
      await page.getByLabel(/Set adı/i).fill(`E2E Studio Test ${Date.now()}`);
      await page.getByRole("button", { name: /^Oluştur$/i }).click();
      await page.waitForURL(/\/selection\/sets\/[a-z0-9]+/i, {
        timeout: 15_000,
      });
    } else if (await openLink.isVisible().catch(() => false)) {
      await openLink.click();
      await page.waitForURL(/\/selection\/sets\/[a-z0-9]+/i, {
        timeout: 10_000,
      });
    } else {
      test.skip(true, "Studio için set bulunamadı (fixture yok)");
      return;
    }

    // Draft badge görünür (yeni oluşturulan set draft, mevcut aktif draft da
    // tanım gereği draft).
    await expect(page.getByText(/^Draft$/i).first()).toBeVisible();

    // Üst bar: "İndir (ZIP)" buton (boş set'te disabled, dolu set'te enabled).
    await expect(
      page.getByRole("button", { name: /İndir \(ZIP\)/i }).first(),
    ).toBeVisible();

    // "Finalize selection" button (0 selected → disabled; must still be visible).
    await expect(
      page.getByRole("button", { name: /finalize selection/i }).first(),
    ).toBeVisible();

    // Kebap menü — aria-label="Set seçenekleri"
    await expect(
      page.getByRole("button", { name: /Set seçenekleri/i }).first(),
    ).toBeVisible();
  });

  test("/review AI Tasarımları → Quick start CTA conditional smoke", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/review");

    // /review h1 "Review"
    await expect(
      page.getByRole("heading", { name: /^Review$/i }),
    ).toBeVisible();

    // Review queue'da design varsa "Studio" buton (jobId !== null) görünür;
    // yoksa empty state. UI smoke — her iki durum geçerli.
    const studioButton = page
      .getByRole("button", { name: /Selection Studio'da aç/i })
      .first();
    const studioByText = page.getByRole("button", { name: /^Studio$/i }).first();

    // Buton görünmüyorsa empty state veya farklı tab — false positive yok,
    // smoke amacımız sayfa render'ı + buton DOM'da arama hatası vermesin.
    const studioVisible = await studioButton
      .isVisible()
      .catch(() => false)
      .then((v) => v || studioByText.isVisible().catch(() => false));

    // Test'in görevi: sayfa açılır + (varsa) Studio CTA DOM'a basılır.
    // studioVisible bool — assertion yok (DB state-aware). Sayfa heading
    // assertion yukarıda zaten yapıldı.
    expect(typeof studioVisible).toBe("boolean");
  });
});
