import { NextResponse } from "next/server";
import { JobStatus, JobType } from "@prisma/client";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";

export const GET = withErrorHandling(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const typeParam = url.searchParams.get("type");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

  const status =
    statusParam && (Object.values(JobStatus) as string[]).includes(statusParam)
      ? (statusParam as JobStatus)
      : undefined;
  const type =
    typeParam && (Object.values(JobType) as string[]).includes(typeParam)
      ? (typeParam as JobType)
      : undefined;

  const jobs = await db.job.findMany({
    where: { status, type },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { email: true } } },
  });
  return NextResponse.json({ jobs });
});
