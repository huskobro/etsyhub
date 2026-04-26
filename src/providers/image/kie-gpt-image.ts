// Provider id (registry-visible): "kie-gpt-image-1.5"
// File name kept short; id is the contract surface.
//
// Phase 5 §4.5 — kie.ai gpt-image-1.5 entegrasyonu.
//
// Sözleşmeler:
//   - Endpoints: POST /api/v1/jobs/createTask + GET /api/v1/jobs/recordInfo
//   - Auth: KIE_AI_API_KEY env (call-time fail-fast, module-load DEĞİL)
//   - Capability: image-to-image + text-to-image (kullanıcı kararı)
//   - referenceUrls: yalnız public HTTP(S) — R17.2 (local→AI bridge YOK)
//   - State mapping: mapKieState helper (R17.1 — bilinmeyen state THROW)
//   - generate() optimistik PROVIDER_PENDING döndürür (kie createTask sync sonuç vermez)
//   - poll() success'te resultJson defensif parse; parse fail → state: FAIL
import { VariationState } from "@prisma/client";
import type {
  ImageGenerateInput,
  ImageGenerateOutput,
  ImagePollOutput,
  ImageProvider,
  ImageCapability,
} from "./types";

const KIE_BASE = "https://api.kie.ai/api/v1";
const KIE_MODEL_I2I = "gpt-image/1.5-image-to-image";

/**
 * kie.ai task state → Prisma VariationState dönüşümü.
 *
 * R17.1: bilinmeyen state için silent fallback YOK; throw eder.
 * Test edilebilirlik için named export.
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

function requireApiKey(): string {
  const key = process.env.KIE_AI_API_KEY;
  if (!key) {
    throw new Error(
      "KIE_AI_API_KEY env var is required for kie-gpt-image-1.5 provider",
    );
  }
  return key;
}

function assertPublicHttpUrls(urls: ReadonlyArray<string> | undefined): void {
  if (!urls || urls.length === 0) return;
  for (const u of urls) {
    if (!/^https?:\/\//i.test(u)) {
      throw new Error(
        "referenceUrls only accepts public HTTP(S) URLs (R17.2)",
      );
    }
  }
}

export class KieGptImageProvider implements ImageProvider {
  readonly id = "kie-gpt-image-1.5";
  readonly capabilities: ReadonlyArray<ImageCapability> = [
    "image-to-image",
    "text-to-image",
  ];

  async generate(input: ImageGenerateInput): Promise<ImageGenerateOutput> {
    const apiKey = requireApiKey();
    assertPublicHttpUrls(input.referenceUrls);

    const body = {
      model: KIE_MODEL_I2I,
      input: {
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio,
        image_urls: input.referenceUrls ?? [],
      },
    };

    const res = await fetch(`${KIE_BASE}/jobs/createTask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`kie.ai HTTP ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    if (json?.code !== 200) {
      throw new Error(`kie.ai API error: ${json?.msg ?? "unknown"}`);
    }
    const taskId = json?.data?.taskId;
    if (typeof taskId !== "string" || taskId.length === 0) {
      throw new Error("kie.ai createTask: missing taskId in response");
    }
    return {
      providerTaskId: taskId,
      state: VariationState.PROVIDER_PENDING,
    };
  }

  async poll(providerTaskId: string): Promise<ImagePollOutput> {
    const apiKey = requireApiKey();
    const url = `${KIE_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(
      providerTaskId,
    )}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`kie.ai HTTP ${res.status}: ${res.statusText}`);
    }
    const json = await res.json();
    if (json?.code !== 200) {
      throw new Error(`kie.ai API error: ${json?.msg ?? "unknown"}`);
    }
    const data = json?.data ?? {};
    const rawState: string | undefined = data.state;
    if (typeof rawState !== "string") {
      throw new Error("kie.ai recordInfo: missing state field");
    }
    const state = mapKieState(rawState);

    if (state === VariationState.SUCCESS) {
      try {
        const parsed =
          typeof data.resultJson === "string"
            ? JSON.parse(data.resultJson)
            : data.resultJson;
        const urls = parsed?.resultUrls;
        if (!Array.isArray(urls)) {
          return {
            state: VariationState.FAIL,
            error: "Result parse failure: resultUrls is not an array",
          };
        }
        return { state: VariationState.SUCCESS, imageUrls: urls };
      } catch (err) {
        return {
          state: VariationState.FAIL,
          error: `Result parse failure: ${(err as Error).message}`,
        };
      }
    }

    if (state === VariationState.FAIL) {
      const error =
        (typeof data.failMsg === "string" && data.failMsg) ||
        (typeof data.failCode === "string" && data.failCode) ||
        "Unknown kie.ai failure";
      return { state: VariationState.FAIL, error };
    }

    return { state };
  }
}
