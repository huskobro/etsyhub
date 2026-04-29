import type { ReviewProvider, ReviewOutput } from "./types";
import { ReviewOutputSchema } from "./output-schema";
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt, REVIEW_PROMPT_VERSION } from "./prompt";
import { imageToInlineData } from "./image-loader";

const GEMINI_MODEL = "gemini-2-5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * Phase 6 cost tracking — CONSERVATIVE ESTIMATE.
 *
 * Bu sabit gerçek Gemini API faturalama DEĞİLDİR; minimum hesap birimi 1 cent
 * (CostUsage Int alan) olduğu için fractional fiyatları (örn. ~$0.001/çağrı)
 * yuvarlamak yerine sabit defansif estimate kullanılır.
 *
 * Real-time pricing carry-forward: `cost-real-time-pricing` (Phase 7+).
 */
const REVIEW_ESTIMATED_COST_CENTS = 1;

/**
 * Google Gemini 2.5 Flash review provider — DIRECT Google API yolu.
 *
 * Phase 6 — multimodal vision review. Per-user `geminiApiKey` settings'ten
 * gelir; options.apiKey caller responsibility (worker resolve eder).
 *
 * **Doğrulama durumu (Aşama 1):** Mock testlerle (vitest) entegre edildi;
 * canlı `geminiApiKey` ile smoke YAPILMADI. Bugünkü ürün kullanımı KIE.ai
 * üzerinden Gemini 2.5 Flash — `kie-gemini-flash` provider'a bak. Provider
 * seçimi runtime `settings.reviewProvider` üzerinden yapılır
 * (`"kie"` | `"google-gemini"`).
 *
 * Hata davranışı (sessiz fallback YASAK):
 * - apiKey boş/whitespace ⇒ throw
 * - HTTP non-2xx ⇒ throw with status + body
 * - candidates boş ⇒ throw "empty candidates"
 * - parts[0].text boş ⇒ throw
 * - JSON.parse fail ⇒ throw
 * - Zod schema fail (bilinmeyen risk flag, score >100, confidence >1) ⇒ throw
 *
 * Snapshot (worker yazar):
 * - reviewProviderSnapshot: "google-gemini-flash@<settingsDate>"
 * - reviewPromptSnapshot: REVIEW_PROMPT_VERSION + REVIEW_SYSTEM_PROMPT
 *
 * Versiyon takip: REVIEW_PROMPT_VERSION = "v1.0".
 */
export const googleGeminiFlashReviewProvider: ReviewProvider = {
  id: "google-gemini-flash",
  // Direct Google API'nin URL formatı hyphen kullanır
  // (`/v1beta/models/gemini-2-5-flash`). KIE'de aynı model dot formatıyla
  // ("gemini-2.5-flash") iletilir — iki farklı string, provider'ın kendi
  // gerçeğini yansıtır. Audit/CostUsage row'u için kanonik kaynak.
  modelId: "gemini-2-5-flash",
  kind: "vision",
  review: async (input, options) => {
    if (!options.apiKey || options.apiKey.trim() === "") {
      throw new Error("api key missing for google-gemini-flash review provider");
    }

    const inline = await imageToInlineData(input.image);
    const userPrompt = buildReviewUserPrompt(input.productType, input.isTransparentTarget);

    const body = {
      contents: [
        {
          parts: [
            { text: REVIEW_SYSTEM_PROMPT + "\n\n" + userPrompt },
            { inlineData: { mimeType: inline.mimeType, data: inline.data } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": options.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000), // 45sn — provider-level inner contract; worker outer guard
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "<no body>");
      throw new Error(`gemini review failed: ${res.status} ${errText.slice(0, 500)}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const candidates = json?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      throw new Error("gemini review failed: empty candidates");
    }
    const text = candidates[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || text.trim() === "") {
      throw new Error("gemini review failed: empty response text");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`gemini review failed: non-JSON output: ${text.slice(0, 200)}`);
    }

    const result = ReviewOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`gemini review failed: invalid output schema: ${result.error.message}`);
    }
    const validated = result.data;
    const output: ReviewOutput = {
      ...validated,
      costCents: REVIEW_ESTIMATED_COST_CENTS,
    };
    return output;
  },
};

// Versiyonu side-effect kullanım için import edilmiş olarak tutuyoruz; direct
// erişim isteyen modüller `prompt.ts`'den import etmeli.
export { REVIEW_PROMPT_VERSION };
