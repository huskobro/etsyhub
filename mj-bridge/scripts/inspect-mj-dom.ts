// Pass 44 — MJ DOM introspection script.
//
// Amaç: gerçek MJ web tarafında selector default'larını kalibre etmek.
// Standalone Playwright; bridge HTTP server'ı bypass eder. Aynı
// persistent profile'a bağlanır → kullanıcı önceden login etmişse
// session sahip.
//
// Çıktı: data/dom-inspection-{timestamp}.json — her selector key için
// found/count/firstHTML snippet. Selector default'larını bu raporla
// karşılaştırıp gerekirse `selectors.ts` defaultları + JSDoc not güncel.
//
// Çalıştır:
//   $ cd mj-bridge
//   $ npx tsx scripts/inspect-mj-dom.ts
//
// Default kullanıcı login etmiş midjourney.com/explore veya
// midjourney.com/imagine'da Imagine bar görür. Login yoksa Sign In
// linkini görür.

import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadSelectors, loadUrls, type MJSelectorKey } from "../src/drivers/selectors.js";

const PROFILE_DIR =
  process.env["MJ_BRIDGE_PROFILE"] ??
  "/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/mj-bridge/profile";
const OUTPUT_DIR =
  process.env["MJ_INSPECT_DIR"] ??
  "/Users/huseyincoskun/Downloads/AntigravityProje/EtsyHub/mj-bridge/data/dom-inspection";

type SelectorReport = {
  key: MJSelectorKey;
  selector: string;
  count: number;
  firstHTML?: string;
  firstText?: string;
};

async function inspectPage(
  page: import("playwright").Page,
  selectors: Record<MJSelectorKey, string>,
): Promise<{
  url: string;
  title: string;
  bodyTextSample: string;
  cloudflareInterstitial: {
    titleMatch: boolean;
    rayIdMatch: boolean;
    hasCloudflareLink: boolean;
    verifyText: boolean;
    cfClass: boolean;
  };
  selectorReports: SelectorReport[];
  linkSummary: { href: string; text: string }[];
  textareaSummary: { placeholder: string | null; ariaLabel: string | null; id: string | null }[];
}> {
  // Sayfa yüklenmesini bekle.
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  // Cloudflare interstitial veya MJ React app'i render olsun — 5sn bekle.
  await page.waitForTimeout(5000);

  const url = page.url();
  const title = await page.title();
  const bodyText = await page.evaluate(() =>
    document.body.innerText.slice(0, 500),
  );

  const selectorReports: SelectorReport[] = [];
  for (const [k, sel] of Object.entries(selectors) as [MJSelectorKey, string][]) {
    const locator = page.locator(sel);
    const count = await locator.count().catch(() => 0);
    let firstHTML: string | undefined;
    let firstText: string | undefined;
    if (count > 0) {
      try {
        firstHTML = (
          await locator.first().evaluate((el) => el.outerHTML.slice(0, 200))
        ).slice(0, 200);
        firstText = await locator
          .first()
          .innerText()
          .catch(() => undefined);
      } catch {
        // ignore
      }
    }
    selectorReports.push({ key: k, selector: sel, count, firstHTML, firstText });
  }

  // Sayfa üstündeki tüm linkler (sign in, imagine, vb. tespiti için).
  const linkSummary = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a"))
      .slice(0, 30)
      .map((a) => ({
        href: a.getAttribute("href") ?? "",
        text: (a.textContent ?? "").trim().slice(0, 50),
      }))
      .filter((l) => l.text.length > 0),
  );

  // Tüm textarea'lar (prompt input tespiti).
  const textareaSummary = await page.evaluate(() =>
    Array.from(document.querySelectorAll("textarea")).map((t) => ({
      placeholder: t.getAttribute("placeholder"),
      ariaLabel: t.getAttribute("aria-label"),
      id: t.getAttribute("id"),
    })),
  );

  // Cloudflare interstitial debug info — Pass 44 detection upgrade için.
  const cloudflareInterstitial = await page.evaluate(() => {
    const titleLower = document.title.toLowerCase();
    const titlePattern = /just a moment|bir dakika|moment bitte|momento por favor|un moment|wait/i;
    const bodyTextLocal = document.body?.innerText ?? "";
    return {
      titleMatch: titlePattern.test(titleLower),
      rayIdMatch: /ray id[:\s]*[0-9a-f]+/i.test(bodyTextLocal),
      hasCloudflareLink: !!document.querySelector('a[href*="cloudflare.com"]'),
      verifyText:
        /verify you are human|verify human|güvenlik doğrulaması|sicherheitsüberprüfung/i.test(
          bodyTextLocal,
        ),
      cfClass: !!document.querySelector(
        '[class*="cf-"], #cf-spinner, #cf-bubbles',
      ),
    };
  });

  return {
    url,
    title,
    bodyTextSample: bodyText,
    cloudflareInterstitial,
    selectorReports,
    linkSummary,
    textareaSummary,
  };
}

