// Pass 79 — Admin "Test Render from Template" endpoint.
//
// Sözleşme:
//   POST /api/admin/midjourney/test-render-from-template
//   body: {
//     promptTemplate: string (Mustache `{{var}}` syntax, max 1000 char)
//     promptVariables: Record<string, string> (her value max 200 char)
//     aspectRatio?: "1:1" | ... (default "1:1")
//     version?: "5" | "6" | "7"
//     // ... diğer createMidjourneyJob params (sref/oref/cref/strategy)
//   }
//
// Akış:
//   1. requireAdmin
//   2. Zod parse + validate
//   3. createMidjourneyJobFromTemplate (helper expand + job create)
//   4. Audit log: template + variables (lineage)
//   5. JSON döner: { jobId, midjourneyJobId, bridgeJobId, expandedPrompt,
//      usedVariables, unusedVariables }
//
// Pass 79 V1 scope: tek-shot expand + render. Batch (template × N variables
// kombinasyonu) Pass 80+ kapsamı.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { createMidjourneyJobFromTemplate } from "@/server/services/midjourney/midjourney.service";
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

// Variable adı whitelist: harfle başlar + harf/rakam/underscore
const VAR_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const body = z.object({
  promptTemplate: z.string().min(3).max(1000),
  promptVariables: z
    .record(z.string().max(200))
    .refine(
      (v) => Object.keys(v).every((k) => VAR_NAME_REGEX.test(k)),
      "Variable adı sadece harf+rakam+underscore (harfle başlamalı)",
    )
    .refine(
      (v) => Object.keys(v).length <= 30,
      "Maksimum 30 variable",
    ),
  aspectRatio: aspectRatioEnum.default("1:1"),
  version: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  styleRaw: z.boolean().optional(),
  stylize: z.number().int().min(0).max(1000).optional(),
  chaos: z.number().int().min(0).max(100).optional(),
  // Reference family (Pass 71/73/75/76)
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
  // Strategy (Pass 74/78)
  submitStrategy: z.enum(["auto", "api-first", "dom-first"]).optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz template render isteği",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const result = await createMidjourneyJobFromTemplate({
      userId: admin.id,
      promptTemplate: parsed.data.promptTemplate,
      promptVariables: parsed.data.promptVariables,
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
      action: "MIDJOURNEY_TEMPLATE_RENDER",
      targetType: "MidjourneyJob",
      targetId: result.midjourneyJob.id,
      metadata: {
        bridgeJobId: result.bridgeJobId,
        // Template lineage (re-run / re-expand için kanıt)
        promptTemplate: parsed.data.promptTemplate.slice(0, 500),
        promptVariables: parsed.data.promptVariables,
        expandedPrompt: result.expandedPrompt.slice(0, 500),
        usedVariables: result.usedVariables,
        unusedVariables: result.unusedVariables,
        aspectRatio: parsed.data.aspectRatio,
        submitStrategy: parsed.data.submitStrategy ?? "auto",
      },
    });

    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      midjourneyJobId: result.midjourneyJob.id,
      bridgeJobId: result.bridgeJobId,
      expandedPrompt: result.expandedPrompt,
      usedVariables: result.usedVariables,
      unusedVariables: result.unusedVariables,
    });
  } catch (err) {
    if (err instanceof BridgeUnreachableError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: "BRIDGE_UNREACHABLE" },
        { status: 502 },
      );
    }
    if (err instanceof Error && err.message.startsWith("Prompt template expansion fail")) {
      // Template-bağımlı hatalar 400 (ValidationError yerine açık mesaj)
      return NextResponse.json(
        { ok: false, error: err.message, code: "TEMPLATE_EXPANSION_FAIL" },
        { status: 400 },
      );
    }
    throw err;
  }
});
