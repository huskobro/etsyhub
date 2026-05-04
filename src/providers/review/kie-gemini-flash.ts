import type { ReviewProvider, ReviewOutput } from "./types";
import { ReviewOutputSchema, REVIEW_OUTPUT_JSON_SCHEMA } from "./output-schema";
import { REVIEW_SYSTEM_PROMPT, buildReviewUserPrompt } from "./prompt";
import { imageToInlineData } from "./image-loader";

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
 * KIE.ai üzerinden Gemini 2.5 Flash review provider.
 *
 * KONTRAT (kullanıcı KIE docs + 2026-05-01 mikro-probe ile onaylı):
 * - Endpoint: POST https://api.kie.ai/gemini-2.5-flash/v1/chat/completions
 * - Auth: Authorization: Bearer <kieApiKey>
 * - Sync (non-streaming)
 * - OpenAI-compatible chat/completions multimodal
 * - Image input: { type: "image_url", image_url: { url: "<data URL>" } }
 *   - data:image/...;base64,... formatında inline (drift #6 fix —
 *     KIE bulut localhost MinIO'ya erişmek zorunda kalmaz)
 * - response_format strict JSON schema dene; fail ⇒ json_object fallback
 * - Response: choices[0].message.content (JSON string), usage.total_tokens
 *
 * KAPSAM (Aşama 2A → 2B + drift #6 kapanış sonrası):
 * - AI mode (image: { kind: "remote-url" }) çalışır
 * - Local mode (image: { kind: "local-path" }) çalışır — image-loader
 *   data URL inline yapar
 *
 * Sessiz fallback YASAK: HTTP error / JSON parse fail / Zod schema fail / image
 * loader fail → hepsi explicit throw.
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

    // Drift #6 + Aşama 2B kapanış (2026-05-04):
    // Hem local-path hem remote-url için image-loader üzerinden data URL inline.
    // KIE bulut localhost MinIO'ya erişmek zorunda kalmaz; local mode da çalışır.
    // Probe sonucu (2026-05-01 22:10): KIE chat/completions data URL içerikli
    // image_url'i destekliyor (HTTP 200, gerçek cevap döndü).
    const inline = await imageToInlineData(input.image);
    const imageUrl = `data:${inline.mimeType};base64,${inline.data}`;

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

    const json = (await res.json()) as Record<string, unknown>;

    // KIE envelope detection (drift #4 — 2026-04-30):
    // KIE chat/completions endpoint'i HTTP 200 ile { code, msg, data }
    // envelope sarabilir (Phase 5 KIE image endpoint pattern'ıyla aynı).
    // Canlı bakımda gözlemlenen shape: HTTP 200 + body:
    //   { "code": 500, "msg": "The server is currently being maintained..." }
    // Defansif: envelope yoksa (flat OpenAI-compatible), eski yol korunur.
    const envelopeCode = typeof json.code === "number" ? json.code : null;
    const envelopeMsg = typeof json.msg === "string" ? json.msg : null;
    const hasEnvelope = envelopeCode !== null && envelopeMsg !== null;

    if (hasEnvelope && envelopeCode !== 200) {
      throw new Error(
        `kie review failed: ${envelopeCode} ${(envelopeMsg ?? "<no msg>").slice(0, 500)}`,
      );
    }

    // Envelope success ⇒ data'dan body extract; yoksa flat body.
    const body: Record<string, unknown> | undefined = hasEnvelope
      ? (json.data as Record<string, unknown> | undefined)
      : json;

    const choices = (body as { choices?: Array<{ message?: { content?: string } }> } | undefined)
      ?.choices;
    const content =
      Array.isArray(choices) && choices.length > 0
        ? choices[0]?.message?.content
        : undefined;
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
