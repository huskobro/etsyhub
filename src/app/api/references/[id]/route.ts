import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { updateReferenceInput } from "@/features/references/schemas";
import {
  getReference,
  softDeleteReference,
  updateReference,
} from "@/features/references/services/reference-service";

type Ctx = { params: { id: string } };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const reference = await getReference({ userId: user.id, id: ctx.params.id });
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
