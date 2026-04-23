import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";

export const GET = withErrorHandling(async (req: Request) => {
  await requireAdmin();
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? undefined;
  const actor = url.searchParams.get("actor") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);
  const logs = await db.auditLog.findMany({
    where: {
      action: action ? { contains: action, mode: "insensitive" } : undefined,
      actor: actor ? { contains: actor, mode: "insensitive" } : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ logs });
});
