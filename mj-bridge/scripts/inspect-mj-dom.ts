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
  // Pass 46 — agresif DOM probe.
  probe: {
    textInputs: Array<{
      tag: string;
      id: string | null;
      placeholder: string | null;
      ariaLabel: string | null;
      role: string | null;
      contentEditable: string | null;
      classes: string;
    }>;
    allImages: Array<{ src: string; alt: string; ariaLabel: string | null }>;
    dataAttrSample: string[];
    hasMainNav: boolean;
    hasMainHeader: boolean;
    hasMainContent: boolean;
    buttonCount: number;
    imgCount: number;
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

  // Pass 46 — agresif DOM probe. Login sonrası prompt input + grid +
  // result surface'lerini bulmak için generic candidate listesi.
  const probe = await page.evaluate(() => {
    // Tüm role="textbox" + textarea + input[type=text]
    const textInputs = Array.from(
      document.querySelectorAll(
        'textarea, input[type="text"], [role="textbox"], [contenteditable="true"]',
      ),
    )
      .slice(0, 20)
      .map((el) => ({
        tag: el.tagName,
        id: el.id || null,
        placeholder: el.getAttribute("placeholder"),
        ariaLabel: el.getAttribute("aria-label"),
        role: el.getAttribute("role"),
        contentEditable: el.getAttribute("contenteditable"),
        classes: (el.className?.toString() ?? "").slice(0, 80),
      }));
    // Tüm img'ler — generated image src pattern bulmak için.
    const allImages = Array.from(document.querySelectorAll("img"))
      .slice(0, 30)
      .map((img) => ({
        src: (img.getAttribute("src") ?? "").slice(0, 120),
        alt: (img.getAttribute("alt") ?? "").slice(0, 50),
        ariaLabel: img.getAttribute("aria-label"),
      }));
    // data-* attribute'lı elementlerin attr name'lerini topla — MJ
    // genelde data-job-id / data-testid kullanıyor olabilir.
    const dataAttrs = new Set<string>();
    document.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith("data-")) dataAttrs.add(attr.name);
      }
    });
    // En sık geçen 30 data-attr.
    return {
      textInputs,
      allImages,
      dataAttrSample: Array.from(dataAttrs).slice(0, 30),
      // Sayfa structure debug: ana ana element kategorileri
      hasMainNav: !!document.querySelector("nav"),
      hasMainHeader: !!document.querySelector("header"),
      hasMainContent: !!document.querySelector("main"),
      buttonCount: document.querySelectorAll("button").length,
      imgCount: document.querySelectorAll("img").length,
    };
  });

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
    probe,
    selectorReports,
    linkSummary,
    textareaSummary,
  };
}

async function main(): Promise<void> {
  const selectors = loadSelectors();
  const urls = loadUrls();

  // Pass 48 — mode dispatch. Attach default (Pass 47 ile uyumlu);
  // launch eski davranış. Attach modunda kullanıcının kendi başlattığı
  // Brave/Chrome'a CDP ile bağlanır ve onun MJ tab'ını inspect eder.
  // Kullanıcı zaten login olduğu için logged-in DOM görülür.
  const inspectMode: "attach" | "launch" =
    process.env["MJ_INSPECT_MODE"] === "launch" ? "launch" : "attach";
  const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";

  let ctx: import("playwright").BrowserContext;
  let isAttached = false;
  let browserToDisconnect: import("playwright").Browser | null = null;

  if (inspectMode === "attach") {
    console.log("[inspect-mj] connecting to existing browser:", cdpUrl);
    let browser: import("playwright").Browser;
    try {
      browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[inspect-mj] CDP bağlantı fail: ${msg}`);
      console.error(
        "Önce browser'ı --remote-debugging-port flag'iyle başlatın " +
          "(scripts/check-cdp.ts ile teşhis edin).",
      );
      process.exit(1);
    }
    browserToDisconnect = browser;
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      console.error(
        "[inspect-mj] CDP bağlandı ama browser context yok. Browser'da " +
          "en az bir pencere açık olmalı.",
      );
      process.exit(1);
    }
    ctx = contexts[0]!;
    isAttached = true;
  } else {
    console.log("[inspect-mj] launching persistent context:", PROFILE_DIR);
    const channelEnv = process.env["MJ_BRIDGE_BROWSER_CHANNEL"];
    const channel: "chrome" | undefined =
      channelEnv === "chromium" ? undefined : "chrome";
    try {
      ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
        channel,
        headless: false,
        viewport: { width: 1280, height: 900 },
        ignoreDefaultArgs: ["--enable-automation"],
      });
    } catch (err) {
      if (channel === "chrome") {
        console.warn(
          "[inspect-mj] system Chrome bulunamadı, bundled Chromium fallback:",
          err instanceof Error ? err.message : String(err),
        );
        ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
          headless: false,
          viewport: { width: 1280, height: 900 },
          ignoreDefaultArgs: ["--enable-automation"],
        });
      } else {
        throw err;
      }
    }
  }

  // Pass 48 — Attach modunda mevcut MJ tab'ını seç (varsa); yoksa yeni tab.
  // Launch modunda her zaman yeni tab.
  const pages = ctx.pages();
  let page: import("playwright").Page;
  if (isAttached) {
    const mjPage = pages.find((p) => p.url().includes("midjourney.com"));
    page = mjPage ?? pages[0] ?? (await ctx.newPage());
    console.log(
      `[inspect-mj] ${pages.length} tab'tan ${mjPage ? "mevcut MJ" : "ilk"} tab seçildi: ${page.url().slice(0, 80)}`,
    );
  } else {
    page = pages[0] ?? (await ctx.newPage());
  }

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
  if (isAttached) {
    // Pass 48 — attach modunda ctx KAPATMA (kullanıcının pencerelerini
    // öldürmemek için). Sadece CDP bağlantısını disconnect eder.
    if (browserToDisconnect) {
      await browserToDisconnect.close().catch(() => undefined);
    }
    console.log("Attach modu — browser pencereleri açık bırakıldı.");
  } else {
    // Pass 46 — launch modunda kullanıcı browser tab'ını kendisi
    // kapatabilsin diye env'le konfigüre edilebilir wait.
    const waitMs = Number(process.env["MJ_INSPECT_WAIT_MS"] ?? "30000");
    console.log(
      `Browser ${Math.round(waitMs / 1000)}sn açık kalacak (Ctrl+C ile early exit).`,
    );
    await new Promise((r) => setTimeout(r, waitMs));
    await ctx.close();
  }
}

main().catch((err) => {
  console.error("[inspect-mj] FATAL:", err);
  process.exit(1);
});
