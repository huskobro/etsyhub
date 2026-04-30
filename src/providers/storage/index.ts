import { env } from "@/lib/env";
import { MinioStorage } from "./minio-provider";
import { S3Storage } from "./s3-provider";

export type StoredObject = {
  key: string;
  bucket: string;
  size: number;
  etag?: string;
};

export type UploadMeta = {
  contentType: string;
};

/**
 * Storage object metadata (list/iterate sonuçları için).
 *
 * Phase 7 Task 13'te `list(prefix)` için eklendi: cleanup cron `lastModified`
 * üzerinden 7 günden eski export ZIP'lerini bulur.
 */
export type StoredObjectMeta = {
  key: string;
  size: number;
  lastModified: Date;
};

export interface StorageProvider {
  upload(key: string, body: Buffer, meta: UploadMeta): Promise<StoredObject>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, expiresIn: number): Promise<string>;
  /**
   * Verilen prefix altındaki tüm object'leri listeler (paginated, otomatik
   * birleştirme). Boş prefix ("") tüm bucket'ı verir; pratikte daima daraltılmış
   * prefix kullanılır.
   */
  list(prefix: string): Promise<StoredObjectMeta[]>;
}

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  cached = env.STORAGE_PROVIDER === "s3" ? new S3Storage() : new MinioStorage();
  return cached;
}
