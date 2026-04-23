import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError } from "@/lib/errors";

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();
    const job = await db.job.findFirst({
      where: { id: ctx.params.id, userId: user.id },
    });
    if (!job) throw new NotFoundError();
    return NextResponse.json({ job });
  },
);
