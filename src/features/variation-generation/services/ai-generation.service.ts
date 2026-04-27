// Phase 5 §4 — variation-jobs orchestration service.
//
// Sözleşme:
//   - createVariationJobs: N design + N job + N enqueue (R17.4 paralel kuyruk)
//   - capability decision route'ta yapılır (R17.1); service prop olarak alır
//   - promptSnapshot create anında lock'lanır (R15 snapshot kuralı)
//   - aspectRatio + quality persist edilir (sessiz default fallback engelle)
//   - Worker (Task 10) bu rows'u UPDATE eder; create burada
//
// Reference.asset.sourceUrl → i2i için public URL kaynağı (schema cross-check
// not: Reference'ta imageUrl alanı YOK; truth Asset.sourceUrl).
import { db } from "@/server/db";
import {
  JobType,
  JobStatus,
  VariationCapability,
  type Reference,
} from "@prisma/client";
import { enqueue } from "@/server/queue";
import { buildImagePrompt } from "@/features/variation-generation/prompt-builder";
import type { ImageGenerateInput, ImageCapability } from "@/providers/image/types";

export type CreateVariationJobsInput = {
  userId: string;
  reference: Reference;
  /** i2i için public URL — route'ta Asset.sourceUrl üzerinden geçirilir. */
  referenceImageUrl?: string;
  providerId: string;
  /** Route'ta karar verilir (R17.1). */
  capability: ImageCapability;
  aspectRatio: ImageGenerateInput["aspectRatio"];
  quality?: "medium" | "high";
  brief?: string;
  count: number;
  systemPrompt: string;
  promptVersionId?: string | null;
};

const QUEUED = "QUEUED" as const; // string literal — Prisma enum auto-generated.

export async function createVariationJobs(
  input: CreateVariationJobsInput,
): Promise<{ designIds: string[] }> {
  const prompt = buildImagePrompt({
    systemPrompt: input.systemPrompt,
    brief: input.brief,
    capability: input.capability,
  });

  const dbCapability =
    input.capability === "image-to-image"
      ? VariationCapability.IMAGE_TO_IMAGE
      : VariationCapability.TEXT_TO_IMAGE;

  // N adet GeneratedDesign create — paralel.
  const designs = await Promise.all(
    Array.from({ length: input.count }).map(() =>
      db.generatedDesign.create({
        data: {
          userId: input.userId,
          referenceId: input.reference.id,
          assetId: input.reference.assetId,
          productTypeId: input.reference.productTypeId,
          providerId: input.providerId,
          capabilityUsed: dbCapability,
          promptSnapshot: prompt,
          briefSnapshot: input.brief ?? null,
          promptVersionId: input.promptVersionId ?? null,
          state: QUEUED,
          aspectRatio: input.aspectRatio,
          quality: input.quality ?? null,
        },
      }),
    ),
  );

  // N adet Job + enqueue — paralel. designId metadata'ya yazılır (worker bu
  // alandan okur). Enqueue payload worker'ın expected shape'ine birebir uyar.
  await Promise.all(
    designs.map(async (d) => {
      const job = await db.job.create({
        data: {
          type: JobType.GENERATE_VARIATIONS,
          status: JobStatus.QUEUED,
          userId: input.userId,
          progress: 0,
          metadata: { designId: d.id, referenceId: input.reference.id },
        },
      });
      await enqueue(JobType.GENERATE_VARIATIONS, {
        jobId: job.id,
        userId: input.userId,
        designId: d.id,
        providerId: input.providerId,
        prompt,
        referenceUrls:
          input.capability === "image-to-image" && input.referenceImageUrl
            ? [input.referenceImageUrl]
            : undefined,
        aspectRatio: input.aspectRatio,
        quality: input.quality,
      });
    }),
  );

  return { designIds: designs.map((d) => d.id) };
}
