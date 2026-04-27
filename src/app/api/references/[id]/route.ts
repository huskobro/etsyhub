import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { updateReferenceInput } from "@/features/references/schemas";
import {
  softDeleteReference,
  updateReference,
} from "@/features/references/services/reference-service";

type Ctx = { params: { id: string } };

// GET /api/references/[id] — varlık sızıntısı yok: cross-user durum 404.
// Doğrudan `findFirst({ id, userId, deletedAt: null })` kullanılır; service'in
// 403 atan `getReference`'i diğer akışlarda kalır (Phase 5 Gap A sözleşmesi).
//
// Payload: AI mode UI (Task 14) `reference.asset.sourceUrl` ve
// `reference.productType.key` okur; bu alanlar zorunlu include.
export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const reference = await db.reference.findFirst({
    where: { id: ctx.params.id, userId: user.id, deletedAt: null },
    include: {
      asset: true,
      productType: true,
      collection: true,
      bookmark: true,
      tags: { include: { tag: true } },
    },
  });
  if (!reference) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ reference });
});

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const parsed = updateReferenceInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const reference = await updateReference({
    userId: user.id,
    id: ctx.params.id,
    input: parsed.data,
  });
  return NextResponse.json({ reference });
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const reference = await softDeleteReference({
    userId: user.id,
    id: ctx.params.id,
  });
  return NextResponse.json({ reference });
});
