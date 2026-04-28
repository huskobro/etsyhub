import type { ReviewProvider } from "./types";

/**
 * Gemini 2.5 Flash review provider — STUB.
 *
 * Task 3'te sadece registry kaydının yapılabilmesi için iskelet.
 * Task 4'te `review()` fonksiyonu gerçek Gemini API çağrısı (multimodal,
 * JSON output, Zod schema) ile değişecek.
 *
 * Şu an `review()` çağrılırsa açıklayıcı hata fırlatır — sessiz boş output yok.
 */
export const geminiFlashReviewProvider: ReviewProvider = {
  id: "gemini-2-5-flash",
  kind: "vision",
  review: async () => {
    throw new Error("gemini-2-5-flash review provider not implemented yet (Task 4)");
  },
};
