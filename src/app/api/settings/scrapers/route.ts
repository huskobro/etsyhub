// R8 — GET / PUT /api/settings/scrapers (admin scope; encrypted)
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  getScrapersSettings,
  updateScrapersSettings,
} from "@/server/services/settings/scrapers.service";

function maskTail(key: string | null): string | null {
  if (!key) return null;
  if (key.length < 4) return "••••";
  return `••••${key.slice(-4)}`;
}

export const GET = withErrorHandling(async () => {
  const admin = await requireAdmin();
  const settings = await getScrapersSettings(admin.id);
  // Plain key dönmez; presence + tail
  return NextResponse.json({
    settings: {
      apifyToken: maskTail(settings.apifyToken),
      firecrawlToken: maskTail(settings.firecrawlToken),
      hasApifyToken: !!settings.apifyToken,
      hasFirecrawlToken: !!settings.firecrawlToken,
      maxConcurrency: settings.maxConcurrency,
      hourlyRateLimit: settings.hourlyRateLimit,
    },
  });
});

const PutSchema = z.object({
  apifyToken: z.union([z.string(), z.null()]).optional(),
  firecrawlToken: z.union([z.string(), z.null()]).optional(),
  maxConcurrency: z.number().int().min(1).max(10).optional(),
  hourlyRateLimit: z.number().int().min(10).max(2000).optional(),
});

export const PUT = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();
  const json = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz scrapers ayarı", parsed.error.flatten());
  }
  const settings = await updateScrapersSettings(admin.id, parsed.data);
  return NextResponse.json({
    settings: {
      apifyToken: maskTail(settings.apifyToken),
      firecrawlToken: maskTail(settings.firecrawlToken),
      hasApifyToken: !!settings.apifyToken,
      hasFirecrawlToken: !!settings.firecrawlToken,
      maxConcurrency: settings.maxConcurrency,
      hourlyRateLimit: settings.hourlyRateLimit,
    },
  });
});
