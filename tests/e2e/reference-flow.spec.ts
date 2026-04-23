import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("reference flow", () => {
  test("/references sayfası açılır (boş veya dolu)", async ({ page }) => {
    await login(page);
    await page.goto("/references");
    await expect(
      page.getByRole("heading", { name: /Reference Board/i }),
    ).toBeVisible();
  });

  test("dashboard hızlı aksiyonlar görünür", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await expect(page.getByText(/Hızlı Aksiyonlar/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /URL['’]den Bookmark/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Görsel Yükle/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Yeni Koleksiyon/i }),
    ).toBeVisible();
  });
});
