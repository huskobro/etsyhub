// Phase 7 Task 13 — Selection export signed URL helper.
//
// Sözleşme (design Section 6.5):
//   - TTL sabit: 24 saat (86400 saniye).
//   - storage.signedUrl(key, ttl) çağrılır; URL ve expiresAt döndürülür.
//   - expiresAt = call-time + 24h (server-side hesaplama; client'a hint).
//
// Bu dosya storage abstraction'a bağımlı; provider switch (MinIO/S3) env
// üzerinden yönetilir, helper bağımsızdır.

import { getStorage } from "@/providers/storage";

/** ZIP signed URL TTL: 24 saat (86400 saniye). Section 6.5. */
export const EXPORT_SIGNED_URL_TTL_SECONDS = 24 * 3600;

/**
 * Verilen export storage key'i için 24h geçerli signed URL üretir.
 *
 * `expiresAt` Date hesaplaması call-time'da yapılır — gerçek geçerlilik
 * provider'ın imzaladığı zamanla aynı olmayabilir (network latency); pratikte
 * fark sub-saniyedir, client display için yeterli.
 */
export async function generateExportSignedUrl(storageKey: string): Promise<{
  url: string;
  expiresAt: Date;
}> {
  const url = await getStorage().signedUrl(
    storageKey,
    EXPORT_SIGNED_URL_TTL_SECONDS,
  );
  const expiresAt = new Date(Date.now() + EXPORT_SIGNED_URL_TTL_SECONDS * 1000);
  return { url, expiresAt };
}
