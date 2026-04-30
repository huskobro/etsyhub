// KIE Gemini review endpoint health probe
// Phase 6 Aşama 2A canlı smoke için bakım durumu kontrolü.
// Admin user UserSetting `aiMode.kieApiKey` (encrypted at rest) decrypt edilir.

import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import { getUserAiModeSettings } from "@/features/settings/ai-mode/service";

const ADMIN_EMAIL = "admin@etsyhub.local";
const KIE_GEMINI_ENDPOINT = "https://api.kie.ai/gemini-2.5-flash/v1/chat/completions";

async function main() {
  const db = new PrismaClient();
  try {
    const admin = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (!admin) {
      console.log("FAIL admin user not found:", ADMIN_EMAIL);
      process.exit(2);
    }

    const settings = await getUserAiModeSettings(admin.id);
    if (!settings.kieApiKey) {
      console.log("FAIL kieApiKey not set in admin AI Mode settings");
      process.exit(3);
    }

    console.log(`OK kieApiKey decrypted (length=${settings.kieApiKey.length})`);
    console.log(`Probe: ${KIE_GEMINI_ENDPOINT}`);

    const reqBody = {
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 16,
    };

    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(KIE_GEMINI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.kieApiKey}`,
        },
        body: JSON.stringify(reqBody),
      });
    } catch (e: any) {
      console.log(`FAIL network error: ${e.message}`);
      process.exit(4);
    }
    const dt = Date.now() - t0;

    const text = await res.text();
    console.log(`HTTP status: ${res.status} (${dt}ms)`);
    console.log("Response body (first 1200 chars):");
    console.log(text.substring(0, 1200));

    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      console.log("FAIL Response JSON parse edilemedi");
      process.exit(5);
    }

    if (typeof json.code === "number") {
      console.log(`\nEnvelope: code=${json.code}, msg="${json.msg ?? ""}"`);
      if (
        json.code === 500 &&
        /maintenance|bakım|maintain/i.test(String(json.msg ?? ""))
      ) {
        console.log("\nRESULT: KIE Gemini hala MAINTENANCE durumunda (envelope code:500)");
        console.log("Karar: Dal 2B (Phase 7 implementation execution)");
        process.exit(10);
      }
      if (json.code !== 200 && json.code !== 0) {
        console.log(`\nRESULT: KIE Gemini error envelope code=${json.code}`);
        console.log("Karar: Dal 2B (envelope error, smoke yapilamaz)");
        process.exit(11);
      }
    }

    if (json.choices && Array.isArray(json.choices) && json.choices.length > 0) {
      const content = json.choices[0]?.message?.content;
      console.log(`\nRESULT: KIE Gemini HEALTHY. content="${(content ?? "").substring(0, 100)}"`);
      console.log("Karar: Dal 2A (Phase 6 smoke retry)");
      process.exit(0);
    }

    if (json.data?.choices && Array.isArray(json.data.choices)) {
      const content = json.data.choices[0]?.message?.content;
      console.log(`\nRESULT: KIE Gemini HEALTHY (envelope data.choices). content="${(content ?? "").substring(0, 100)}"`);
      console.log("Karar: Dal 2A");
      process.exit(0);
    }

    console.log("\nRESULT: Belirsiz response shape");
    process.exit(20);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("[health-probe] FAIL:", e.message);
  process.exit(1);
});
