// Phase 6 Aşama 2A smoke — CLI variation tetikleme.
//
// Variations UI feature flag arkasında ve route eksik olduğu için
// AI mode review pipeline'ı UI'dan tetiklenemiyor. Bu script:
//   1. admin user için minimum bir Asset (MinIO upload)
//   2. Reference (asset + productType "wall_art")
//   3. createVariationJobs ile 1 design + 1 GENERATE_VARIATIONS job
//
// Worker chain: GENERATE_VARIATIONS → KIE generate → SUCCESS →
//   auto enqueue REVIEW_DESIGN → KIE review → DB persist.
//
// Smoke sonrası temizleme: bu script idempotent değil; her çalıştırmada
// yeni asset+ref+design yaratır. Smoke sonrası gerekirse manuel temizle.
//
// Phase 5 closeout hotfix önkoşulu (2026-04-29): admin user'ın Settings →
// AI Mode'dan KIE API anahtarını girmiş olması ZORUNLU. createVariationJobs
// settings-aware; eksik key durumunda explicit throw eder
// ("kieApiKey ayarlanmamış"). Eski env var (KIE_AI_API_KEY) artık okunmuyor.

import "./_bootstrap-env";

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getStorage } from "@/providers/storage";
import { createVariationJobs } from "@/features/variation-generation/services/ai-generation.service";

const ADMIN_EMAIL = "admin@etsyhub.local";
const PRODUCT_TYPE_KEY = "wall_art";
// Aşama 2A canlı smoke geçici çözümü (2026-04-30): kie-gpt-image-1.5
// model id'si KIE'de tanınmıyor (Phase 5 closeout drift #3 — ayrı follow-up).
// Smoke şimdilik kie-z-image text-to-image ile unblock; Phase 6 review
// pipeline'ı canlıda doğrulanır. Reference image input KIE'ye ulaşmıyor;
// pure t2i prompt — review'a giden image variation'ın kendi çıktısı olacak.
const PROVIDER_ID = "kie-z-image"; // text-to-image only

async function main() {
  const db = new PrismaClient();
  try {
    const admin = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (!admin) throw new Error(`admin not found: ${ADMIN_EMAIL}`);

    const productType = await db.productType.findUnique({ where: { key: PRODUCT_TYPE_KEY } });
    if (!productType) throw new Error(`productType not found: ${PRODUCT_TYPE_KEY}`);
    if (!productType.aspectRatio) throw new Error(`productType ${PRODUCT_TYPE_KEY} aspectRatio null`);

    const fixturePath = path.join(
      process.cwd(),
      "tests/fixtures/review/transparent-clean.png",
    );
    const buffer = await fs.readFile(fixturePath);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const storageKey = `smoke/admin-${Date.now()}.png`;

    const storage = getStorage();
    const stored = await storage.upload(storageKey, buffer, { contentType: "image/png" });
    console.log(`✓ Asset uploaded: ${stored.bucket}/${stored.key} (${stored.size}B)`);

    const asset = await db.asset.create({
      data: {
        userId: admin.id,
        storageProvider: "minio",
        storageKey: stored.key,
        bucket: stored.bucket,
        mimeType: "image/png",
        sizeBytes: stored.size,
        width: 64,
        height: 64,
        hash,
      },
    });
    console.log(`✓ Asset row: ${asset.id}`);

    const reference = await db.reference.create({
      data: {
        userId: admin.id,
        assetId: asset.id,
        productTypeId: productType.id,
        notes: "Smoke Aşama 2A reference",
      },
    });
    console.log(`✓ Reference row: ${reference.id}`);

    // i2i için public URL — asset'in signed URL'i (1 saat).
    const referenceImageUrl = await storage.signedUrl(asset.storageKey, 3600);

    // Aşama 2A geçici: z-image text-to-image — referenceImageUrl kullanılmıyor.
    // Aspect ratio z-image'ın desteklediği tek değer "1:1" — wall_art (2:3)
    // burada uyumsuz; smoke için sabit "1:1" override.
    const result = await createVariationJobs({
      userId: admin.id,
      reference,
      providerId: PROVIDER_ID,
      capability: "text-to-image",
      aspectRatio: "1:1",
      quality: "medium",
      brief: "Minimalist abstract wall art with soft pastel colors.",
      count: 1,
      systemPrompt:
        "You are a professional Etsy print-on-demand designer. Generate a high-quality minimalist abstract wall art design with soft pastel colors. No watermarks, no signatures, no logos.",
    });

    console.log(`\n✓ Variation jobs created:`);
    console.log(`  designIds: ${JSON.stringify(result.designIds)}`);
    console.log(`  failedDesignIds: ${JSON.stringify(result.failedDesignIds)}`);

    if (result.designIds.length === 0) {
      throw new Error("createVariationJobs returned 0 design ids");
    }
    console.log(`\n✓ Smoke trigger complete. Design ids saved.`);
    console.log(`  Worker zincirini izlemek için worker terminalinde log'u takip et.`);
    console.log(`  /review → AI Tasarımları sekmesinde sonuç görünecek.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("[smoke-trigger] FAIL:", e);
  process.exit(1);
});
