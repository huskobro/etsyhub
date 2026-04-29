// User Settings — ai-mode — Phase 5 §8, Task 15 + Phase 6 Aşama 1
//
// Güvenlik kuralları:
// - GET: anahtarlar plain text DÖNMEZ. Var ise "•••••" (mask), yoksa null.
//   `reviewProvider` plain döner (sır değil, runtime tercih).
// - PUT: boş string → mevcut değer KORUNUR (preserve). Null → 400 (anlamsız:
//   bu surface üzerinden explicit silme yok; gelecek geliştirme için ayrı buton
//   açılabilir). Dolu string yeni değeri yazar. `reviewProvider` zorunlu enum.
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
import { ReviewProviderChoiceSchema } from "@/features/settings/ai-mode/schemas";

const MASK = "•••••";

const PutBody = z.object({
  // Boş string preserve sentinel; null reject (400). Dolu string → write.
  kieApiKey: z.string(),
  geminiApiKey: z.string(),
  // Phase 6 Aşama 1: review provider runtime seçimi. Default "kie" — body'de
  // yoksa Zod default doldurur (eski client backwards compat).
  reviewProvider: ReviewProviderChoiceSchema.default("kie"),
});

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const current = await getUserAiModeSettings(user.id);
  return NextResponse.json({
    settings: {
      kieApiKey: current.kieApiKey ? MASK : null,
      geminiApiKey: current.geminiApiKey ? MASK : null,
      reviewProvider: current.reviewProvider,
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
    reviewProvider: parsed.data.reviewProvider,
  };
  await updateUserAiModeSettings(user.id, next);

  // Response: PUT'tan da masked döner — plain key asla wire'a çıkmaz.
  return NextResponse.json({
    settings: {
      kieApiKey: next.kieApiKey ? MASK : null,
      geminiApiKey: next.geminiApiKey ? MASK : null,
      reviewProvider: next.reviewProvider,
    },
  });
});
