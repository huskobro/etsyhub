// V2 Phase 8 — Admin MockupTemplateBinding management.
//
// Bir MockupTemplate'a binding eklemek/listelemek admin authoring workflow'unun
// ikinci yarısı. V1'de tüm template'ler tek LOCAL_SHARP binding ile geliyordu
// (admin DB-direct seed). V2'de admin browser'dan binding ekleyebilir.
//
// Endpoint sözleşmesi:
//   GET  /api/admin/mockup-templates/[id]/bindings
//        → bu template'in tüm binding'lerini döner (status filter optional)
//   POST /api/admin/mockup-templates/[id]/bindings
//        → yeni binding (DRAFT default; ProviderConfigSchema parse edilir)
//
// Auth: requireAdmin
// Audit: admin.mockupTemplateBinding.create
//
// Provider config disipline:
//   LOCAL_SHARP → LocalSharpConfigSchema (V1 prod path)
//   DYNAMIC_MOCKUPS → DynamicMockupsConfigSchema (V2 stub-only, validate
//     edilebilir ama provider runtime'da PROVIDER_NOT_CONFIGURED throw eder)

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { ProviderConfigSchema } from "@/features/mockups/schemas";

const ParamsSchema = z.object({ id: z.string().cuid() });

// ────────────────────────────────────────────────────────────
// GET — list bindings of a template
// ────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});

export const GET = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    await requireAdmin();

    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const url = new URL(req.url);
    const parsedQuery = listQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
    });
    if (!parsedQuery.success) {
      throw new ValidationError("Geçersiz query", parsedQuery.error.flatten());
    }

    // Template var mı kontrolü (404 disipline)
    const template = await db.mockupTemplate.findUnique({ where: { id: params.data.id } });
    if (!template) throw new NotFoundError("MockupTemplate bulunamadı");

    const items = await db.mockupTemplateBinding.findMany({
      where: {
        templateId: params.data.id,
        ...(parsedQuery.data.status ? { status: parsedQuery.data.status } : {}),
      },
      orderBy: [{ status: "asc" }, { providerId: "asc" }],
    });

    return NextResponse.json({ items });
  },
);

// ────────────────────────────────────────────────────────────
// POST — create binding
// ────────────────────────────────────────────────────────────

const createBody = z.object({
  providerId: z.enum(["LOCAL_SHARP", "DYNAMIC_MOCKUPS"]),
  config: z.unknown(),
  estimatedRenderMs: z.number().int().min(100).max(60_000),
});

export const POST = withErrorHandling(
  async (req: Request, ctx: { params: { id: string } }) => {
    const admin = await requireAdmin();

    const params = ParamsSchema.safeParse(ctx.params);
    if (!params.success) {
      throw new ValidationError("Geçersiz parametre", params.error.flatten());
    }

    const parsed = createBody.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError("Geçersiz body", parsed.error.flatten());
    }

    // Provider config discriminated union parse
    const providerIdLiteral =
      parsed.data.providerId === "LOCAL_SHARP" ? "local-sharp" : "dynamic-mockups";
    const cfgWithDiscriminator = {
      ...(parsed.data.config as Record<string, unknown>),
      providerId: providerIdLiteral,
    };
    const cfgParsed = ProviderConfigSchema.safeParse(cfgWithDiscriminator);
    if (!cfgParsed.success) {
      throw new ValidationError(
        `Provider config geçersiz (${parsed.data.providerId})`,
        cfgParsed.error.flatten(),
      );
    }

    // Template var mı kontrolü
    const template = await db.mockupTemplate.findUnique({ where: { id: params.data.id } });
    if (!template) throw new NotFoundError("MockupTemplate bulunamadı");

    // Aynı (templateId, providerId) çiftine 1 binding sınırı (DB unique)
    const existing = await db.mockupTemplateBinding.findUnique({
      where: { templateId_providerId: { templateId: params.data.id, providerId: parsed.data.providerId } },
    });
    if (existing) {
      throw new ConflictError(
        `Bu template'te ${parsed.data.providerId} binding'i zaten var (id=${existing.id}). Mevcut binding'i düzenle veya başka provider seç.`,
      );
    }

    const created = await db.mockupTemplateBinding.create({
      data: {
        templateId: params.data.id,
        providerId: parsed.data.providerId,
        config: cfgParsed.data as object,
        estimatedRenderMs: parsed.data.estimatedRenderMs,
        version: 1,
        // status default DRAFT (Prisma)
      },
    });

    await audit({
      actor: admin.email,
      userId: admin.id,
      action: "admin.mockupTemplateBinding.create",
      targetType: "MockupTemplateBinding",
      targetId: created.id,
      metadata: {
        templateId: params.data.id,
        providerId: parsed.data.providerId,
      },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  },
);
