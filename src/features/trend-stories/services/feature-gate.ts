import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";

/**
 * Trend Stories ve bağımlı Competitors feature flag'lerini kontrol eder.
 *
 * Framework-agnostic: yalnız NotFoundError atar. Next.js notFound() import
 * edilmez. API route → global error boundary 404 JSON'a çevirir. Server
 * component → notFound() çağırma sorumluluğu page'e ait (Task 12 pattern'ı).
 */
export async function assertTrendStoriesAvailable(): Promise<void> {
  const flags = await db.featureFlag.findMany({
    where: { key: { in: ["trend_stories.enabled", "competitors.enabled"] } },
  });
  const trend =
    flags.find((f) => f.key === "trend_stories.enabled")?.enabled ?? false;
  const comp =
    flags.find((f) => f.key === "competitors.enabled")?.enabled ?? false;
  if (!trend || !comp) throw new NotFoundError();
}
