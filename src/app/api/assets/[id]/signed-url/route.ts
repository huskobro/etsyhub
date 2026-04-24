import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";

type Ctx = { params: { id: string } };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = ctx.params;

  const asset = await db.asset.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: { storageKey: true },
  });
  if (!asset) throw new NotFoundError("Asset bulunamadı");

  const url = await getStorage().signedUrl(asset.storageKey, 300);
  const expiresAt = new Date(Date.now() + 300 * 1000).toISOString();

  return NextResponse.json(
    { url, expiresAt },
    { headers: { "Cache-Control": "private, max-age=240" } },
  );
});
