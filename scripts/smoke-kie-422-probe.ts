import "./_bootstrap-env";

import { PrismaClient } from "@prisma/client";
import { getUserAiModeSettings } from "@/features/settings/ai-mode/service";

async function main() {
  const db = new PrismaClient();
  try {
    const admin = await db.user.findUnique({ where: { email: "admin@etsyhub.local" } });
    if (!admin) throw new Error("no admin");
    const settings = await getUserAiModeSettings(admin.id);
    if (!settings.kieApiKey) throw new Error("no kieApiKey");

    // Strict schema body — provider'ın gönderdiğiyle aynı
    const body = {
      messages: [{ role: "user", content: "ping" }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "review_output",
          strict: true,
          schema: {
            type: "object",
            properties: {
              qualityScore: { type: "integer", minimum: 0, maximum: 100 },
              riskFlags: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["watermark_detected", "signature_detected"],
                    },
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
    console.log(`HTTP ${res.status}`);
    const text = await res.text();
    console.log("Body:", text.slice(0, 1500));
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
