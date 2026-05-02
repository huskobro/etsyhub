import type { ListingMetaAIProvider, ListingMetaOutput } from "./types";
import { ListingMetaOutputSchema, LISTING_META_OUTPUT_JSON_SCHEMA } from "./output-schema";
import { LISTING_META_SYSTEM_PROMPT, buildListingMetaUserPrompt } from "./prompt";

const KIE_ENDPOINT = "https://api.kie.ai/gemini-2.5-flash/v1/chat/completions";
const KIE_MODEL_ID = "gemini-2.5-flash";

// Conservative estimate — Phase 6 emsali (1 cent).
const LISTING_META_ESTIMATED_COST_CENTS = 1;

/**
 * KIE.ai üzerinden Gemini 2.5 Flash listing-meta provider — Phase 9 V1 Task 5.
 *
 * KONTRAT:
 * - Endpoint: POST https://api.kie.ai/gemini-2.5-flash/v1/chat/completions
 * - Auth: Authorization: Bearer <kieApiKey>
 * - OpenAI-compatible chat/completions text-only
 * - response_format strict JSON schema dene; fail ⇒ json_object fallback
 * - Response: choices[0].message.content (JSON string)
 *
 * Sessiz fallback YASAK: HTTP error / JSON parse fail / Zod schema fail
 * → hepsi explicit throw.
 *
 * Snapshot zorunluluğu: Service (generate-meta.service.ts) provider snapshot
 * "{model}@{date}" + LISTING_META_PROMPT_VERSION persist eder (caller
 * sorumluluğunda — V1 foundation: sync result).
 */
export const kieGeminiFlashListingMetaProvider: ListingMetaAIProvider = {
  id: "kie-gemini-flash",
  modelId: KIE_MODEL_ID,
  kind: "text",
  generate: async (input, options): Promise<ListingMetaOutput> => {
    if (!options.apiKey || options.apiKey.trim() === "") {
      throw new Error("api key missing for kie-gemini-flash listing-meta provider");
    }

    const userPrompt = buildListingMetaUserPrompt(input);
    const messages = [
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: LISTING_META_SYSTEM_PROMPT + "\n\n" + userPrompt },
        ],
      },
    ];

    // Strict JSON schema dene
    const strictBody = {
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "listing_meta_output",
          strict: true,
          schema: LISTING_META_OUTPUT_JSON_SCHEMA,
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

    // Strict mode reject ⇒ json_object fallback (Phase 6 emsali)
    if (res.status === 400 || res.status === 422) {
      const errText = await res.text().catch(() => "<no body>");
      const schemaRelated = /response_format|json_schema|strict/i.test(errText);
      if (schemaRelated) {
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
        throw new Error(`kie listing-meta failed: ${res.status} ${errText.slice(0, 500)}`);
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "<no body>");
      throw new Error(`kie listing-meta failed: ${res.status} ${errText.slice(0, 500)}`);
    }

    const json = (await res.json()) as Record<string, unknown>;

    // KIE envelope (drift #4 Phase 6) — code !== 200 ⇒ throw
    const envelopeCode = typeof json.code === "number" ? json.code : null;
    const envelopeMsg = typeof json.msg === "string" ? json.msg : null;
    const hasEnvelope = envelopeCode !== null && envelopeMsg !== null;

    if (hasEnvelope && envelopeCode !== 200) {
      throw new Error(
        `kie listing-meta failed: ${envelopeCode} ${(envelopeMsg ?? "<no msg>").slice(0, 500)}`,
      );
    }

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
      throw new Error("kie listing-meta failed: empty content");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(
        `kie listing-meta failed: non-JSON output: ${content.slice(0, 200).replace(/\s+/g, " ")}`,
      );
    }

    const result = ListingMetaOutputSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`kie listing-meta failed: invalid output schema: ${result.error.message}`);
    }

    return result.data;
  },
};

// Cost estimate dışarı export et — caller (service) snapshot/cost tracking için kullanır.
// V1: provider output'una cost koymuyoruz (review pattern'ında costCents output'ta;
// listing-meta için ayrı tutuyoruz çünkü provider output'u yalnız Etsy schema fields).
export const LISTING_META_KIE_COST_ESTIMATE_CENTS = LISTING_META_ESTIMATED_COST_CENTS;
