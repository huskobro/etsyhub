// Pass 48 — CDP endpoint pre-check.
//
// Bridge'i başlatmadan önce kullanıcıya browser'ın doğru flag'lerle
// açılıp açılmadığını söyler. Üç durumu ayırır:
//   1. Connection refused: browser hiç çalışmıyor veya
//      --remote-debugging-port flag'i yok
//   2. HTTP cevap geldi ama /json/version değil: yanlış endpoint
//      (ör. başka bir DevTools server)
//   3. /json/version OK: CDP hazır + browser tab listesi de gösterilir
//
// Çalıştır:
//   $ cd mj-bridge
//   $ npx tsx scripts/check-cdp.ts
//   $ MJ_BRIDGE_CDP_URL=http://127.0.0.1:9223 npx tsx scripts/check-cdp.ts

const cdpUrl = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";

type CdpVersion = {
  Browser?: string;
  "Protocol-Version"?: string;
  "User-Agent"?: string;
  webSocketDebuggerUrl?: string;
};

type CdpTab = {
  id: string;
  type: string;
  title: string;
  url: string;
};

async function fetchJson<T>(url: string, timeoutMs = 5000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  console.log(`[check-cdp] CDP endpoint: ${cdpUrl}`);

  // 1. /json/version
  let version: CdpVersion;
  try {
    version = await fetchJson<CdpVersion>(`${cdpUrl}/json/version`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n[check-cdp] ❌ FAIL: ${msg}`);
    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("fetch failed") ||
      msg.includes("aborted")
    ) {
      console.error(`
Browser şu komutla başlatılmalı:

  # Brave (önerilen — kullanıcı şu an Brave kullanıyor):
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \\
    --remote-debugging-port=9222 \\
    --user-data-dir="$HOME/.mj-bridge-brave-profile"

  # veya Chrome:
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\
    --remote-debugging-port=9222 \\
    --user-data-dir="$HOME/.mj-bridge-chrome-profile"

ÖNEMLI: Brave/Chrome'un mevcut tüm pencerelerini Cmd+Q ile tamamen
kapatın, sonra yukarıdaki komutu çalıştırın. Aynı binary için aynı
anda iki proses açılamaz.
`);
    }
    process.exit(1);
  }

  console.log(`\n[check-cdp] ✓ CDP version OK`);
  console.log(`  Browser:          ${version.Browser ?? "?"}`);
  console.log(`  Protocol:         ${version["Protocol-Version"] ?? "?"}`);
  console.log(`  User-Agent:       ${(version["User-Agent"] ?? "?").slice(0, 80)}`);
  console.log(`  WebSocket URL:    ${version.webSocketDebuggerUrl ?? "?"}`);

  // 2. /json (tab list)
  let tabs: CdpTab[] = [];
  try {
    tabs = await fetchJson<CdpTab[]>(`${cdpUrl}/json`);
  } catch (err) {
    console.warn(
      `\n[check-cdp] ⚠ /json (tab list) fail:`,
      err instanceof Error ? err.message : String(err),
    );
  }

  console.log(`\n[check-cdp] Açık ${tabs.length} tab/target:`);
  let mjTabFound = false;
  for (const t of tabs.slice(0, 15)) {
    const isMJ = t.url.includes("midjourney.com");
    if (isMJ) mjTabFound = true;
    const marker = isMJ ? " ← MJ" : "";
    console.log(
      `  [${t.type}] ${t.title.slice(0, 50)}${marker}\n      ${t.url.slice(0, 80)}`,
    );
  }

  if (!mjTabFound) {
    console.log(`\n[check-cdp] ⚠ midjourney.com tab'ı bulunamadı.`);
    console.log(
      `  Bridge attach modunda yeni tab açabilir, ama önce ÖNERİ:`,
    );
    console.log(`  1. Açık Brave/Chrome penceresinde yeni tab aç`);
    console.log(`  2. https://www.midjourney.com 'a git`);
    console.log(`  3. Cloudflare doğrulamasını çöz (gelirse)`);
    console.log(`  4. Discord/Google ile login ol`);
    console.log(`  5. Tab'ı AÇIK BIRAK`);
    console.log(`  6. Bu script'i tekrar çalıştır → MJ tab gözükmeli`);
  } else {
    console.log(`\n[check-cdp] ✓ MJ tab açık, attach hazır.`);
    console.log(`Bridge'i başlatmak için:`);
    console.log(`  cd mj-bridge`);
    console.log(`  MJ_BRIDGE_TOKEN=secret \\`);
    console.log(`    MJ_BRIDGE_DRIVER=playwright \\`);
    console.log(`    MJ_BRIDGE_BROWSER_MODE=attach \\`);
    console.log(`    MJ_BRIDGE_CDP_URL=${cdpUrl} \\`);
    console.log(`    npm run dev`);
  }
}

main().catch((err) => {
  console.error("[check-cdp] FATAL:", err);
  process.exit(1);
});
