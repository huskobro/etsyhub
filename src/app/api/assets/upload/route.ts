import { NextResponse } from "next/server";
import { SourcePlatform } from "@prisma/client";
import { requireUser } from "@/server/session";
import { createAssetFromBuffer } from "@/features/assets/server/asset-service";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ValidationError("Dosya yok");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const asset = await createAssetFromBuffer({
    userId: user.id,
    buffer,
    mimeType: file.type,
    sourcePlatform: SourcePlatform.UPLOAD,
  });
  return NextResponse.json({
    id: asset.id,
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
  });
});
