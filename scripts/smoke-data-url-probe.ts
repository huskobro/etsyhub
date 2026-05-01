import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { promises as fs } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { getUserAiModeSettings } from "@/features/settings/ai-mode/service";
import { getStorage } from "@/providers/storage";

async function main() {
  const db = new PrismaClient();
  try {
    const admin = await db.user.findUnique({ where: { email: "admin@etsyhub.local" } });
    if (!admin) throw new Error("no admin");
    const settings = await getUserAiModeSettings(admin.id);
    if (!settings.kieApiKey) throw new Error("no kieApiKey");

    // 64x64 transparent fixture from disk (small)
    const fixturePath = path.resolve("tests/fixtures/review/transparent-clean.png");
    const buf = await fs.readFile(fixturePath);
    const base64 = buf.toString("base64");
    const dataUrl = `data:image/png;base64,${base64}`;
    console.log(`Fixture size: ${buf.length} bytes`);
    console.log(`Data URL length: ${dataUrl.length} chars`);

    // KIE chat/completions with data URL image input
    const body = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: 'Reply ONLY with this JSON: {"qualityScore":50,"riskFlags":[],"summary":"probe ok","textDetected":false,"gibberishDetected":false}' },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    };

    const t0 = Date.now();
    const res = await fetch("https://api.kie.ai/gemini-2.5-flash/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.kieApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const dt = Date.now() - t0;
    console.log(`HTTP ${res.status} (${dt}ms)`);
    const text = await res.text();
    console.log("Body:", text.slice(0, 1500));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
