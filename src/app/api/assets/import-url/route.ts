import { NextResponse } from "next/server";
import { z } from "zod";
import { JobType } from "@prisma/client";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import type { AssetIngestPayload } from "@/server/workers/asset-ingest.worker";

const body = z.object({ sourceUrl: z.string().url() });

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz URL", parsed.error.flatten());
  }

  const job = await db.job.create({
    data: {
      userId: user.id,
      type: JobType.ASSET_INGEST_FROM_URL,
      metadata: { sourceUrl: parsed.data.sourceUrl },
    },
  });

  const payload: AssetIngestPayload = {
    jobId: job.id,
    userId: user.id,
    sourceUrl: parsed.data.sourceUrl,
  };
  const bull = await enqueue(
    JobType.ASSET_INGEST_FROM_URL,
    payload as unknown as Record<string, unknown>,
  );
  await db.job.update({
    where: { id: job.id },
    data: { bullJobId: bull.id ? String(bull.id) : null },
  });

  return NextResponse.json({ jobId: job.id });
});
