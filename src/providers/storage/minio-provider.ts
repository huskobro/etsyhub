import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import type {
  StorageProvider,
  StoredObject,
  StoredObjectMeta,
  UploadMeta,
} from "./index";

export class MinioStorage implements StorageProvider {
  protected client = new S3Client({
    region: env.STORAGE_REGION,
    endpoint: env.STORAGE_ENDPOINT,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY,
      secretAccessKey: env.STORAGE_SECRET_KEY,
    },
  });
  protected bucket = env.STORAGE_BUCKET;

  async upload(key: string, body: Buffer, meta: UploadMeta): Promise<StoredObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: meta.contentType,
      }),
    );
    return { key, bucket: this.bucket, size: body.length };
  }

  async download(key: string): Promise<Buffer> {
    const out = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const body = out.Body;
    if (!body) throw new Error(`Storage key bulunamadı: ${key}`);
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Buffer | Uint8Array>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async signedUrl(key: string, expiresIn: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  /**
   * Phase 7 Task 13 — verilen prefix altındaki tüm object'leri listeler.
   *
   * Pagination: ListObjectsV2 1000 object/sayfa limit'i; do/while ile
   * `NextContinuationToken` boşalana kadar takip edilir. Sonuç tek array'de
   * birleştirilir (cleanup cron için yeterli; çok büyük bucket'larda streaming
   * varyantı Phase 8+ refactor'una bırakılır).
   */
  async list(prefix: string): Promise<StoredObjectMeta[]> {
    const result: StoredObjectMeta[] = [];
    let continuationToken: string | undefined;
    do {
      const out = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const obj of out.Contents ?? []) {
        if (obj.Key && obj.LastModified && typeof obj.Size === "number") {
          result.push({
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified,
          });
        }
      }
      continuationToken = out.NextContinuationToken;
    } while (continuationToken);
    return result;
  }
}
