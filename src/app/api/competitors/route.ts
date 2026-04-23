import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  addCompetitorInput,
  listCompetitorsQuery,
} from "@/features/competitors/schemas";
import {
  addCompetitor,
  listCompetitors,
} from "@/features/competitors/services/competitor-service";
import { audit } from "@/server/audit";

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const parsed = listCompetitorsQuery.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    throw new ValidationError("Geçersiz sorgu", parsed.error.flatten());
  }
  const result = await listCompetitors(user.id, parsed.data);
  return NextResponse.json(result);
});

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const parsed = addCompetitorInput.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const competitor = await addCompetitor(user.id, parsed.data);
  await audit({
    actor: user.id,
    userId: user.id,
    action: "competitor.create",
    targetType: "CompetitorStore",
    targetId: competitor.id,
    metadata: {
      etsyShopName: competitor.etsyShopName,
      platform: competitor.platform,
    },
  });
  return NextResponse.json({ competitor }, { status: 201 });
});
