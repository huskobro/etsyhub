// V2 Phase 8 — Admin MockupTemplateBinding detail.
//
// PATCH: status transition (DRAFT ↔ ACTIVE ↔ ARCHIVED) + config / estimatedRenderMs.
// DELETE: hard delete (sadece bu binding'e bağlı render olmayan template'ler).
//
// Render protection: MockupRender.bindingId FK; mevcut render'lar varsa
// delete reject (admin önce ARCHIVED yapmalı).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { ProviderConfigSchema } from "@/features/mockups/schemas";

const ParamsSchema = z.object({
  id: z.string().cuid(),
  bindingId: z.string().cuid(),
});

// ────────────────────────────────────────────────────────────
// PATCH
// ────────────────────────────────────────────────────────────

const patchBody = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  config: z.unknown().optional(),
  estimatedRenderMs: z.number().int().min(100).max(60_000).optional(),
});

export const PATCH = withErrorHandling(
  async (req: Request, ctx: { params: { id: string; bindingId: string } }) => {
    const admin = await requireAdmin();

    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const parsed = patchBody.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError("Geçersiz body", parsed.error.flatten());
    }
    if (Object.keys(parsed.data).length === 0) {
      throw new ValidationError("En az bir alan güncellenmeli");
    }

    // Binding var mı + parent template id eşleşiyor mu (cross-template prevent)
    const existing = await db.mockupTemplateBinding.findUnique({
      where: { id: params.data.bindingId },
    });
    if (!existing || existing.templateId !== params.data.id) {
      throw new NotFoundError("Binding bulunamadı");
    }

    // Config gönderilmişse provider'a göre discriminated union parse
    let configToWrite: object | undefined = undefined;
    if (parsed.data.config !== undefined) {
      const providerIdLiteral =
        existing.providerId === "LOCAL_SHARP" ? "local-sharp" : "dynamic-mockups";
      const cfgWithDiscriminator = {
        ...(parsed.data.config as Record<string, unknown>),
        providerId: providerIdLiteral,
      };
      const cfgParsed = ProviderConfigSchema.safeParse(cfgWithDiscriminator);
      if (!cfgParsed.success) {
        throw new ValidationError(
          `Provider config geçersiz (${existing.providerId})`,
          cfgParsed.error.flatten(),
        );
      }
      configToWrite = cfgParsed.data as object;
    }

    // ARCHIVED transition'da archivedAt set; non-ARCHIVED'a dönerken null
    const data: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status;
      if (parsed.data.status === "ARCHIVED" && existing.status !== "ARCHIVED") {
        data.archivedAt = new Date();
      } else if (parsed.data.status !== "ARCHIVED" && existing.archivedAt) {
        data.archivedAt = null;
      }
    }
    if (parsed.data.estimatedRenderMs !== undefined) {
      data.estimatedRenderMs = parsed.data.estimatedRenderMs;
    }
    if (configToWrite !== undefined) {
      data.config = configToWrite;
      // Config edit'inde version bump (audit trail)
      data.version = existing.version + 1;
    }

    const updated = await db.mockupTemplateBinding.update({
      where: { id: params.data.bindingId },
      data,
    });

    await audit({
      actor: admin.email,
      userId: admin.id,
      action: "admin.mockupTemplateBinding.update",
      targetType: "MockupTemplateBinding",
      targetId: updated.id,
      metadata: {
        templateId: params.data.id,
        ...parsed.data,
        ...(configToWrite ? { configUpdated: true } : {}),
      },
    });

    return NextResponse.json({ item: updated });
  },
);

// ────────────────────────────────────────────────────────────
// DELETE
// ────────────────────────────────────────────────────────────

export const DELETE = withErrorHandling(
  async (
    _req: Request,
    ctx: { params: { id: string; bindingId: string } },
  ) => {
    const admin = await requireAdmin();

    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const existing = await db.mockupTemplateBinding.findUnique({
      where: { id: params.data.bindingId },
    });
    if (!existing || existing.templateId !== params.data.id) {
      throw new NotFoundError("Binding bulunamadı");
    }

    // Render history protection
    const renderCount = await db.mockupRender.count({
      where: { bindingId: existing.id },
    });
    if (renderCount > 0) {
      throw new ConflictError(
        `Binding render history içeriyor (${renderCount} render); silinemez. Önce ARCHIVED yap.`,
      );
    }

    await db.mockupTemplateBinding.delete({ where: { id: existing.id } });

    await audit({
      actor: admin.email,
      userId: admin.id,
      action: "admin.mockupTemplateBinding.delete",
      targetType: "MockupTemplateBinding",
      targetId: existing.id,
      metadata: {
        templateId: params.data.id,
        providerId: existing.providerId,
      },
    });

    return NextResponse.json({ ok: true });
  },
);
