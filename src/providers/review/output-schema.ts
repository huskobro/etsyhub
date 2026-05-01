import { z } from "zod";
import { REVIEW_RISK_FLAG_TYPES } from "./types";

/**
 * Review provider çıktısının kanonik Zod şeması — DRY: hem direct Google
 * Gemini provider hem KIE provider tarafından paylaşılır.
 *
 * `REVIEW_RISK_FLAG_TYPES` (8 sabit) drift koruması olarak `z.enum()` ile
 * doğrulanır; bilinmeyen kind ⇒ explicit throw (sessiz fallback YASAK).
 *
 * Drift #5 (2026-04-30): Alan adı `type` → `kind`. KIE strict JSON schema
 * validator `properties.type` shape'ini JSON Schema reserved word çakışması
 * olarak reddediyor (HTTP 200 + envelope 422). 3 curl probe ile kanıtlandı.
 */
const RiskFlagSchema = z.object({
  kind: z.enum(REVIEW_RISK_FLAG_TYPES),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

export const ReviewOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  textDetected: z.boolean(),
  gibberishDetected: z.boolean(),
  riskFlags: z.array(RiskFlagSchema),
  summary: z.string(),
});

/**
 * KIE / OpenAI-compatible chat/completions `response_format` strict mode
 * için JSON schema (Aşama 2A — KIE provider).
 *
 * Drift #5 reserved-word fix:
 *   - riskFlags item alan adı: `type` → `kind`
 *   - enum girdisi `{ type: "string", enum: [...] }` formuna geçti
 *     (Probe 3 ile doğrulanan KIE'nin kabul ettiği shape — daha güvenli).
 *
 * KIE strict mode desteklemiyorsa provider içinde `{ type: "json_object" }`
 * fallback kullanılır. Heuristic: 400/422 + body'de "response_format|json_schema|strict"
 * geçerse fallback retry; aksi halde gerçek hata olarak throw.
 *
 * NOT (Drift #5 sonrası): KIE artık 200 + envelope-422 ile schema hatası
 * dönebiliyor. Mevcut HTTP 4xx fallback heuristic'i bu durumu YAKALAMAZ —
 * kullanıcı yön kararı: yeni fallback stratejisi icat etme; reserved-word
 * fix ile smoke'u kaldır. Envelope-422 schema-related dispatch ileride
 * gerekirse opsiyonel carry-forward.
 *
 * Not: Direct Google API (google-gemini-flash) `responseMimeType:
 * "application/json"` kullanır; bu schema sadece KIE için relevant.
 */
export const REVIEW_OUTPUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    textDetected: { type: "boolean" },
    gibberishDetected: { type: "boolean" },
    riskFlags: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: REVIEW_RISK_FLAG_TYPES },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          reason: { type: "string", minLength: 1 },
        },
        required: ["kind", "confidence", "reason"],
        additionalProperties: false,
      },
    },
    summary: { type: "string" },
  },
  required: ["score", "textDetected", "gibberishDetected", "riskFlags", "summary"],
  additionalProperties: false,
} as const;
