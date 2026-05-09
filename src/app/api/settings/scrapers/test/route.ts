// R9 — POST /api/settings/scrapers/test (admin scope)
//
// Scraper token "ping" — gerçek bir scrape job enqueue etmez (full
// orchestration R10), ama operatöre "token bağlantı kuruluyor mu?"
// sorusunun gerçek cevabını verir:
//   · Apify: GET https://api.apify.com/v2/users/me?token=...
//   · Firecrawl: GET https://api.firecrawl.dev/v0/me (Authorization:
//     Bearer token)
//
// Dış servisler erişilemiyorsa (offline ortam) graceful failure: HTTP
// status veya network hatası UI'a yansır. Token rate limit'e takılırsa
// yine HTTP cevap dönecek.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { getScrapersSettings } from "@/server/services/settings/scrapers.service";

const InputSchema = z.object({
  provider: z.enum(["apify", "firecrawl"]),
});

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();
  const json = await req.json().catch(() => null);
  const parsed = InputSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz scraper test girişi", parsed.error.flatten());
  }
  const settings = await getScrapersSettings(admin.id);
  const token =
    parsed.data.provider === "apify"
      ? settings.apifyToken
      : settings.firecrawlToken;
  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        provider: parsed.data.provider,
        reason: "no-token",
      },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.provider === "apify") {
      const r = await fetch(
        `https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`,
        { method: "GET", cache: "no-store" },
      );
      const ok = r.ok;
      let userId: string | null = null;
      if (ok) {
        const body = (await r.json().catch(() => ({}))) as {
          data?: { id?: string };
        };
        userId = body?.data?.id ?? null;
      }
      return NextResponse.json({
        ok,
        provider: "apify",
        status: r.status,
        userId,
      });
    }
    // firecrawl
    const r = await fetch("https://api.firecrawl.dev/v0/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return NextResponse.json({
      ok: r.ok,
      provider: "firecrawl",
      status: r.status,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      provider: parsed.data.provider,
      reason: "network-error",
      error: (err as Error).message,
    });
  }
});
