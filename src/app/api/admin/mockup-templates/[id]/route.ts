// V2 Phase 8 — Admin MockupTemplate detail endpoint.
//
// PATCH: status transition (DRAFT ↔ ACTIVE ↔ ARCHIVED) + metadata edit
//        (name + tags + thumbKey + aspectRatios + estimatedRenderMs).
// DELETE: hard delete (yalnız hiç bağlı render olmayan template'ler).
//
// Status transition disipline:
//   DRAFT  → ACTIVE  (publish)
//   ACTIVE → ARCHIVED (deprecate; mevcut render'lar etkilenmez —
//                      MockupRender.templateSnapshot stable)
//   ACTIVE → DRAFT   (geri çek; render durur, mevcut render'lar etkilenmez)
//   ARCHIVED → DRAFT (geri restore)
//   ARCHIVED → ACTIVE (direct publish — admin warning yok V2'de)
//
// Render protection: status değişikliği MockupRender.templateSnapshot'ı
// bozmaz (snapshot sözleşmesi Phase 8 §3.3 byte-stable yeniden üretim).
//
// Auth: requireAdmin
// Audit: admin.mockupTemplate.update / .delete

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

const ParamsSchema = z.object({ id: z.string().cuid() });

// ────────────────────────────────────────────────────────────
// PATCH — status transition + metadata edit
// ────────────────────────────────────────────────────────────

const patchBody = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  name: z.string().min(1).max(120).optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  // V2 admin authoring (HEAD `d1fee51`+): aspectRatios + thumbKey +
  // estimatedRenderMs admin formundan düzenlenebilir. categoryId immutable
  // (DB integrity — değişirse mevcut render snapshot'lar yanıltıcı olur;
  // değiştirme istenirse yeni template oluşturulmalı).
  thumbKey: z.string().min(1).max(500).optional(),
  aspectRatios: z.array(z.string().min(1).max(10)).min(1).max(8).optional(),
  estimatedRenderMs: z.number().int().min(100).max(60_000).optional(),
});

export const PATCH = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    const admin = await requireAdmin();

    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const parsed = patchBody.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError("Geçersiz body", parsed.error.flatten());
    }

    // En az bir field güncellensin
    if (Object.keys(parsed.data).length === 0) {
      throw new ValidationError("En az bir alan güncellenmeli");
    }

    const existing = await db.mockupTemplate.findUnique({
      where: { id: params.data.id },
    });
    if (!existing) throw new NotFoundError("MockupTemplate bulunamadı");

    // ARCHIVED status set'i edilirken archivedAt timestamp set
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.status === "ARCHIVED" && existing.status !== "ARCHIVED") {
      data.archivedAt = new Date();
    } else if (parsed.data.status && parsed.data.status !== "ARCHIVED" && existing.archivedAt) {
      data.archivedAt = null;
    }

    const updated = await db.mockupTemplate.update({
      where: { id: params.data.id },
      data,
    });

    await audit({
      actor: admin.email,
      userId: admin.id,
      action: "admin.mockupTemplate.update",
      targetType: "MockupTemplate",
      targetId: updated.id,
      metadata: parsed.data,
    });

    return NextResponse.json({ item: updated });
  },
);

// ────────────────────────────────────────────────────────────
// DELETE — hard delete (sadece hiç render bağlı olmayan template'ler)
// ────────────────────────────────────────────────────────────

export const DELETE = withErrorHandling(
  async (_req: Request, ctx: { params: { id: string } }) => {
    const admin = await requireAdmin();

    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const existing = await db.mockupTemplate.findUnique({
      where: { id: params.data.id },
      include: { bindings: true },
    });
    if (!existing) throw new NotFoundError("MockupTemplate bulunamadı");

    // MockupRender bu template'in herhangi bir binding'ine işaret ediyorsa
    // delete reject (audit trail koruması — Phase 8 templateSnapshot stable).
    const renderCount = await db.mockupRender.count({
      where: { bindingId: { in: existing.bindings.map((b) => b.id) } },
    });
    if (renderCount > 0) {
      throw new ConflictError(
        `MockupTemplate render history içeriyor (${renderCount} render); silinemez. Önce ARCHIVED yap.`,
      );
    }

    // Bindings cascade silinir (Prisma onDelete: Cascade)
    await db.mockupTemplate.delete({ where: { id: params.data.id } });

    await audit({
      actor: admin.email,
      userId: admin.id,
      action: "admin.mockupTemplate.delete",
      targetType: "MockupTemplate",
      targetId: existing.id,
      metadata: { categoryId: existing.categoryId, name: existing.name },
    });

    return NextResponse.json({ ok: true });
  },
);
