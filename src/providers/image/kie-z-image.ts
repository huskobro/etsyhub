// Provider id (registry-visible): "kie-z-image"
// File name kept short; id is the contract surface.
//
// Phase 5 Task 4 — kie.ai z-image entegrasyonu (text-to-image only).
//
// Sözleşmeler:
//   - Endpoints: POST /api/v1/jobs/createTask + GET /api/v1/jobs/recordInfo
//     (gpt-image ile aynı omurga; kie-shared modülü paylaşılır).
//   - Auth: KIE_AI_API_KEY env (call-time fail-fast).
//   - Model: "z-image" (KESİN — "z-image/text-to-image" YANLIŞ).
//   - Capability: ["text-to-image"] (TEK; i2i değil).
//   - referenceUrls: boş/undefined OK; uzunluk > 0 ise THROW.
//     Mesaj hem capability mismatch ("text-to-image only") hem product
//     policy ("image-to-image desteklenmiyor; sessiz fallback yapılmadı")
//     içerir. R17.1: silent fallback YOK.
//   - aspectRatio: yalnız "1:1" | "4:3" | "3:4" | "16:9" | "9:16".
//     "2:3" ve "3:2" THROW. R17.1: silent fallback YOK (gpt-image hepsini
//     destekler; z-image runtime'da daraltır).
//   - Body shape: { model: "z-image", input: { prompt, aspect_ratio } }.
//     image_urls ALAN OLARAK YOK — text-to-image only.
//   - State mapping & poll defensif parse: kie-shared.parsePollResponse.
//   - R17.2 (local→AI bridge yok): z-image referenceUrls'ü kapasite
//     seviyesinde reddeder; assertPublicHttpUrls guard'ına hiç düşmez.
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
  parseKieEnvelope,
  parsePollResponse,
  requireApiKey,
} from "./kie-shared";

const PROVIDER_ID = "kie-z-image";
const KIE_MODEL_Z = "z-image";

// kie.ai z-image desteklenen aspect ratio seti (resmi docs):
const SUPPORTED_ASPECT_RATIOS: ReadonlyArray<string> = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
];

function assertSupportedAspectRatio(ratio: string): void {
  if (!SUPPORTED_ASPECT_RATIOS.includes(ratio)) {
    throw new Error(
      `kie-z-image does not support aspect ratio '${ratio}'; supported: ${SUPPORTED_ASPECT_RATIOS.join(
        ", ",
      )} (R17.1: silent fallback yok)`,
    );
  }
}

function assertNoReferenceUrls(
  urls: ReadonlyArray<string> | undefined,
): void {
  // boş array veya undefined OK; sadece uzunluk > 0 reddedilir.
  if (!urls || urls.length === 0) return;
  throw new Error(
    "kie-z-image is text-to-image only; referenceUrls not supported " +
      "(image-to-image desteklenmiyor; sessiz fallback yapılmadı)",
  );
}

export class KieZImageProvider implements ImageProvider {
  readonly id = PROVIDER_ID;
  readonly capabilities: ReadonlyArray<ImageCapability> = ["text-to-image"];

  async generate(input: ImageGenerateInput): Promise<ImageGenerateOutput> {
    // 1) Capability guard ÖNCE — fetch çağrısından önce hata.
    assertNoReferenceUrls(input.referenceUrls);
    // 2) aspectRatio runtime guard (TS ImageAspectRatio 7 değer içerir;
    //    z-image 5'e daraltır — runtime'da yakalanır).
    assertSupportedAspectRatio(input.aspectRatio);
    // 3) Env fail-fast (call-time).
    const apiKey = requireApiKey(PROVIDER_ID);

    const body = {
      model: KIE_MODEL_Z,
      input: {
        prompt: input.prompt,
        aspect_ratio: input.aspectRatio,
        // image_urls: text-to-image only — body'de YOK.
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
