// Pass 50 — Admin "Test Render" tetikleyici.
//
// Sözleşme:
//   POST /api/admin/midjourney/test-render
//   body: { prompt: string, aspectRatio?: "1:1"|"2:3"|"3:2"|... }
//
// Akış:
//   1. requireAdmin
//   2. createMidjourneyJob → bridge enqueue + DB row + BullMQ enqueue
//   3. JSON döner: { jobId, midjourneyJobId, bridgeJobId, redirectUrl }
//
// Operatör admin/midjourney sayfasında butona basar, sayfa yenilenir,
// yeni job tabloda görünür. Worker arkada poll'u sürdürür; Tamamlandı
// olduğunda mjJobId + asset count tabloda update olur.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import { db } from "@/server/db";
import { createMidjourneyJob } from "@/server/services/midjourney/midjourney.service";
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

const body = z.object({
  prompt: z.string().min(3).max(800),
  aspectRatio: aspectRatioEnum.default("1:1"),
  version: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  // Pass 56 — opsiyonel reference: seçilirse auto-promote tetiklenir
  // (ingestOutputs sonunda 4 GeneratedDesign auto-create). Boşsa eski
  // davranış (operatör manuel promote eder).
  referenceId: z.string().min(1).optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz test render isteği",
      parsed.error.flatten().fieldErrors,
    );
  }

  // Pass 56 — referenceId verildiyse cross-user kontrolü + productType lookup.
  // Reference admin sahipliğinde olmalı (admin = MJ Job sahibi, Pass 51-55).
  let productTypeId: string | undefined;
  if (parsed.data.referenceId) {
    const ref = await db.reference.findFirst({
      where: {
        id: parsed.data.referenceId,
        userId: admin.id,
        deletedAt: null,
      },
      select: { id: true, productTypeId: true },
    });
    if (!ref) {
      throw new NotFoundError(
        "Reference bulunamadı veya admin sahipliğinde değil",
      );
    }
    productTypeId = ref.productTypeId;
  }

  try {
    const result = await createMidjourneyJob({
      userId: admin.id,
      prompt: parsed.data.prompt,
      aspectRatio: parsed.data.aspectRatio,
      version: parsed.data.version,
      referenceId: parsed.data.referenceId,
      productTypeId,
    });

    await audit({
      actor: admin.id,
      action: "MIDJOURNEY_TEST_RENDER",
      targetType: "MidjourneyJob",
      targetId: result.midjourneyJob.id,
      metadata: {
        bridgeJobId: result.bridgeJobId,
        prompt: parsed.data.prompt.slice(0, 200),
        aspectRatio: parsed.data.aspectRatio,
        referenceId: parsed.data.referenceId ?? null,
      },
    });

    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      midjourneyJobId: result.midjourneyJob.id,
      bridgeJobId: result.bridgeJobId,
    });
  } catch (err) {
    if (err instanceof BridgeUnreachableError) {
      // 502: upstream bridge yok / yapılandırılmamış. UI özel handle eder.
      return NextResponse.json(
        { ok: false, error: err.message, code: "BRIDGE_UNREACHABLE" },
        { status: 502 },
      );
    }
    throw err;
  }
});