async function main(): Promise<void> {
  const selectors = loadSelectors();
  const urls = loadUrls();

  console.log("[inspect-mj] launching persistent context:", PROFILE_DIR);
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  await mkdir(OUTPUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  // 1. Home/explore
  console.log("[inspect-mj] visiting:", urls.base);
  await page
    .goto(urls.base, { waitUntil: "domcontentloaded", timeout: 30_000 })
    .catch((err) => console.warn("home goto fail:", err.message));
  const homeReport = await inspectPage(page, selectors);
  await writeFile(
    join(OUTPUT_DIR, `home-${stamp}.json`),
    JSON.stringify(homeReport, null, 2),
  );
  console.log("[inspect-mj] home report saved");
  console.log("home url:", homeReport.url);
  console.log("home title:", homeReport.title);
  console.log(
    "home selector hits:",
    homeReport.selectorReports
      .filter((r) => r.count > 0)
      .map((r) => `${r.key}=${r.count}`)
      .join(", "),
  );
  console.log("home textareas:", JSON.stringify(homeReport.textareaSummary));

  // 2. Imagine page
  console.log("[inspect-mj] visiting:", urls.imagine);
  await page
    .goto(urls.imagine, { waitUntil: "domcontentloaded", timeout: 30_000 })
    .catch((err) => console.warn("imagine goto fail:", err.message));
  const imagineReport = await inspectPage(page, selectors);
  await writeFile(
    join(OUTPUT_DIR, `imagine-${stamp}.json`),
    JSON.stringify(imagineReport, null, 2),
  );
  console.log("[inspect-mj] imagine report saved");
  console.log("imagine url:", imagineReport.url);
  console.log("imagine title:", imagineReport.title);
  console.log(
    "imagine selector hits:",
    imagineReport.selectorReports
      .filter((r) => r.count > 0)
      .map((r) => `${r.key}=${r.count}`)
      .join(", "),
  );
  console.log(
    "imagine textareas:",
    JSON.stringify(imagineReport.textareaSummary),
  );

  // 3. Archive (logged-in only)
  console.log("[inspect-mj] visiting:", urls.archive);
  await page
    .goto(urls.archive, { waitUntil: "domcontentloaded", timeout: 30_000 })
    .catch((err) => console.warn("archive goto fail:", err.message));
  const archiveReport = await inspectPage(page, selectors);
  await writeFile(
    join(OUTPUT_DIR, `archive-${stamp}.json`),
    JSON.stringify(archiveReport, null, 2),
  );
  console.log("[inspect-mj] archive report saved");
  console.log("archive url:", archiveReport.url);

  console.log("\n[inspect-mj] DONE — reports:", OUTPUT_DIR);
  console.log("Browser açık bırakılıyor (Ctrl+C kapatmaz; pencerini kapat).");

  // Kullanıcı manuel inceleyebilsin — context'i kapatmadan bekle.
  // 60sn sonra otomatik kapan.
  await new Promise((r) => setTimeout(r, 60_000));
  await ctx.close();
}

main().catch((err) => {
  console.error("[inspect-mj] FATAL:", err);
  process.exit(1);
});
