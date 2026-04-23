import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { updateBookmarkInput } from "@/features/bookmarks/schemas";
import {
  getBookmark,
  softDeleteBookmark,
  updateBookmark,
} from "@/features/bookmarks/services/bookmark-service";

type Ctx = { params: { id: string } };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const bookmark = await getBookmark({ userId: user.id, id: ctx.params.id });
  return NextResponse.json({ bookmark });
});

export const PATCH = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const parsed = updateBookmarkInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const bookmark = await updateBookmark({
    userId: user.id,
    id: ctx.params.id,
    input: parsed.data,
  });
  return NextResponse.json({ bookmark });
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const bookmark = await softDeleteBookmark({
    userId: user.id,
    id: ctx.params.id,
  });
  return NextResponse.json({ bookmark });
});
