import type { Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@etsyhub.local";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin12345";

export async function login(
  page: Page,
  email = ADMIN_EMAIL,
  password = ADMIN_PASSWORD,
) {
  await page.goto("/login");
  // Label-based locators — auth-shell placeholder'ları değişti
  // ("sen@magazan.co" / "••••••••"), label metinleri ("E-posta" / "Parola")
  // sabit ve <label htmlFor> bağlı.
  await page.getByLabel(/E-posta/i).fill(email);
  await page.getByLabel(/Parola/i).fill(password);
  await page.getByRole("button", { name: /Giriş yap/i }).click();
  await page.waitForURL("**/dashboard");
}
