// User Settings — ai-mode — Phase 5 §8, Task 15
//
// Güvenlik kuralları:
// - GET: anahtarlar plain text DÖNMEZ. Var ise "•••••" (mask), yoksa null.
// - PUT: boş string → mevcut değer KORUNUR (preserve). Null → 400 (anlamsız:
//   bu surface üzerinden explicit silme yok; gelecek geliştirme için ayrı buton
//   açılabilir). Dolu string yeni değeri yazar.
// - WHY: Mask + preserve, formun "şifreyi göstermeden değiştirmeden geçme"
//   kullanım davranışını gerektiriyor; aksi takdirde GET → form re-PUT cycle'ında
//   anahtar yanlışlıkla "•••••" olarak persist edilir.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  getUserAiModeSettings,
  updateUserAiModeSettings,
} from "@/features/settings/ai-mode/service";

const MASK = "•••••";

const PutBody = z.object({
  // Boş string preserve sentinel; null reject (400). Dolu string → write.
  kieApiKey: z.string(),
  geminiApiKey: z.string(),
});

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const current = await getUserAiModeSettings(user.id);
  return NextResponse.json({
    settings: {
      kieApiKey: current.kieApiKey ? MASK : null,
      geminiApiKey: current.geminiApiKey ? MASK : null,
    },
  });
});

export const PUT = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const json = await req.json().catch(() => null);
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  // Preserve-on-empty: mevcut değeri çek; boş string → eskisini koru.
  const existing = await getUserAiModeSettings(user.id);
  const next = {
    kieApiKey:
      parsed.data.kieApiKey === "" ? existing.kieApiKey : parsed.data.kieApiKey,
    geminiApiKey:
      parsed.data.geminiApiKey === ""
        ? existing.geminiApiKey
        : parsed.data.geminiApiKey,
  };
  await updateUserAiModeSettings(user.id, next);

  // Response: PUT'tan da masked döner — plain key asla wire'a çıkmaz.
  return NextResponse.json({
    settings: {
      kieApiKey: next.kieApiKey ? MASK : null,
      geminiApiKey: next.geminiApiKey ? MASK : null,
    },
  });
});
