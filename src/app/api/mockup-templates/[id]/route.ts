/**
 * Phase 66 — User-scope MockupTemplate status transition (PATCH).
 * Phase 69 — Added GET single template + PATCH name/binding config.
 *
 * Templated.io clone publish + edit flow:
 *   - GET: fetch single template (with bindings) for detail/edit page
 *   - PATCH: status transition (DRAFT/ACTIVE/ARCHIVED)
 *           + optional name rename
 *           + optional LOCAL_SHARP binding config update
 *
 * Auth: requireUser
 *
 * Ownership invariant:
 *   - Template userId currentUser olmalı (cross-user PATCH/GET YASAK)
 *   - Global (userId NULL) template'ler için PATCH burada YASAK (admin
 *     endpoint kullan); GET ise public görünürlük olduğu için izinli
 *
 * Publish guard:
 *   - DRAFT → ACTIVE için en az 1 ACTIVE binding gerek (renderable
 *     guarantee). Binding yoksa ValidationError + actionable hint.
 *
 * Phase 69 binding edit:
 *   - PATCH body'sine `bindingConfig` (LOCAL_SHARP shape) opsiyonel
 *   - Server LOCAL_SHARP binding'in config'ini günceller (update)
 *   - Yeni binding yaratmaz; mevcut binding güncellenir (operator'un
 *     "edit existing template" akışı)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { ProviderConfigSchema } from "@/features/mockups/schemas";

const ParamsSchema = z.object({ id: z.string().cuid() });

const patchBody = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
  name: z.string().min(1).max(120).optional(),
  bindingConfig: z.unknown().optional(),
});

export const GET = withErrorHandling(
  async (_req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();
    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Invalid id", params.error.flatten());
    }
    const template = await db.mockupTemplate.findUnique({
      where: { id: params.data.id },
      include: { bindings: true },
    });
    if (!template) throw new NotFoundError("MockupTemplate not found");
    /* Cross-user isolation: user yalnız kendi template'ini veya global
     * (userId NULL) template'i okuyabilir. Başka user'ın template'i 404. */
    if (template.userId !== null && template.userId !== user.id) {
      throw new NotFoundError("MockupTemplate not found");
    }

    return NextResponse.json({
      id: template.id,
      categoryId: template.categoryId,
      name: template.name,
      status: template.status,
      thumbKey: template.thumbKey,
      aspectRatios: template.aspectRatios,
      tags: template.tags,
      estimatedRenderMs: template.estimatedRenderMs,
      archivedAt: template.archivedAt,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      ownership: (template.userId === null ? "global" : "own") as
        | "global"
        | "own",
      bindings: template.bindings,
    });
  },
);

export const PATCH = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    const user = await requireUser();
    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Invalid id", params.error.flatten());
    }
    const parsed = patchBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError("Invalid body", parsed.error.flatten());
    }

    const template = await db.mockupTemplate.findUnique({
      where: { id: params.data.id },
      include: {
        bindings: true,
      },
    });
    if (!template) throw new NotFoundError("MockupTemplate not found");
    if (template.userId === null) {
      throw new ForbiddenError(
        "This is a global admin template. Use the admin endpoint to manage it.",
      );
    }
    if (template.userId !== user.id) {
      throw new NotFoundError("MockupTemplate not found"); // cross-user
    }

    const nextStatus = parsed.data.status ?? template.status;

    /* Publish guard (Phase 66 baseline): DRAFT → ACTIVE requires at
     * least one ACTIVE binding. */
    if (template.status !== "ACTIVE" && nextStatus === "ACTIVE") {
      const activeBindings = template.bindings.filter(
        (b) => b.status === "ACTIVE",
      );
      if (activeBindings.length === 0) {
        throw new ValidationError(
          "Cannot publish: this template has no ACTIVE binding. Add a LOCAL_SHARP binding before publishing.",
        );
      }
    }

    /* Phase 69 — Optional binding config update.
     * Operator authoring sürecini sonradan düzenleyebilir; LOCAL_SHARP
     * binding'in config'ini overwrite eder. */
    if (parsed.data.bindingConfig !== undefined) {
      const cfgWithDiscriminator = {
        ...(parsed.data.bindingConfig as Record<string, unknown>),
        providerId: "local-sharp",
      };
      const cfgParsed = ProviderConfigSchema.safeParse(cfgWithDiscriminator);
      if (!cfgParsed.success) {
        throw new ValidationError(
          "Provider config invalid (LOCAL_SHARP)",
          cfgParsed.error.flatten(),
        );
      }
      const localBinding = template.bindings.find(
        (b) => b.providerId === "LOCAL_SHARP",
      );
      if (!localBinding) {
        throw new ValidationError(
          "No LOCAL_SHARP binding to update. Create one first.",
        );
      }
      await db.mockupTemplateBinding.update({
        where: { id: localBinding.id },
        data: { config: cfgParsed.data as object },
      });
    }

    const updated = await db.mockupTemplate.update({
      where: { id: params.data.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.status !== undefined
          ? {
              status: nextStatus,
              archivedAt: nextStatus === "ARCHIVED" ? new Date() : null,
            }
          : {}),
      },
    });

    return NextResponse.json({
      id: updated.id,
      categoryId: updated.categoryId,
      name: updated.name,
      status: updated.status,
      thumbKey: updated.thumbKey,
      aspectRatios: updated.aspectRatios,
      tags: updated.tags,
      estimatedRenderMs: updated.estimatedRenderMs,
      archivedAt: updated.archivedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      ownership: "own" as const,
    });
  },
);
