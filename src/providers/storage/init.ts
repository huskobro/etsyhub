import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

let ensured = false;

export async function ensureBucket(): Promise<void> {
  if (ensured) return;
  const client = new S3Client({
    region: env.STORAGE_REGION,
    endpoint: env.STORAGE_ENDPOINT,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY,
      secretAccessKey: env.STORAGE_SECRET_KEY,
    },
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: env.STORAGE_BUCKET }));
    logger.debug({ bucket: env.STORAGE_BUCKET }, "bucket mevcut");
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: env.STORAGE_BUCKET }));
    logger.info({ bucket: env.STORAGE_BUCKET }, "bucket oluşturuldu");
  } finally {
    ensured = true;
  }
}
