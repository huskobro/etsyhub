// Pass 52 — Admin scope signed URL.
//
// Mevcut /api/assets/[id]/signed-url kullanıcı sahipliğine bağlı
// (`requireUser` + `userId: user.id`); admin başka kullanıcının job'unu
// inceleyemez. Bu endpoint admin için aynı işi cross-user yapar.
//
// Sözleşme:
//   GET /api/admin/assets/:id/signed-url
//   200 → { url, expiresAt }
//   404 → asset yok
//
// Kullanım: admin Midjourney detay sayfasında 4 grid thumbnail için.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError } from "@/lib/errors";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";

const SIGNED_URL_TTL_SECONDS = 300;
const BROWSER_CACHE_SECONDS = 240;

type Ctx = { params: { id: string } };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  await requireAdmin();
  const { id } = ctx.params;

  const asset = await db.asset.findFirst({
    where: { id, deletedAt: null },
    select: { storageKey: true },
  });
  if (!asset) throw new NotFoundError("Asset bulunamadı");

  const url = await getStorage().signedUrl(
    asset.storageKey,
    SIGNED_URL_TTL_SECONDS,
  );
  const expiresAt = new Date(
    Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  ).toISOString();

  return NextResponse.json(
    { url, expiresAt },
    {
      headers: {
        "Cache-Control": `private, max-age=${BROWSER_CACHE_SECONDS}`,
      },
    },
  );
});
