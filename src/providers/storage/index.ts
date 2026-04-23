import { env } from "@/lib/env";

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
  if (env.STORAGE_PROVIDER === "s3") {
    const { S3Storage } = require("./s3-provider") as typeof import("./s3-provider");
    cached = new S3Storage();
  } else {
    const { MinioStorage } = require("./minio-provider") as typeof import("./minio-provider");
    cached = new MinioStorage();
  }
  return cached;
}
