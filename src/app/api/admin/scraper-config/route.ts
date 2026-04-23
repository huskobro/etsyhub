import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import {
  SCRAPER_PROVIDER_NAMES,
  getScraperConfig,
  updateScraperConfig,
} from "@/providers/scraper/provider-config";

/**
 * Admin scraper provider config.
 *  - GET: maskelenmiş view (plain key asla dönmez).
 *  - PATCH: partial update ({activeProvider?, apiKeys?}).
 *
 * NOT: Bu route doğrudan `db.featureFlag`'a dokunmaz; her şey
 * `provider-config` abstraction'ı üzerinden geçer.
 */

export const GET = withErrorHandling(async () => {
  await requireAdmin();
  const config = await getScraperConfig();
  return NextResponse.json(config);
});

const providerSchema = z.enum(SCRAPER_PROVIDER_NAMES);

// Key validasyon kuralı: ya string (min 10) ya da null (silme).
// undefined = dokunma (zod `.optional()` ile).
const apiKeyField = z.union([z.string().min(10), z.null()]).optional();

const patchBody = z
  .object({
    activeProvider: providerSchema.optional(),
    apiKeys: z
      .object({
        apify: apiKeyField,
        firecrawl: apiKeyField,
      })
      .partial()
      .optional(),
  })
  .strict();

export const PATCH = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();
  const json = (await req.json().catch(() => null)) as unknown;
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  await updateScraperConfig(parsed.data);

  // Audit metadata: plain key ASLA loglanmaz; sadece hangi alan değiştiği
  // ve varsa key aksiyonu ("set" | "cleared").
  const auditMeta: Record<string, unknown> = {};
  if (parsed.data.activeProvider !== undefined) {
    auditMeta.activeProvider = parsed.data.activeProvider;
  }
  if (parsed.data.apiKeys) {
    const keyActions: Record<string, "set" | "cleared"> = {};
    if (parsed.data.apiKeys.apify !== undefined) {
      keyActions.apify = parsed.data.apiKeys.apify === null ? "cleared" : "set";
    }
    if (parsed.data.apiKeys.firecrawl !== undefined) {
      keyActions.firecrawl =
        parsed.data.apiKeys.firecrawl === null ? "cleared" : "set";
    }
    if (Object.keys(keyActions).length > 0) {
      auditMeta.apiKeys = keyActions;
    }
  }

  await audit({
    actor: admin.email,
    userId: admin.id,
    action: "admin.scraperConfig.update",
    targetType: "ScraperConfig",
    metadata: auditMeta,
  });

  // Güncel maskelenmiş view'i geri döneriz (UI invalidate etmeden anlık state).
  const config = await getScraperConfig();
  return NextResponse.json(config);
});
