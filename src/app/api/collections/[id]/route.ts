import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { updateCollectionInput } from "@/features/collections/schemas";
import {
  getCollection,
  softDeleteCollection,
  updateCollection,
} from "@/features/collections/services/collection-service";

type Ctx = { params: { id: string } };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const collection = await getCollection({ userId: user.id, id: ctx.params.id });
  return NextResponse.json({ collection });
});

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const parsed = updateCollectionInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const collection = await updateCollection({
    userId: user.id,
    id: ctx.params.id,
    input: parsed.data,
  });
  return NextResponse.json({ collection });
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const collection = await softDeleteCollection({
    userId: user.id,
    id: ctx.params.id,
  });
  return NextResponse.json({ collection });
});
