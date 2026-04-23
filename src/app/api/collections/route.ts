import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  createCollectionInput,
  listCollectionsQuery,
} from "@/features/collections/schemas";
import {
  createCollection,
  listCollections,
} from "@/features/collections/services/collection-service";

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const parsed = listCollectionsQuery.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    throw new ValidationError("Geçersiz sorgu", parsed.error.flatten());
  }
  const items = await listCollections({ userId: user.id, query: parsed.data });
  return NextResponse.json({ items });
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const parsed = createCollectionInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const collection = await createCollection({
    userId: user.id,
    input: parsed.data,
  });
  return NextResponse.json({ collection }, { status: 201 });
});
