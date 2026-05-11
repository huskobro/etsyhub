// R7 — GET /api/settings/workspace
//
// Workspace pane'in per-user override semantik view'ı:
//   - Kullanıcının kendi AI provider key'leri (kieApiKey + geminiApiKey
//     mevcut UserSetting key="aiMode" altında saklanıyor — encrypted).
//   - Bu key'ler workspace default'larını override eder; her task için
//     hangisinin aktif olduğunu UI'a sızdırırız.
//
// Body asla plain key döndürmez; sadece presence + son 4 char hint.

import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { getUserAiModeSettings } from "@/features/settings/ai-mode/service";

function maskTail(key: string | null): string | null {
  if (!key) return null;
  if (key.length < 4) return "••••";
  return `••••${key.slice(-4)}`;
}

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const aiMode = await getUserAiModeSettings(user.id);

  const overrides = {
    kie: {
      hasUserKey: !!aiMode.kieApiKey,
      tail: maskTail(aiMode.kieApiKey),
      // Hangi task'ları kullanıcı kendi key'iyle çalıştırıyor
      activeFor: aiMode.kieApiKey
        ? ["variation", "review", "listingCopy", "bgRemoval", "mockup"]
        : [],
    },
    gemini: {
      hasUserKey: !!aiMode.geminiApiKey,
      tail: maskTail(aiMode.geminiApiKey),
      activeFor:
        aiMode.geminiApiKey && aiMode.reviewProvider === "google-gemini"
          ? ["review"]
          : [],
    },
  };

  return NextResponse.json({
    reviewProvider: aiMode.reviewProvider,
    overrides,
  });
});
