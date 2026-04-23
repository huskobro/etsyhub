import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { promoteBookmarkInput } from "@/features/references/schemas";
import { createReferenceFromBookmark } from "@/features/references/services/reference-service";

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const parsed = promoteBookmarkInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const reference = await createReferenceFromBookmark({
    userId: user.id,
    input: parsed.data,
  });
  return NextResponse.json({ reference }, { status: 201 });
});
