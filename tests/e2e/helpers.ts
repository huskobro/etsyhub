import type { Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@etsyhub.local";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin12345";

export async function login(
  page: Page,
  email = ADMIN_EMAIL,
  password = ADMIN_PASSWORD,
) {
  await page.goto("/login");
  await page.getByPlaceholder("E-posta").fill(email);
  await page.getByPlaceholder("Parola").fill(password);
  await page.getByRole("button", { name: /Giriş Yap/i }).click();
  await page.waitForURL("**/dashboard");
}
