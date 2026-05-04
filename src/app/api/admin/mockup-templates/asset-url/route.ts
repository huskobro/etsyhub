// V2 Phase 8 — Admin asset signed URL (template authoring preview için).
//
// Admin template formunda thumbKey/baseAssetKey upload edildikten sonra
// preview göstermek için signed URL gerekli. User Asset signed URL endpoint
// (`/api/assets/[id]/signed-url`) Asset DB row'una bağlı; template asset'ler
// DB row tutmuyor (admin-managed system asset). Bu endpoint admin'in
// bildiği storage key üzerinden direct signed URL döner.
//
// Auth: requireAdmin
// Path scope: yalnız `templates/` prefix'li key'ler (admin system asset'leri).
//             User asset prefix'i `u/{userId}/` reject — leakage prevent.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { getStorage } from "@/providers/storage";

const QuerySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(500)
    .regex(/^templates\//, "Yalnız 'templates/' prefix'li admin asset key'leri kabul edilir"),
});

const SIGNED_URL_TTL_SECONDS = 300;
const BROWSER_CACHE_SECONDS = 240;

export const GET = withErrorHandling(async (req: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    key: searchParams.get("key"),
  });
  if (!parsed.success) {
    throw new ValidationError("Geçersiz query", parsed.error.flatten());
  }

  const url = await getStorage().signedUrl(parsed.data.key, SIGNED_URL_TTL_SECONDS);
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  return NextResponse.json(
    { url, expiresAt },
    { headers: { "Cache-Control": `private, max-age=${BROWSER_CACHE_SECONDS}` } },
  );
});
