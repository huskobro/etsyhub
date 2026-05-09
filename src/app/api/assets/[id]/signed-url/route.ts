import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/server/db";
import { resolveTtlForUser, userSignedUrl } from "@/server/services/settings/signed-url.helper";

// R9 — Hard-coded 300s/240s yerine kullanıcının storage prefs'i
// (UserSetting key="storage").signedUrlTtlSeconds. Browser Cache-Control
// TTL'in %80'i (resmi expire sınırından önce browser yeni signed URL ister).
const FALLBACK_TTL_SECONDS = 300;

type Ctx = { params: { id: string } };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = ctx.params;

  const asset = await db.asset.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: { storageKey: true },
  });
  if (!asset) throw new NotFoundError("Asset bulunamadı");

  const ttl = await resolveTtlForUser(user.id).catch(() => FALLBACK_TTL_SECONDS);
  const url = await userSignedUrl({
    userId: user.id,
    key: asset.storageKey,
    overrideTtlSeconds: ttl,
  });
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  const browserCache = Math.max(60, Math.floor(ttl * 0.8));

  return NextResponse.json(
    { url, expiresAt },
    { headers: { "Cache-Control": `private, max-age=${browserCache}` } },
  );
});
