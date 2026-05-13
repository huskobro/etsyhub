/**
 * Phase 67 — User-scope mockup template asset signed URL.
 *
 * Visual editor preview için. Operator template form'unda asset upload
 * sonrası dönen storageKey'i image preview olarak gösterebilmek için
 * signed URL gerekli (MinIO direct GET'e izin yok — bucket private).
 *
 * Auth: requireUser
 *
 * Path scope (cross-user isolation):
 *   - Yalnız `u/{userId}/templates/...` prefix'li key'ler kabul edilir
 *   - userId currentUser.id ile EŞLEŞMELİ — başka kullanıcının
 *     template asset'ine erişim VERİLMEZ (data leakage hard guard)
 *   - Admin asset prefix'i (`templates/...`) reject (admin endpoint
 *     `/api/admin/mockup-templates/asset-url` ayrı)
 *   - User general asset prefix'i (`u/{userId}/{cuid}` — Asset row)
 *     reject (asset signed-url endpoint ayrı)
 *
 * Response: { url, expiresAt }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { getStorage } from "@/providers/storage";

const QuerySchema = z.object({
  key: z.string().min(1).max(500),
});

const SIGNED_URL_TTL_SECONDS = 300;
const BROWSER_CACHE_SECONDS = 240;

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    key: searchParams.get("key"),
  });
  if (!parsed.success) {
    throw new ValidationError("Invalid query", parsed.error.flatten());
  }

  const key = parsed.data.key;

  /* Cross-user isolation: enforce key belongs to current user's
   * template asset namespace. Pattern: u/{userId}/templates/{categoryId}/{purpose}/{cuid}.{ext}
   *
   * Reject:
   *   - Admin asset prefix (templates/...) — wrong endpoint
   *   - Other user's u/{otherUserId}/... — leakage prevention
   *   - User general asset (u/{userId}/{cuid} without /templates/) — wrong endpoint */
  const expectedPrefix = `u/${user.id}/templates/`;
  if (!key.startsWith(expectedPrefix)) {
    throw new ForbiddenError(
      "Key does not belong to your mockup template asset namespace",
    );
  }

  const url = await getStorage().signedUrl(key, SIGNED_URL_TTL_SECONDS);
  const expiresAt = new Date(
    Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  ).toISOString();

  return NextResponse.json(
    { url, expiresAt },
    { headers: { "Cache-Control": `private, max-age=${BROWSER_CACHE_SECONDS}` } },
  );
});
