import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("bookmark flow", () => {
  test("login → /bookmarks → URL'den ekle dialog açılır", async ({ page }) => {
    await login(page);
    await page.goto("/bookmarks");
    await expect(
      page.getByRole("heading", { name: /Bookmark Inbox/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /URL['’]den ekle/i }).first().click();
    await expect(
      page.getByRole("heading", { name: /URL['’]den bookmark ekle/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Kapat/i }).click();
    await expect(
      page.getByRole("heading", { name: /URL['’]den bookmark ekle/i }),
    ).toBeHidden();
  });

  test("/collections sayfası erişilebilir", async ({ page }) => {
    await login(page);
    await page.goto("/collections");
    await expect(
      page.getByRole("heading", { name: /Koleksiyonlar/i }),
    ).toBeVisible();
  });
});
