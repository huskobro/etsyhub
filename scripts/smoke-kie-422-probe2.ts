import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(process.cwd(), ".env.local") });

import { PrismaClient } from "@prisma/client";
import { getUserAiModeSettings } from "@/features/settings/ai-mode/service";

async function main() {
  const db = new PrismaClient();
  try {
    const admin = await db.user.findUnique({ where: { email: "admin@etsyhub.local" } });
    if (!admin) throw new Error("no admin");
    const settings = await getUserAiModeSettings(admin.id);
    if (!settings.kieApiKey) throw new Error("no kieApiKey");

    // Test 1: enum kaldırılmış string — sadece type:"string"
    const body = {
      messages: [{ role: "user", content: 'Reply with JSON: {"qualityScore":50,"riskFlags":[]}' }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "review_output",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              qualityScore: { type: "integer" },
              riskFlags: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    type: { type: "string" },  // enum yok
                  },
                  required: ["type"],
                },
              },
            },
            required: ["qualityScore", "riskFlags"],
          },
        },
      },
    };

    const res = await fetch("https://api.kie.ai/gemini-2.5-flash/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.kieApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    console.log(`Test 1 (no enum): HTTP ${res.status}`);
    const text = await res.text();
    console.log("Body:", text.slice(0, 1200));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
