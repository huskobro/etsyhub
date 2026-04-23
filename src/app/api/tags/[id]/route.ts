import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { updateTagInput } from "@/features/tags/schemas";
import { deleteTag, updateTag } from "@/features/tags/services/tag-service";

type Ctx = { params: { id: string } };

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const parsed = updateTagInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const tag = await updateTag({
    userId: user.id,
    id: ctx.params.id,
    input: parsed.data,
  });
  return NextResponse.json({ tag });
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const result = await deleteTag({ userId: user.id, id: ctx.params.id });
  return NextResponse.json(result);
});
