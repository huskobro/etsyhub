import { expect, test } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, login } from "./helpers";

test.describe("auth", () => {
  test("giriş yapılmadan / -> /login'e yönlendirir", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/login");
    await expect(page.getByRole("heading", { name: /Giriş yap/i })).toBeVisible();
  });

  test("admin credentials ile login → /dashboard", async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page.getByRole("heading", { name: /Hoş geldin/i })).toBeVisible();
  });

  test("yanlış parola hata mesajı gösterir", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("E-posta").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Parola").fill("wrong-password-123");
    await page.getByRole("button", { name: /Giriş Yap/i }).click();
    await expect(page.getByText(/E-posta veya parola hatalı/i)).toBeVisible();
  });
});
