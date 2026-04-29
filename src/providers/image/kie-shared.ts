// kie.ai ortak transport / state mapping helper'ları (Phase 5).
//
// İki provider (kie-gpt-image-1.5, kie-z-image) aynı omurgayı paylaşır:
//   - createTask: POST /api/v1/jobs/createTask
//   - recordInfo: GET  /api/v1/jobs/recordInfo?taskId=...
//   - envelope: { code, msg, data }
//   - state seti: waiting | queuing | generating | success | fail
//   - resultJson: success durumunda { resultUrls: string[] }
//
// Bu modül davranış değiştirmeyen refactor olarak çıkarıldı: helper'lar
// gpt-image'tan birebir taşındı; testler dolaylı (provider testleri) ve
// doğrudan (kie-shared.test.ts) yeşil kalır.
//
// R17.1: bilinmeyen state için silent fallback YOK — throw.
// R17.2: local→AI bridge yok; URL guard provider seviyesinde uygulanır
//        (assertPublicHttpUrls helper'ı burada export edilir, gpt-image kullanır,
//        z-image text-to-image olduğu için referenceUrls'ü guard'dan ÖNCE reddeder).
//
// Phase 5 closeout hotfix (2026-04-29): `requireApiKey` env helper SİLİNDİ.
// Provider'lar artık caller-resolved per-user `apiKey`'i `ImageGenerateOptions`
// üzerinden alır (Phase 6 review provider simetrisi). Boş/whitespace key
// durumunda explicit throw provider içinde yapılır — env'den okuma YASAK.
import { VariationState } from "@prisma/client";

export const KIE_BASE = "https://api.kie.ai/api/v1";

/**
 * Caller-resolved per-user API key validasyonu (Phase 5 closeout hotfix).
 *
 * `ImageGenerateOptions.apiKey` boş / yalnız whitespace ise explicit throw.
 * Mesaj kullanıcıya yön gösterir: "Settings → AI Mode'dan KIE anahtarı girin".
 * Sessiz fallback YASAK (R17.1).
 */
export function assertApiKey(providerId: string, apiKey: string): void {
  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      `api key missing for ${providerId} provider — Settings → AI Mode'dan KIE anahtarı girin`,
    );
  }
}

/**
 * kie.ai task state → Prisma VariationState dönüşümü.
 *
 * R17.1: bilinmeyen state için silent fallback YOK; throw eder.
 */
export function mapKieState(state: string): VariationState {
  switch (state) {
    case "waiting":
    case "queuing":
      return VariationState.PROVIDER_PENDING;
    case "generating":
      return VariationState.PROVIDER_RUNNING;
    case "success":
      return VariationState.SUCCESS;
    case "fail":
      return VariationState.FAIL;
    default:
      throw new Error(`Unknown kie.ai state: ${state}`);
  }
}

/**
 * Public HTTP(S) URL guard (R17.2 — local→AI bridge yok).
 *
 * Yalnız gpt-image (image-to-image capability) kullanır; z-image
 * text-to-image olduğu için referenceUrls'ü kapasite seviyesinde
 * (bu guard'a hiç düşmeden) reddeder.
 */
export function assertPublicHttpUrls(
  urls: ReadonlyArray<string> | undefined,
): void {
  if (!urls || urls.length === 0) return;
  for (const u of urls) {
    if (!/^https?:\/\//i.test(u)) {
      throw new Error(
        "referenceUrls only accepts public HTTP(S) URLs (R17.2)",
      );
    }
  }
}

/**
 * kie.ai zarf yapısı: { code, msg, data } — code !== 200 ise throw.
 *
 * data alanını generic tip ile dışa veriri.
 */
export function parseKieEnvelope<T>(json: unknown): T {
  const obj = json as { code?: number; msg?: string; data?: unknown } | null;
  if (!obj || obj.code !== 200) {
    throw new Error(`kie.ai API error: ${obj?.msg ?? "unknown"}`);
  }
  return obj.data as T;
}

/**
 * recordInfo cevabını ortak şekilde yorumlar:
 *   - state mapping (R17.1: unknown throw)
 *   - SUCCESS → resultJson defensif parse; bozuk → state:FAIL + error
 *   - FAIL → failMsg yoksa failCode fallback, ikisi de yoksa generic
 *   - PENDING/RUNNING → sadece state
 *
 * Throw yalnız: missing state / unknown state.
 */
export function parsePollResponse(data: unknown): {
  state: VariationState;
  imageUrls?: string[];
  error?: string;
} {
  const d = (data ?? {}) as Record<string, unknown>;
  const rawState = d.state;
  if (typeof rawState !== "string") {
    throw new Error("kie.ai recordInfo: missing state field");
  }
  const state = mapKieState(rawState);

  if (state === VariationState.SUCCESS) {
    try {
      const parsed =
        typeof d.resultJson === "string"
          ? JSON.parse(d.resultJson)
          : d.resultJson;
      const urls = (parsed as { resultUrls?: unknown } | null)?.resultUrls;
      if (!Array.isArray(urls)) {
        return {
          state: VariationState.FAIL,
          error: "Result parse failure: resultUrls is not an array",
        };
      }
      return { state: VariationState.SUCCESS, imageUrls: urls as string[] };
    } catch (err) {
      return {
        state: VariationState.FAIL,
        error: `Result parse failure: ${(err as Error).message}`,
      };
    }
  }

  if (state === VariationState.FAIL) {
    const failMsg = typeof d.failMsg === "string" ? d.failMsg : "";
    const failCode = typeof d.failCode === "string" ? d.failCode : "";
    const error = failMsg || failCode || "Unknown kie.ai failure";
    return { state: VariationState.FAIL, error };
  }

  return { state };
}
