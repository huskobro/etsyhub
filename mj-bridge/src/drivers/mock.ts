// Mock driver — gerçek MJ hesabı olmadan end-to-end test için.
//
// Davranış: bir generate job'u QUEUED → OPENING_BROWSER → AWAITING_LOGIN
// (kısa) → SUBMITTING_PROMPT → WAITING_FOR_RENDER → COLLECTING_OUTPUTS →
// DOWNLOADING → COMPLETED state'lerinden 200ms aralıklarla geçirir.
//
// Output dosyaları: bridge `data/outputs/{job-id}/{0..3}.png` yoluna
// renkli SVG-via-PNG fixture yazar (4 grid item simülasyonu). Renkler
// gridIndex'e göre değişir (kırmızı/yeşil/mavi/turuncu).
//
// Caller (job manager) bu çıktıları üretirken `onProgress` callback'i
// her transition'da çağırır.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BridgeDriver, DriverProgressCallback } from "./types.js";
import type { CreateJobRequest } from "../types.js";

const STATE_TRANSITIONS: Array<{
  ms: number;
  next: Parameters<DriverProgressCallback>[0];
}> = [
  { ms: 100, next: { state: "OPENING_BROWSER", message: "Browser açılıyor (mock)" } },
  { ms: 200, next: { state: "AWAITING_LOGIN", message: "Login kontrol (mock)" } },
  { ms: 300, next: { state: "SUBMITTING_PROMPT", message: "Prompt gönderiliyor (mock)" } },
  { ms: 500, next: { state: "WAITING_FOR_RENDER", message: "Render bekleniyor (mock)" } },
  { ms: 1500, next: { state: "COLLECTING_OUTPUTS", mjJobId: "mock-job-001" } },
  { ms: 1700, next: { state: "DOWNLOADING", message: "Görseller indiriliyor (mock)" } },
];

export class MockDriver implements BridgeDriver {
  readonly id = "mock";
  private startedAt = new Date();
  private outputsDir: string;

  constructor(outputsDir: string) {
    this.outputsDir = outputsDir;
  }

  async init(): Promise<void> {
    await mkdir(this.outputsDir, { recursive: true });
  }

  async shutdown(): Promise<void> {
    // no-op
  }

  async health() {
    return {
      launched: true,
      profileDir: "(mock — no real profile)",
      pageCount: 0,
      mjLikelyLoggedIn: true,
      lastChecked: new Date().toISOString(),
      // Pass 45 — mock driver ne kanal ne profile kullanır.
      channel: "mock" as const,
      profileState: "absent" as const,
      // Pass 46 — mock driver gözlem alanları null (job seq deterministic).
      lastDriverMessage: null,
      lastDriverError: null,
      // Pass 47 — mock driver attach/launch ayrımı yok.
      mode: "mock" as const,
      browserKind: "mock" as const,
    };
  }

  async focusBrowser(): Promise<void> {
    // no-op — mock driver browser yok.
  }

  async executeJob(
    job: { id: string; request: CreateJobRequest },
    onProgress: DriverProgressCallback,
    signal: AbortSignal,
  ): Promise<void> {
    for (const step of STATE_TRANSITIONS) {
      if (signal.aborted) return;
      await new Promise((r) => setTimeout(r, step.ms));
      onProgress(step.next);
    }

    // describe job → outputs yerine "mock prompt" döner; V1 yalnız generate.
    if (job.request.kind !== "generate") {
      onProgress({
        state: "FAILED",
        blockReason: "internal-error",
        message: `Mock driver kind="${job.request.kind}" desteklemiyor (V1)`,
      });
      return;
    }

    // 4 mock PNG fixture yaz (1×1 pixel + farklı renk).
    const jobOutputsDir = join(this.outputsDir, job.id);
    await mkdir(jobOutputsDir, { recursive: true });

    const colors = ["red", "green", "blue", "orange"];
    const outputs: Parameters<DriverProgressCallback>[0]["outputs"] = [];
    for (let i = 0; i < 4; i++) {
      const localPath = join(jobOutputsDir, `${i}.png`);
      // 1×1 PNG — paletted color (deterministic, tiny). Real driver MJ CDN'den
      // gerçek PNG indirir.
      await writeFile(localPath, makeOnePxPng(colors[i]!));
      outputs.push({
        gridIndex: i,
        localPath,
        fetchUrl: `/jobs/${job.id}/outputs/${i}`,
        sourceUrl: `https://mock.midjourney.invalid/grid/${i}.png`,
      });
    }

    if (signal.aborted) return;
    onProgress({
      state: "COLLECTING_OUTPUTS",
      outputs,
      mjMetadata: {
        prompt: job.request.params.prompt,
        aspectRatio: job.request.params.aspectRatio,
        version: job.request.params.version ?? "mock-v1",
        seed: 1234567,
      },
    });

    await new Promise((r) => setTimeout(r, 100));
    if (signal.aborted) return;
    onProgress({ state: "DOWNLOADING", outputs });

    await new Promise((r) => setTimeout(r, 100));
    if (signal.aborted) return;
    onProgress({
      state: "COMPLETED",
      outputs,
      message: "Mock job tamamlandı",
    });
  }
}

/** 1×1 PNG fixture — color hex map'i ile farklı renk. */
function makeOnePxPng(colorName: string): Buffer {
  // Pre-encoded 1×1 PNG'ler (paletted, indexed). Buffer literal — dependency yok.
  // Renkler: red=#FF0000, green=#00FF00, blue=#0000FF, orange=#FF8800.
  const palettes: Record<string, string> = {
    red: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YPyqacAAAAASUVORK5CYII=",
    green:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQDEdYbsAAAAAElFTkSuQmCC",
    blue: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAADElEQVR42mNkYPj/HwADBgGA8MttiAAAAABJRU5ErkJggg==",
    orange:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAADElEQVR42mP8z/D/PwAGAwL/kbFbQQAAAABJRU5ErkJggg==",
  };
  const b64 = palettes[colorName] ?? palettes["red"]!;
  return Buffer.from(b64, "base64");
}
