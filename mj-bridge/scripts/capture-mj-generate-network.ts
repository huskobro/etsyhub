// Pass 69 — MJ tab'ında live network capture (generate için).
//
// Aşama 2A audit kanıtladı: eklenti generate için /api/jobs/submit'i
// autojourney 3rd-party backend'e gönderiyor; MJ kendi domain'ine giden
// fetch hiç yok. Ama MJ web UI'sının kendisi prompt submit ettiğinde
// hangi endpoint'e POST atıyor (eğer atıyorsa) — bunu capture etmek
// generate API path için tek somut yol.
//
// Kullanıcı MJ tab'ında imagine bar'a prompt yazıp Enter bastıktan sonra
// trafiği yakala.

import { chromium, type Request, type Response } from "playwright";
import { appendFile, writeFile } from "node:fs/promises";

const CDP_URL = process.env["MJ_BRIDGE_CDP_URL"] ?? "http://127.0.0.1:9222";
const OUT = "/tmp/mj-generate-trace.jsonl";

async function main() {
  await writeFile(OUT, "");
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 10_000 });
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error("CDP yok");
  const observed = new Set<number>();
  let exchangeId = 0;
  function attach(page: import("playwright").Page) {
    if (observed.has(page.url().length)) return;
    observed.add(page.url().length);
    page.on("request", async (req: Request) => {
      try {
        const url = req.url();
        if (!/midjourney\.com\/api\//.test(url) && !/autojourney|apijourney/.test(url)) return;
        const id = ++exchangeId;
        const body = (() => {
          try { return req.postData(); } catch { return null; }
        })();
        const entry = {
          id, ts: new Date().toISOString(), dir: "REQ",
          method: req.method(), url,
          headers: req.headers(),
          body: body?.slice(0, 4000) ?? null,
          resourceType: req.resourceType(),
        };
        await appendFile(OUT, JSON.stringify(entry) + "\n");
        // eslint-disable-next-line no-console
        console.log(`[${id}] REQ ${req.method()} ${url.slice(0, 120)}`);
      } catch {}
    });
    page.on("response", async (res: Response) => {
      try {
        const url = res.url();
        if (!/midjourney\.com\/api\//.test(url) && !/autojourney|apijourney/.test(url)) return;
        const id = ++exchangeId;
        let body: string | null = null;
        try { const t = await res.text(); body = t.slice(0, 4000); } catch {}
        const entry = { id, ts: new Date().toISOString(), dir: "RES", status: res.status(), url, headers: res.headers(), body };
        await appendFile(OUT, JSON.stringify(entry) + "\n");
        // eslint-disable-next-line no-console
        console.log(`[${id}] RES ${res.status()} ${url.slice(0, 120)}`);
      } catch {}
    });
  }
  for (const p of ctx.pages()) attach(p);
  ctx.on("page", attach);
  // eslint-disable-next-line no-console
  console.log("[capture] LIVE — MJ tab'ında bir prompt yaz + Enter / Submit. 3 dakika dinleniyor.");
  console.log(`[capture] log: ${OUT}`);
  await new Promise((r) => setTimeout(r, 3 * 60_000));
  // eslint-disable-next-line no-console
  console.log("[capture] timeout, exiting");
}

main().catch((err) => { console.error(err); process.exit(1); });
