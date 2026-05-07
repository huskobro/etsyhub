// MJ Bridge entry point.
//
// Çalışma:
//   $ cd mj-bridge
//   $ MJ_BRIDGE_TOKEN=secret123 MJ_BRIDGE_DRIVER=mock npm run dev
//
// Env:
//   MJ_BRIDGE_TOKEN           — shared secret (zorunlu)
//   MJ_BRIDGE_PORT            — HTTP port (default 8780)
//   MJ_BRIDGE_DRIVER          — "mock" | "playwright" (default mock;
//                                gerçek MJ hesabı için "playwright")
//   MJ_BRIDGE_PROFILE         — Persistent profile dir (sadece launch
//                                modunda; attach modunda kullanıcı
//                                browser'ı kendi --user-data-dir flag'iyle
//                                manage eder). Default ./profile
//   MJ_BRIDGE_OUTPUTS         — Job outputs dir (default ./data/outputs)
//   MJ_BRIDGE_JOBLOG          — Job log dir (default ./data/jobs)
//   MJ_BRIDGE_BROWSER_MODE    — "attach" | "launch" (default "attach" —
//                                Pass 47 önerilen). "attach": kullanıcının
//                                başlattığı browser'a CDP ile bağlan.
//                                "launch": bridge yeni browser açar.
//   MJ_BRIDGE_CDP_URL         — Attach modunda CDP endpoint
//                                (default http://127.0.0.1:9222)
//   MJ_BRIDGE_BROWSER_KIND    — Launch modunda binary seçimi:
//                                "chrome" | "brave" | "chromium"
//                                (default "chrome"). Attach modunda
//                                anlamı yok.
//   MJ_BRIDGE_BROWSER_CHANNEL — DEPRECATED — _BROWSER_KIND ile değiştirildi.
//                                Geriye uyumlu olarak hâlâ okunuyor.
//   MJ_BRIDGE_BRAVE_PATH      — Launch + browserKind=brave durumunda
//                                Brave binary path override
//                                (default macOS standard).

import { JobManager } from "./server/job-manager.js";
import { buildServer } from "./server/http.js";
import { MockDriver } from "./drivers/mock.js";
import { PlaywrightDriver } from "./drivers/playwright.js";
import type { BridgeDriver } from "./drivers/types.js";

// Pass 43 — version bumped (real driver ilk versiyon).
const VERSION = "0.2.0"; // package.json ile senkron

async function main(): Promise<void> {
  const token = process.env["MJ_BRIDGE_TOKEN"];
  if (!token) {
    console.error("[mj-bridge] FATAL: MJ_BRIDGE_TOKEN env zorunlu.");
    process.exit(1);
  }
  const port = Number(process.env["MJ_BRIDGE_PORT"] ?? "8780");
  const driverKind = process.env["MJ_BRIDGE_DRIVER"] ?? "mock";
  const profileDir = process.env["MJ_BRIDGE_PROFILE"] ?? "./profile";
  const outputsDir = process.env["MJ_BRIDGE_OUTPUTS"] ?? "./data/outputs";
  const jobLogDir = process.env["MJ_BRIDGE_JOBLOG"] ?? "./data/jobs";

  let driver: BridgeDriver;
  if (driverKind === "playwright") {
    // TOS uyumu — production headless: false. Test için bypass:
    // MJ_BRIDGE_HEADLESS_TEST=1 (sadece testler; üretimde verilmez).
    const headlessForTesting = process.env["MJ_BRIDGE_HEADLESS_TEST"] === "1";
    // Pass 47 — mode selection. Default "attach" (önerilen).
    const modeEnv = process.env["MJ_BRIDGE_BROWSER_MODE"];
    const mode: "attach" | "launch" =
      modeEnv === "launch" ? "launch" : "attach";
    const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
    // Pass 47 — browserKind seçimi (launch modunda kullanılır).
    // Pass 45 _BROWSER_CHANNEL geriye uyumlu mapping.
    const kindEnv = process.env["MJ_BRIDGE_BROWSER_KIND"];
    const channelEnv = process.env["MJ_BRIDGE_BROWSER_CHANNEL"];
    const browserKind: "chrome" | "brave" | "chromium" =
      kindEnv === "brave"
        ? "brave"
        : kindEnv === "chromium" || channelEnv === "chromium"
          ? "chromium"
          : "chrome";
    driver = new PlaywrightDriver({
      mode,
      cdpUrl,
      browserKind,
      profileDir,
      outputsDir,
      headlessForTesting,
    });
  } else if (driverKind === "mock") {
    driver = new MockDriver(outputsDir);
  } else {
    console.error(
      `[mj-bridge] FATAL: MJ_BRIDGE_DRIVER bilinmiyor: ${driverKind}`,
    );
    process.exit(1);
  }

  await driver.init();
  console.log(`[mj-bridge] driver=${driver.id} initialized`);

  const jobManager = new JobManager({ driver, jobLogDir });

  const startedAt = new Date();
  const app = buildServer({
    port,
    token,
    version: VERSION,
    driver,
    jobManager,
    startedAt,
  });

  // Loopback only — design doc §3.3.
  await app.listen({ host: "127.0.0.1", port });
  console.log(`[mj-bridge] listening http://127.0.0.1:${port}`);

  // Graceful shutdown.
  const close = async () => {
    console.log("[mj-bridge] shutting down…");
    await app.close();
    await driver.shutdown();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}

main().catch((err) => {
  console.error("[mj-bridge] FATAL", err);
  process.exit(1);
});
