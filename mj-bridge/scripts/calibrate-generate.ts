// Pass 49 — Generate flow kalibrasyon script'i.
//
// Amaç: Logged-in MJ Chrome session'a CDP attach olup gerçek
// `submitPrompt`, `captureBaselineUuids`, `waitForRender` chain'inin
// çalıştığını **submit YAPMADAN** doğrulamak. Submit MJ credit harcadığı
// için default mode'da prompt'u yazılır ama Enter gönderilmez; kullanıcı
// `--submit` flag'iyle gerçek generate'i tetikleyebilir.
//
// Çalıştır:
//   $ cd mj-bridge
//   $ npx tsx scripts/calibrate-generate.ts        # dry-run (no submit)
//   $ npx tsx scripts/calibrate-generate.ts --submit  # gerçek generate
//
// Env:
//   MJ_BRIDGE_CDP_URL   default http://127.0.0.1:9222
//   MJ_PROMPT           default "abstract wall art test pattern"
//   MJ_TIMEOUT_MS       default 180000

import { chromium } from "playwright";
import { loadSelectors, loadUrls } from "../src/drivers/selectors.js";
import {
  buildMJPromptString,
  captureBaselineUuids,
  downloadGridImages,
  submitPrompt,
  waitForRender,
} from "../src/drivers/generate-flow.js";
import { detectChallengeRequired, detectLoginRequired } from "../src/drivers/detection.js";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const prompt = process.env["MJ_PROMPT"] ?? "abstract wall art test pattern";
const timeoutMs = Number(process.env["MJ_TIMEOUT_MS"] ?? "180000");
const submitMode = process.argv.includes("--submit");
const downloadMode = process.argv.includes("--download");

async function main(): Promise<void> {
  console.log("[calibrate] CDP:", cdpUrl);
  console.log("[calibrate] mode:", submitMode ? "SUBMIT (will spend MJ credit)" : "dry-run (no submit)");
  console.log("[calibrate] download:", downloadMode);

  const selectors = loadSelectors();
  const urls = loadUrls();

  const browser = await chromium.connectOverCDP(cdpUrl, { timeout: 10_000 });
  const ctx = browser.contexts()[0]!;
  const pages = ctx.pages();
  const mjPage = pages.find((p) => p.url().includes("midjourney.com"));
  const page = mjPage ?? pages[0] ?? (await ctx.newPage());

  if (!page.url().includes("/imagine")) {
    console.log("[calibrate] navigating to /imagine");
    await page.goto(urls.imagine, { waitUntil: "domcontentloaded", timeout: 30_000 });
  }
  await page.bringToFront().catch(() => undefined);

  // 1. Challenge detection
  const ch = await detectChallengeRequired(page, selectors);
  console.log("[calibrate] challenge:", ch);
  if (ch.challengeRequired) {
    console.error("[calibrate] CHALLENGE — manual çözüm gerek, çıkılıyor");
    await browser.close();
    process.exit(1);
  }

  // 2. Login detection
  const lg = await detectLoginRequired(page, selectors);
  console.log("[calibrate] login:", lg);
  if (lg.loginRequired) {
    console.error("[calibrate] LOGIN REQUIRED — bu profile'da MJ login değil");
    await browser.close();
    process.exit(1);
  }

  // 3. Prompt input visibility
  const inputLocator = page.locator(selectors.promptInput).first();
  const visible = await inputLocator.isVisible({ timeout: 5000 }).catch(() => false);
  console.log("[calibrate] promptInput visible:", visible);
  if (!visible) {
    console.error("[calibrate] PROMPT INPUT FOUND BUT NOT VISIBLE — selector kalibrasyon gerek");
    await browser.close();
    process.exit(1);
  }

  // 4. Baseline UUID capture (submit'ten ÖNCE)
  const baseline = await captureBaselineUuids(page, selectors);
  console.log("[calibrate] baseline UUID count:", baseline.size);
  if (baseline.size > 0) {
    console.log("[calibrate] baseline sample:", Array.from(baseline).slice(0, 3));
  }

  // 5. Prompt string build
  const promptString = buildMJPromptString({
    prompt,
    aspectRatio: "1:1",
    version: "7",
  });
  console.log("[calibrate] prompt string:", promptString);

  if (!submitMode) {
    console.log("\n[calibrate] DRY-RUN — promptInput'a yazma yapılmadı, submit yok.");
    console.log("[calibrate] Gerçek submit için: --submit flag'i ekle (MJ credit harcanır).");
    await browser.close();
    return;
  }

  // 6. Submit (--submit flag)
  console.log("[calibrate] SUBMIT — promptInput'a yazılıyor + Enter");
  await submitPrompt(page, selectors, promptString);
  console.log("[calibrate] submitted, waiting for render…");

  // 7. Render polling
  const start = Date.now();
  const render = await waitForRender(page, selectors, {
    baselineUuids: baseline,
    timeoutMs,
    onPoll: (ms, n) => {
      console.log(`[calibrate] poll ${Math.floor(ms / 1000)}s · ${n} yeni img`);
    },
  });
  const elapsed = Date.now() - start;
  console.log(`[calibrate] RENDER OK in ${Math.floor(elapsed / 1000)}s`);
  console.log("[calibrate] mjJobId (UUID):", render.mjJobId);
  console.log("[calibrate] imageUrls:");
  for (const u of render.imageUrls) console.log("  ", u);

  if (downloadMode) {
    const outDir = join(process.cwd(), "data", "calibrate-outputs");
    await mkdir(outDir, { recursive: true });
    console.log("[calibrate] downloading to:", outDir);
    const downloaded = await downloadGridImages(
      page,
      render.imageUrls,
      outDir,
      render.mjJobId ?? "unknown",
    );
    for (const d of downloaded) {
      console.log(`  [grid ${d.gridIndex}] ${d.localPath}`);
    }
  }

  await browser.close();
  console.log("[calibrate] DONE");
}

main().catch((err) => {
  console.error("[calibrate] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
