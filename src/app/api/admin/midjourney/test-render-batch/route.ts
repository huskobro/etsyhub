// Pass 80 — Admin "Batch Render from Template" endpoint.
//
// Sözleşme:
//   POST /api/admin/midjourney/test-render-batch
//   body: {
//     templateId?: string  (persisted template; verilirse promptTemplate ignore)
//     promptTemplate?: string  (inline template; templateId verilmemişse zorunlu)
//     variableSets: Array<Record<string,string>>  (her entry → 1 job, max 50)
//     aspectRatio?: ... (default "1:1")
//     // ... diğer createMidjourneyJob params (sref/oref/cref/strategy)
//   }
//
// Akış:
//   1. requireAdmin
//   2. Zod parse
//   3. createMidjourneyJobsFromTemplateBatch (sequential enqueue)
//   4. Audit log: template + variableSets özeti
//   5. JSON döner: { templateSnapshot, totalRequested, totalSubmitted,
//      totalFailed, results[] }
//
// Pass 80 V1 scope:
//   - Tek template + N variable sets (max 50)
//   - Sequential (rate-limit BullMQ worker concurrency=1 + bridge 10sn min interval)
//   - Best-effort: tek job fail diğerlerini durdurmaz
//
// Pass 81+ scope:
//   - CSV upload import
//   - Conditional / loop syntax (`{{#each}}`)
//   - Default values (`{{style|minimalist}}`)
//   - Batch progress tracking + cancel

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { createMidjourneyJobsFromTemplateBatch } from "@/server/services/midjourney/midjourney.service";
import { BridgeUnreachableError } from "@/server/services/midjourney/bridge-client";

const aspectRatioEnum = z.enum([
  "1:1",
  "2:3",
  "3:2",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
]);

const VAR_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const variableSetSchema = z
  .record(z.string().max(200))
  .refine(
    (v) => Object.keys(v).every((k) => VAR_NAME_REGEX.test(k)),
    "Variable adı sadece harf+rakam+underscore (harfle başlamalı)",
  )
  .refine(
    (v) => Object.keys(v).length <= 30,
    "Maksimum 30 variable",
  );

const body = z
  .object({
    templateId: z.string().min(1).optional(),
    promptTemplate: z.string().min(3).max(2000).optional(),
    variableSets: z
      .array(variableSetSchema)
      .min(1, "En az 1 variable set")
      .max(50, "Maksimum 50 variable set (rate-limit + queue koruması)"),
    aspectRatio: aspectRatioEnum.default("1:1"),
    version: z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .optional(),
    styleRaw: z.boolean().optional(),
    stylize: z.number().int().min(0).max(1000).optional(),
    chaos: z.number().int().min(0).max(100).optional(),
    referenceUrls: z
      .array(z.string().url().startsWith("https://"))
      .max(10)
      .optional(),
    styleReferenceUrls: z
      .array(
        z.union([
          z.string().url().startsWith("https://"),
          z.object({
            url: z.string().url().startsWith("https://"),
            weight: z.number().int().min(0).max(1000).optional(),
          }),
        ]),
      )
      .max(5)
      .optional(),
    styleWeight: z.number().int().min(0).max(1000).optional(),
    omniReferenceUrl: z.string().url().startsWith("https://").optional(),
    omniWeight: z.number().int().min(0).max(1000).optional(),
    characterReferenceUrls: z
      .array(z.string().url().startsWith("https://"))
      .max(5)
      .optional(),
    submitStrategy: z.enum(["auto", "api-first", "dom-first"]).optional(),
  })
  .refine(
    (d) => !!d.templateId || !!d.promptTemplate,
    "templateId veya promptTemplate'den biri verilmeli",
  );

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz batch render isteği",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const result = await createMidjourneyJobsFromTemplateBatch({
      userId: admin.id,
      templateId: parsed.data.templateId,
      promptTemplate: parsed.data.promptTemplate,
      variableSets: parsed.data.variableSets,
      aspectRatio: parsed.data.aspectRatio,
      version: parsed.data.version,
      styleRaw: parsed.data.styleRaw,
      stylize: parsed.data.stylize,
      chaos: parsed.data.chaos,
      referenceUrls: parsed.data.referenceUrls,
      styleReferenceUrls: parsed.data.styleReferenceUrls,
      styleWeight: parsed.data.styleWeight,
      omniReferenceUrl: parsed.data.omniReferenceUrl,
      omniWeight: parsed.data.omniWeight,
      characterReferenceUrls: parsed.data.characterReferenceUrls,
      submitStrategy: parsed.data.submitStrategy,
    });

    await audit({
      actor: admin.id,
      action: "MIDJOURNEY_TEMPLATE_BATCH_RENDER",
      targetType: "PromptTemplate",
      targetId: result.templateSnapshot.templateId ?? "(inline)",
      metadata: {
        templateId: result.templateSnapshot.templateId ?? null,
        versionId: result.templateSnapshot.versionId ?? null,
        version: result.templateSnapshot.version ?? null,
        promptTemplate: result.templateSnapshot.promptTemplate.slice(0, 500),
        totalRequested: result.totalRequested,
        totalSubmitted: result.totalSubmitted,
        totalFailed: result.totalFailed,
        // İlk birkaç variable set'in özeti (audit boyutu için kısıtlı)
        variableSetsHead: parsed.data.variableSets.slice(0, 3),
        aspectRatio: parsed.data.aspectRatio,
        submitStrategy: parsed.data.submitStrategy ?? "auto",
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof BridgeUnreachableError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: "BRIDGE_UNREACHABLE" },
        { status: 502 },
      );
    }
    if (err instanceof Error) {
      // Template-resolve veya validation hataları 400
      if (
        err.message.includes("MJ template bulunamadı") ||
        err.message.includes("variableSets") ||
        err.message.includes("templateId veya promptTemplate")
      ) {
        return NextResponse.json(
          { ok: false, error: err.message, code: "INVALID_BATCH_INPUT" },
          { status: 400 },
        );
      }
    }
    throw err;
  }
});
