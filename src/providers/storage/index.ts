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

export interface StorageProvider {
  upload(key: string, body: Buffer, meta: UploadMeta): Promise<StoredObject>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  signedUrl(key: string, expiresIn: number): Promise<string>;
}

let cached: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (cached) return cached;
  cached = env.STORAGE_PROVIDER === "s3" ? new S3Storage() : new MinioStorage();
  return cached;
}
