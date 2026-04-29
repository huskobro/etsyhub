import type { ReviewProvider } from "./types";

/**
 * KIE.ai üzerinden Gemini 2.5 Flash review provider — STUB (Phase 6 Aşama 1).
 *
 * Bu provider Aşama 2'de implemente edilecek. Şu an `review()` çağrılırsa
 * açıklayıcı hata fırlatır — sessiz boş output yok, kullanıcı UI'da yön
 * verici mesaj görür ("google-gemini'ye geç veya bekle").
 *
 * Aşama 2 için bekleyen dış kontrat bilgileri:
 *   1. KIE.ai endpoint URL (review için)
 *   2. Auth header formatı
 *   3. Sync vs async pattern (createTask + polling kullanılacak mı)
 *   4. Request body: image input format (inlineData base64 / URL / file upload)
 *   5. Response body: envelope shape ({code,msg,data} mı, native passthrough mı)
 *   6. Model id string KIE'de nasıl iletiliyor
 *
 * Phase 5 `kie-shared.ts` paterni reuse edilebilir (envelope, state mapping,
 * polling helper'ları) — KIE review aynı transport'u kullanıyorsa.
 *
 * Provider seçimi runtime `settings.reviewProvider` üzerinden yapılır
 * (`"kie"` | `"google-gemini"`); default `"kie"`.
 */
export const kieGeminiFlashReviewProvider: ReviewProvider = {
  id: "kie-gemini-flash",
  kind: "vision",
  review: async () => {
    throw new Error(
      "kie-gemini-flash review provider not implemented yet (Aşama 2). " +
        "KIE.ai Gemini endpoint kontratı bekleniyor — settings'ten 'google-gemini' " +
        "provider'a geçebilir veya Aşama 2 implementasyonunu bekleyebilirsiniz.",
    );
  },
};
