import sharp from "sharp";
import { SourcePlatform } from "@prisma/client";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { env } from "@/lib/env";
import { sha256 } from "@/lib/hash";
import { newId } from "@/lib/id";
import { ValidationError } from "@/lib/errors";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

export type CreateAssetInput = {
  userId: string;
  buffer: Buffer;
  mimeType: string;
  sourceUrl?: string;
  sourcePlatform?: SourcePlatform;
};

export async function createAssetFromBuffer(args: CreateAssetInput) {
  if (!ALLOWED_MIME.has(args.mimeType)) {
    throw new ValidationError("Desteklenmeyen dosya türü (png/jpeg/webp)");
  }
  if (args.buffer.length > MAX_SIZE_BYTES) {
    throw new ValidationError("Dosya çok büyük (max 25MB)");
  }

  const hash = sha256(args.buffer);
  const existing = await db.asset.findFirst({
    where: { userId: args.userId, hash, deletedAt: null },
  });
  if (existing) return existing;

  const meta = await sharp(args.buffer).metadata();
  const storage = getStorage();
  const storageKey = `u/${args.userId}/${newId()}`;
  const stored = await storage.upload(storageKey, args.buffer, {
    contentType: args.mimeType,
  });

  return db.asset.create({
    data: {
      userId: args.userId,
      storageProvider: env.STORAGE_PROVIDER,
      bucket: stored.bucket,
      storageKey: stored.key,
      mimeType: args.mimeType,
      sizeBytes: stored.size,
      width: meta.width ?? null,
      height: meta.height ?? null,
      hash,
      sourceUrl: args.sourceUrl,
      sourcePlatform: args.sourcePlatform,
    },
  });
}
