import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  createReferenceInput,
  listReferencesQuery,
} from "@/features/references/schemas";
import {
  createReference,
  listReferences,
} from "@/features/references/services/reference-service";

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const parsed = listReferencesQuery.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    throw new ValidationError("Geçersiz sorgu", parsed.error.flatten());
  }
  const result = await listReferences({ userId: user.id, query: parsed.data });
  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const parsed = createReferenceInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const reference = await createReference({
    userId: user.id,
    input: parsed.data,
  });
  return NextResponse.json({ reference }, { status: 201 });
});
