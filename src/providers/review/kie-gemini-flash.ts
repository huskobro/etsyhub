import type { ReviewProvider, ReviewOutput } from "./types";
import { ReviewOutputSchema, REVIEW_OUTPUT_JSON_SCHEMA } from "./output-schema";
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } from "./prompt";

const KIE_ENDPOINT = "https://api.kie.ai/gemini-2.5-flash/v1/chat/completions";
const KIE_MODEL_ID = "gemini-2.5-flash";

/**
 * Phase 6 cost tracking — CONSERVATIVE ESTIMATE.
 *
 * Bu sabit gerçek KIE/Gemini API faturalama DEĞİLDİR; minimum hesap birimi
 * 1 cent (CostUsage Int alan) olduğu için fractional fiyatları (örn.
 * ~$0.001/çağrı) yuvarlamak yerine sabit defansif estimate kullanılır.
 *
 * Real-time pricing carry-forward: `cost-real-time-pricing` (Phase 7+).
 */
const REVIEW_ESTIMATED_COST_CENTS = 1;

/**
 * KIE.ai üzerinden Gemini 2.5 Flash review provider — Aşama 2A.
 *
 * KONTRAT (kullanıcı KIE docs'tan onayladı):
 * - Endpoint: POST https://api.kie.ai/gemini-2.5-flash/v1/chat/completions
 * - Auth: Authorization: Bearer <kieApiKey>
 * - Sync (non-streaming)
 * - OpenAI-compatible chat/completions multimodal
 * - Image input: { type: "image_url", image_url: { url: "<https URL>" } }
 *   - DIŞ ERİŞİLEBİLİR HTTP/HTTPS URL gerek (data URL Aşama 2B'de probe edilir)
 * - response_format strict JSON schema dene; fail ⇒ json_object fallback
 * - Response: choices[0].message.content (JSON string), usage.total_tokens
 *
 * AŞAMA 2A KAPSAMI:
 * - SADECE AI mode (image: { kind: "remote-url" }) çalışır
 * - Local mode (image: { kind: "local-path" }) explicit throw "2B bekleniyor"
 *
 * Sessiz fallback YASAK: HTTP error / JSON parse fail / Zod schema fail / image
 * input local path → hepsi explicit throw.
 *
 * Snapshot zorunluluğu: Worker (review-design.worker.ts) reviewProviderSnapshot
 * "kie-gemini-flash@<settingsDate>" + reviewPromptSnapshot persist eder.
 */
export const kieGeminiFlashReviewProvider: ReviewProvider = {
  id: "kie-gemini-flash",
  modelId: KIE_MODEL_ID,
  kind: "vision",
  review: async (input, options): Promise<ReviewOutput> => {
    if (!options.apiKey || options.apiKey.trim() === "") {
      throw new Error("api key missing for kie-gemini-flash review provider");
    }

    // Aşama 2A: local mode için explicit throw (2B bekliyor).
    // Yön mesajı kullanıcıya UI'da görünür — data URL probe smoke sonrası
    // kapsam (küçük patch / orta MinIO upload) netleşecek.
    if (input.image.kind === "local-path") {
      throw new Error(
        "KIE local review henüz etkin değil; Aşama 2B bekleniyor.",
      );
    }

    // Remote URL — KIE direkt fetch eder (signed URL veya kalıcı public URL).
    const imageUrl = input.image.url;
    const userPrompt = buildReviewUserPrompt(input.productType, input.isTransparentTarget);

    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: REVIEW_SYSTEM_PROMPT + "\n\n" + userPrompt },
          { type: "image_url" as const, image_url: { url: imageUrl } },
        ],
      },
    ];

    // Strict JSON schema dene (response_format json_schema strict mode).
    // KIE strict modu desteklemiyorsa heuristic fallback'e geç.
    const strictBody = {
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "review_output",
          strict: true,
          schema: REVIEW_OUTPUT_JSON_SCHEMA,
        },
      },
    };

    let res = await fetch(KIE_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(strictBody),
      signal: AbortSignal.timeout(45_000),
    });

    // Strict mode reddedilirse fallback (400/422 + schema-related body).
    // Heuristic — KIE error message format'ı bilinmiyor; smoke'ta gerçek
    // davranış görülünce gerekirse fix.
    if (res.status === 400 || res.status === 422) {
      const errText = await res.text().catch(() => "<no body>");
      const schemaRelated = /response_format|json_schema|strict/i.test(errText);
      if (schemaRelated) {
        // Fallback: json_object mode (OpenAI-compatible).
        const fallbackBody = {
          messages,
          response_format: { type: "json_object" },
        };
        res = await fetch(KIE_ENDPOINT, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(fallbackBody),
          signal: AbortSignal.timeout(45_000),
        });
      } else {
        // Diğer 400/422 — schema dışı (örn. rate limit, invalid payload).
        throw new Error(`kie review failed: ${res.status} ${errText.slice(0, 500)}`);
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "<no body>");
      throw new Error(`kie review failed: ${res.status} ${errText.slice(0, 500)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      model?: string;
    };
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new Error("kie review failed: empty content");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(
        `kie review failed: non-JSON output: ${content.slice(0, 200).replace(/\s+/g, " ")}`,
      );
    }

    const result = ReviewOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`kie review failed: invalid output schema: ${result.error.message}`);
    }

    return {
      ...result.data,
      costCents: REVIEW_ESTIMATED_COST_CENTS,
    };
  },
};
