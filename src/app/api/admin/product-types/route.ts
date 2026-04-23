import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export const GET = withErrorHandling(async () => {
  await requireAdmin();
  const items = await db.productType.findMany({ orderBy: { displayName: "asc" } });
  return NextResponse.json({ items });
});

const createBody = z.object({
  key: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Sadece küçük harf, rakam, alt çizgi"),
  displayName: z.string().min(1).max(80),
  aspectRatio: z.string().max(10).optional(),
  description: z.string().max(500).optional(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = createBody.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const exists = await db.productType.findUnique({ where: { key: parsed.data.key } });
  if (exists) throw new ConflictError("Key zaten var");
  const created = await db.productType.create({
    data: { ...parsed.data, isSystem: false },
  });
  await audit({
    actor: admin.email,
    userId: admin.id,
    action: "admin.productType.create",
    targetType: "ProductType",
    targetId: created.id,
    metadata: { key: created.key },
  });
  return NextResponse.json({ item: created }, { status: 201 });
});

const patchBody = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1).max(80).optional(),
  aspectRatio: z.string().max(10).optional(),
  description: z.string().max(500).optional(),
});

export const PATCH = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = patchBody.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const { id, ...rest } = parsed.data;
  const updated = await db.productType.update({ where: { id }, data: rest });
  await audit({
    actor: admin.email,
    userId: admin.id,
    action: "admin.productType.update",
    targetType: "ProductType",
    targetId: id,
    metadata: rest,
  });
  return NextResponse.json({ item: updated });
});

const deleteBody = z.object({ id: z.string().min(1) });

export const DELETE = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = deleteBody.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const existing = await db.productType.findUnique({ where: { id: parsed.data.id } });
  if (!existing) throw new NotFoundError();
  if (existing.isSystem) {
    throw new ValidationError("System product type silinemez");
  }
  await db.productType.delete({ where: { id: parsed.data.id } });
  await audit({
    actor: admin.email,
    userId: admin.id,
    action: "admin.productType.delete",
    targetType: "ProductType",
    targetId: parsed.data.id,
    metadata: { key: existing.key },
  });
  return NextResponse.json({ ok: true });
});
