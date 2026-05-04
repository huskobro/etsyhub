// V2 Phase 8 (Pass 15) — Admin MockupTemplate clone endpoint.
//
// Admin authoring workflow ergonomics: 8 kategori × N varyant seed'lerken
// her template'i sıfırdan yazmak ağır. Clone bir template + tüm bindings'i
// kopyalayıp DRAFT olarak yeni record üretir.
//
// Davranış:
//   - Source template DB'den okunur (status fark etmez — ACTIVE/DRAFT/ARCHIVED
//     hepsi clone'lanabilir, çünkü clone DRAFT olarak yaratılır)
//   - Yeni MockupTemplate yaratılır:
//       categoryId: source ile aynı
//       name: body.name (admin değiştirir; çakışma kontrolü YOK — DB'de unique constraint yok)
//       thumbKey/aspectRatios/tags/estimatedRenderMs: source'tan kopya
//       status: DRAFT (her zaman; admin sonra Yayınla'yla ACTIVE'e geçirir)
//   - Source'un tüm bindings'i transaction içinde kopyalanır:
//       providerId/config/estimatedRenderMs source'tan kopya
//       version: 1 (clone yeni binding lineage'ı)
//       status: DRAFT (her zaman; admin Yayınla'yla aktive eder)
//   - Atomic transaction (template + bindings birlikte yaratılır veya hiçbiri)
//   - Audit: admin.mockupTemplate.clone (sourceId metadata'da)
//
// Render history: Sadece source'un render'ları source'a referanslı kalır
// (FK templateId/bindingId değişmedi). Clone'un render'ı yok (yeni record).
//
// Cross-template config snapshot: ProviderConfigSchema runtime parse YAPILMAZ
// (source'un config'i zaten parse edilmiş şekilde kaydedildi; admin clone'da
// validate-config endpoint'iyle ayrıca doğrular).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError, ValidationError } from "@/lib/errors";

const ParamsSchema = z.object({ id: z.string().cuid() });

const PostBody = z.object({
  // Yeni template adı zorunlu — admin "Copy of X" gibi default değerle gelir
  // ama opaklık yerine admin'in ekrandan edit etmesi tercih edilir.
  name: z.string().min(1).max(120),
});

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    const admin = await requireAdmin();

    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const parsed = PostBody.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError("Geçersiz body", parsed.error.flatten());
    }

    const source = await db.mockupTemplate.findUnique({
      where: { id: params.data.id },
      include: { bindings: true },
    });
    if (!source) {
      throw new NotFoundError("Template bulunamadı");
    }

    // Atomic clone: yeni template + bindings tek transaction
    const clone = await db.$transaction(async (tx) => {
      const tpl = await tx.mockupTemplate.create({
        data: {
          categoryId: source.categoryId,
          name: parsed.data.name,
          thumbKey: source.thumbKey,
          aspectRatios: source.aspectRatios,
          tags: source.tags,
          estimatedRenderMs: source.estimatedRenderMs,
          // status default DRAFT
        },
      });

      // Bindings'i kopyala — provider config aynen aktarılır
      // (config Prisma JsonValue; source.config valid kabul edilir)
      if (source.bindings.length > 0) {
        await tx.mockupTemplateBinding.createMany({
          data: source.bindings.map((b) => ({
            templateId: tpl.id,
            providerId: b.providerId,
            config: b.config as object,
            estimatedRenderMs: b.estimatedRenderMs,
            version: 1, // clone yeni lineage
            // status default DRAFT (Prisma schema)
          })),
        });
      }

      return tpl;
    });

    await audit({
      actor: admin.email,
      userId: admin.id,
      action: "admin.mockupTemplate.clone",
      targetType: "MockupTemplate",
      targetId: clone.id,
      metadata: {
        sourceId: source.id,
        bindingCount: source.bindings.length,
        categoryId: clone.categoryId,
      },
    });

    return NextResponse.json({ item: clone }, { status: 201 });
  },
);
