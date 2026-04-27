// Phase 5 §4 — variation-jobs createN + list endpoints.
//
// Sözleşme:
//   - POST: N design + N job + enqueue×N (Task 12 service)
//   - GET:  user-scoped list (referenceId zorunlu)
//
// Capability enforcement (R17.1 — sessiz fallback YOK):
//   - reference.asset.sourceUrl var → i2i seçilir
//   - i2i seçildi ve provider desteklemiyorsa → 400 explicit reject
//   - sourceUrl yok (local kaynaklı) → 400 (R17.2 local→AI bridge yok)
//
// URL doğrulama (Q5): checkUrlPublic ile HEAD request — ok değilse 400.
import { NextResponse } from "next/server";
import { z } from "zod";
import { PromptStatus } from "@prisma/client";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { getImageProvider } from "@/providers/image/registry";
import { checkUrlPublic } from "@/features/variation-generation/url-public-check";
import { createVariationJobs } from "@/features/variation-generation/services/ai-generation.service";
import type { ImageCapability } from "@/providers/image/types";

const CreateBody = z.object({
  referenceId: z.string(),
  providerId: z.string(),
  aspectRatio: z.enum(["1:1", "2:3", "3:2", "4:3", "3:4", "16:9", "9:16"]),
  quality: z.enum(["medium", "high"]).optional(),
  brief: z.string().max(500).optional(),
  count: z.number().int().min(1).max(6).default(3),
});

export async function POST(req: Request) {
  let user: { id: string };
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof CreateBody>;
  try {
    const json = await req.json();
    const parsed = CreateBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "invalid body" },
        { status: 400 },
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Ownership: reference yalnız sahibi user görebilir.
  const reference = await db.reference.findFirst({
    where: { id: body.referenceId, userId: user.id },
    include: { asset: true },
  });
  if (!reference) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // R17.2: local kaynaklı reference (Asset.sourceUrl null) AI mode'da
  // kullanılamaz. Local→AI bridge YOK; bu kasıtlı.
  const referenceImageUrl = reference.asset.sourceUrl;
  if (!referenceImageUrl) {
    return NextResponse.json(
      {
        error:
          "Bu reference local kaynaklı. AI mode şu an yalnız URL-kaynaklı reference'larla çalışıyor.",
      },
      { status: 400 },
    );
  }

  // Q5: public URL doğrulama (HEAD request + cache).
  const urlCheck = await checkUrlPublic(referenceImageUrl);
  if (!urlCheck.ok) {
    return NextResponse.json(
      {
        error: `Reference URL public doğrulanamadı: ${
          urlCheck.reason ?? `HTTP ${urlCheck.status}`
        }`,
      },
      { status: 400 },
    );
  }

  // Provider lookup — registry bilinmeyen id throws → 400.
  let provider;
  try {
    provider = getImageProvider(body.providerId);
  } catch {
    return NextResponse.json(
      { error: `Bilinmeyen provider: ${body.providerId}` },
      { status: 400 },
    );
  }

  // R17.1: capability decision. Public URL var (yukarıda doğrulandı) → i2i.
  // Provider desteklemiyorsa explicit reject — sessiz fallback YOK.
  const capability: ImageCapability = "image-to-image";
  if (!provider.capabilities.includes(capability)) {
    return NextResponse.json(
      {
        error: `Provider "${body.providerId}" "${capability}" capability'sini desteklemiyor; sessiz fallback yok. Lütfen i2i destekli bir model seçin.`,
      },
      { status: 400 },
    );
  }

  // Master prompt resolution — productType.key + ACTIVE PromptVersion.
  const systemPrompt = await resolveSystemPrompt(reference.productTypeId);
  const promptVersionId = await resolveActivePromptVersionId(
    reference.productTypeId,
  );

  const out = await createVariationJobs({
    userId: user.id,
    reference,
    referenceImageUrl,
    providerId: body.providerId,
    capability,
    aspectRatio: body.aspectRatio,
    quality: body.quality,
    brief: body.brief,
    count: body.count,
    systemPrompt,
    promptVersionId,
  });
  return NextResponse.json(out);
}

export async function GET(req: Request) {
  let user: { id: string };
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const referenceId = searchParams.get("referenceId");
  if (!referenceId) {
    return NextResponse.json(
      { error: "referenceId required" },
      { status: 400 },
    );
  }
  const designs = await db.generatedDesign.findMany({
    where: { userId: user.id, referenceId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ designs });
}

// PromptTemplate.activeVersion ilişkisi YOK (schema gerçeği). status field
// PromptVersion'da; templateId üzerinden ACTIVE version filtrelenir.
async function resolveSystemPrompt(productTypeId: string): Promise<string> {
  const pt = await db.productType.findUnique({ where: { id: productTypeId } });
  if (!pt) return "variation, high quality";
  const tpl = await db.promptTemplate.findFirst({
    where: { productTypeKey: pt.key, taskType: "image-variation" },
    include: {
      versions: {
        where: { status: PromptStatus.ACTIVE },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });
  return tpl?.versions[0]?.systemPrompt ?? `${pt.key} variation, high quality`;
}

async function resolveActivePromptVersionId(
  productTypeId: string,
): Promise<string | null> {
  const pt = await db.productType.findUnique({ where: { id: productTypeId } });
  if (!pt) return null;
  const tpl = await db.promptTemplate.findFirst({
    where: { productTypeKey: pt.key, taskType: "image-variation" },
    include: {
      versions: {
        where: { status: PromptStatus.ACTIVE },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });
  return tpl?.versions[0]?.id ?? null;
}
