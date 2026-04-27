// Local Library — scan endpoint (Phase 5 §3, Task 11)
// Sözleşme: settings'ten rootFolderPath okunur. Yoksa 400.
// Var ise Job (QUEUED) yaratılır + SCAN_LOCAL_FOLDER worker'a enqueue edilir.

import { NextResponse } from "next/server";
import { JobStatus, JobType } from "@prisma/client";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import { withErrorHandling } from "@/lib/http";
import { getUserLocalLibrarySettings } from "@/features/settings/local-library/service";

export const POST = withErrorHandling(async () => {
  const user = await requireUser();
  const settings = await getUserLocalLibrarySettings(user.id);
  if (!settings.rootFolderPath) {
    return NextResponse.json(
      { error: "rootFolderPath not set" },
      { status: 400 },
    );
  }
  const job = await db.job.create({
    data: {
      type: JobType.SCAN_LOCAL_FOLDER,
      status: JobStatus.QUEUED,
      userId: user.id,
      progress: 0,
      metadata: { rootFolderPath: settings.rootFolderPath },
    },
  });
  await enqueue(JobType.SCAN_LOCAL_FOLDER, {
    jobId: job.id,
    userId: user.id,
    rootFolderPath: settings.rootFolderPath,
    targetResolution: settings.targetResolution,
    targetDpi: settings.targetDpi,
  });
  return NextResponse.json({ jobId: job.id });
});
