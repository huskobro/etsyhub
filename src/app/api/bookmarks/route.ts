import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  createBookmarkInput,
  listBookmarksQuery,
} from "@/features/bookmarks/schemas";
import {
  createBookmark,
  listBookmarks,
} from "@/features/bookmarks/services/bookmark-service";

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const parsed = listBookmarksQuery.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    throw new ValidationError("Geçersiz sorgu", parsed.error.flatten());
  }
  const result = await listBookmarks({ userId: user.id, query: parsed.data });
  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const parsed = createBookmarkInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const bookmark = await createBookmark({
    userId: user.id,
    input: parsed.data,
  });
  return NextResponse.json({ bookmark }, { status: 201 });
});
