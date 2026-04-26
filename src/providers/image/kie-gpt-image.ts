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
//   - State mapping: kie-shared.mapKieState (R17.1 — bilinmeyen state THROW)
//   - generate() optimistik PROVIDER_PENDING döndürür (kie createTask sync sonuç vermez)
//   - poll() success'te resultJson defensif parse; parse fail → state: FAIL
//
// Davranış değiştirmeyen refactor: ortak helper'lar `./kie-shared` modülüne
// taşındı; bu dosya artık sadece gpt-image-spesifik HTTP iskeletini taşır.
import { VariationState } from "@prisma/client";
import type {
  ImageGenerateInput,
  ImageGenerateOutput,
  ImagePollOutput,
  ImageProvider,
  ImageCapability,
} from "./types";
import {
  KIE_BASE,
  assertPublicHttpUrls,
  mapKieState,
  parseKieEnvelope,
  parsePollResponse,
  requireApiKey,
} from "./kie-shared";

const KIE_MODEL_I2I = "gpt-image/1.5-image-to-image";
const PROVIDER_ID = "kie-gpt-image-1.5";

// Test backwards-compat: kie-gpt-image-provider testleri `mapKieState`'i bu
// modülden import ediyor. kie-shared'a taşıdıktan sonra burada re-export.
export { mapKieState };

export class KieGptImageProvider implements ImageProvider {
  readonly id = PROVIDER_ID;
  readonly capabilities: ReadonlyArray<ImageCapability> = [
    "image-to-image",
    "text-to-image",
  ];

  async generate(input: ImageGenerateInput): Promise<ImageGenerateOutput> {
    const apiKey = requireApiKey(PROVIDER_ID);
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
    const data = parseKieEnvelope<{ taskId?: string }>(json);
    const taskId = data?.taskId;
    if (typeof taskId !== "string" || taskId.length === 0) {
      throw new Error("kie.ai createTask: missing taskId in response");
    }
    return {
      providerTaskId: taskId,
      state: VariationState.PROVIDER_PENDING,
    };
  }

  async poll(providerTaskId: string): Promise<ImagePollOutput> {
    const apiKey = requireApiKey(PROVIDER_ID);
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
    const data = parseKieEnvelope<unknown>(json);
    return parsePollResponse(data);
  }
}
