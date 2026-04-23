import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { createTagInput } from "@/features/tags/schemas";
import { createTag, listTags } from "@/features/tags/services/tag-service";

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const items = await listTags(user.id);
  return NextResponse.json({ items });
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const parsed = createTagInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const tag = await createTag({ userId: user.id, input: parsed.data });
  return NextResponse.json({ tag }, { status: 201 });
});
