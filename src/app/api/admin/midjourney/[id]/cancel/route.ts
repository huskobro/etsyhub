// Pass 53 — Admin cancel MJ job.
//
// Sözleşme:
//   POST /api/admin/midjourney/:id/cancel
//   200 → { ok, state: "CANCELLED" }
//   404 → MidjourneyJob yok
//   409 → Job zaten terminal (COMPLETED/FAILED/CANCELLED)
//
// Akış:
//   1. requireAdmin
//   2. MidjourneyJob lookup
//   3. Bridge cancelJob (best-effort; bridge offline ise DB update yine yap)
//   4. DB MidjourneyJob + Kivasy Job → CANCELLED
//   5. Audit log
//
// Bridge unreachable durumunda DB CANCELLED'a alınır (operatör explicit
// iptal etti). Worker poll bir sonraki tick'te terminal state'i görür.

import { NextResponse } from "next/server";
import { MidjourneyJobState, JobStatus } from "@prisma/client";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import {
  BridgeUnreachableError,
  getBridgeClient,
} from "@/server/services/midjourney/bridge-client";

const TERMINAL_STATES: ReadonlyArray<MidjourneyJobState> = [
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

type Ctx = { params: { id: string } };

export const POST = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id } = ctx.params;

  const mjJob = await db.midjourneyJob.findUnique({
    where: { id },
    select: {
      id: true,
      bridgeJobId: true,
      state: true,
      jobId: true,
    },
  });
  if (!mjJob) throw new NotFoundError("MidjourneyJob bulunamadı");
  if (TERMINAL_STATES.includes(mjJob.state)) {
    throw new ValidationError(
      `Job zaten terminal state'te: ${mjJob.state}`,
    );
  }

  // Bridge cancel best-effort.
  let bridgeCancelOk = false;
  let bridgeError: string | null = null;
  try {
    await getBridgeClient().cancelJob(mjJob.bridgeJobId);
    bridgeCancelOk = true;
  } catch (err) {
    bridgeError =
      err instanceof BridgeUnreachableError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
  }

  // DB CANCELLED.
  await db.midjourneyJob.update({
    where: { id: mjJob.id },
    data: {
      state: MidjourneyJobState.CANCELLED,
      blockReason: "user-cancelled",
      failedReason: bridgeError
        ? `Operatör iptal etti (bridge cancel fail: ${bridgeError})`
        : "Operatör iptal etti",
      failedAt: new Date(),
    },
  });
  if (mjJob.jobId) {
    await db.job.update({
      where: { id: mjJob.jobId },
      data: {
        status: JobStatus.CANCELLED,
        finishedAt: new Date(),
        error: "Admin iptal",
      },
    });
  }

  await audit({
    actor: admin.id,
    action: "MIDJOURNEY_CANCEL",
    targetType: "MidjourneyJob",
    targetId: mjJob.id,
    metadata: { bridgeJobId: mjJob.bridgeJobId, bridgeCancelOk },
  });

  return NextResponse.json({
    ok: true,
    state: "CANCELLED",
    bridgeCancelOk,
    bridgeError,
  });
});
