// V2 Phase 8 — Admin LOCAL_SHARP/DYNAMIC_MOCKUPS provider config validate.
//
// Admin binding form'unda config'i yazarken/upload ederken canlı validation
// fırsatı vermek için: ProviderConfigSchema parse + (LOCAL_SHARP için)
// baseAssetKey storage existence check + (preview-ready) summary döner.
//
// Bu endpoint **render YAPMAZ** — sadece statik validation + asset
// metadata. Real render preview ayrı V2.x scope (Sharp tek-render endpoint,
// cost guardrails gerek).
//
// Response shape:
// {
//   valid: boolean,
//   errors: { path: string; message: string }[]  -- valid=false ise dolu
//   summary: {
//     providerId: "local-sharp" | "dynamic-mockups",
//     baseAsset?: { exists: boolean; mimeType?: string; sizeBytes?: number },
//     safeAreaType?: "rect" | "perspective",
//     baseDimensions?: { w, h },
//     coverPriority?: number,
//   }
// }
//
// Auth: requireAdmin
// Audit: log YOK (her keystroke validate olabilir; gürültü).

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { getStorage } from "@/providers/storage";
import { ProviderConfigSchema } from "@/features/mockups/schemas";

const PostBody = z.object({
  providerId: z.enum(["LOCAL_SHARP", "DYNAMIC_MOCKUPS"]),
  config: z.unknown(),
});

type ValidationItem = { path: string; message: string };

export const POST = withErrorHandling(async (req: Request) => {
  await requireAdmin();

  const parsed = PostBody.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz body", parsed.error.flatten());
  }

  const providerIdLiteral =
    parsed.data.providerId === "LOCAL_SHARP" ? "local-sharp" : "dynamic-mockups";
  const cfgWithDiscriminator = {
    ...(parsed.data.config as Record<string, unknown>),
    providerId: providerIdLiteral,
  };

  const cfgParsed = ProviderConfigSchema.safeParse(cfgWithDiscriminator);

  // Schema fail → flatten + path.join → kullanıcıya anlaşılır mesaj
  if (!cfgParsed.success) {
    const errors: ValidationItem[] = cfgParsed.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));
    return NextResponse.json({
      valid: false,
      errors,
      summary: { providerId: providerIdLiteral },
    });
  }

  const cfg = cfgParsed.data;

  // LOCAL_SHARP — baseAsset existence check (signed URL üretmek HEAD check
  // gibi; failed signedUrl exception yakalanır → exists=false).
  if (cfg.providerId === "local-sharp") {
    let baseAssetExists = false;
    let baseAssetMime: string | undefined;
    let baseAssetSize: number | undefined;
    try {
      // download() buffer çeker — küçük overhead ama doğrudan exists check.
      // Production'da HEAD object daha verimli; V2 foundation'da bu yeterli.
      const buf = await getStorage().download(cfg.baseAssetKey);
      baseAssetExists = true;
      baseAssetSize = buf.length;
      // mimeType inference (extension):
      const ext = cfg.baseAssetKey.split(".").pop()?.toLowerCase();
      baseAssetMime =
        ext === "png"
          ? "image/png"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "webp"
              ? "image/webp"
              : "application/octet-stream";
    } catch {
      baseAssetExists = false;
    }

    const errors: ValidationItem[] = [];
    if (!baseAssetExists) {
      errors.push({
        path: "baseAssetKey",
        message: `Storage'da bulunamadı: ${cfg.baseAssetKey}. Önce yükle veya doğru key gir.`,
      });
    }

    return NextResponse.json({
      valid: errors.length === 0,
      errors,
      summary: {
        providerId: "local-sharp",
        baseAsset: {
          exists: baseAssetExists,
          mimeType: baseAssetMime,
          sizeBytes: baseAssetSize,
        },
        safeAreaType: cfg.safeArea.type,
        baseDimensions: cfg.baseDimensions,
        coverPriority: cfg.coverPriority,
      },
    });
  }

  // DYNAMIC_MOCKUPS — sadece schema parse yeterli (provider runtime stub)
  return NextResponse.json({
    valid: true,
    errors: [],
    summary: {
      providerId: "dynamic-mockups",
    },
  });
});
