// IA-29 (CLAUDE.md Madde V) — Active local root filter helper.
//
// Tüm local review surface'lerinin (queue, picker, scope navigation,
// scope-trigger, bulk decisions, folders endpoint, total pending
// count) aktif rootFolderPath altındaki asset'lere sınırlanması için
// tek nokta. Operatör root değiştirdiğinde eski path'lerden hiçbir
// asset UI'ya sızmaz; asset row'ları korunur (silinmez), sadece
// gizlenir.
//
// Async olmasının nedeni Settings'i okumak; çağrı tarafı genelde
// zaten async (route handler veya server action). Cache helper'ı
// gerekirse ileride eklenebilir (per-request memo).

import { getUserLocalLibrarySettings } from "@/features/settings/local-library/service";

/**
 * Returns a Prisma `where` fragment that scopes LocalLibraryAsset
 * queries to the active rootFolderPath. When no root is set, the
 * fragment is empty (no path filter) — review surface still works,
 * just shows nothing (operator told to set a root first).
 *
 * Usage:
 *   const rootFilter = await getActiveLocalRootFilter(userId);
 *   await db.localLibraryAsset.findMany({
 *     where: { userId, ...rootFilter, ... },
 *   });
 */
export async function getActiveLocalRootFilter(
  userId: string,
): Promise<{ folderPath?: { startsWith: string } }> {
  const settings = await getUserLocalLibrarySettings(userId);
  const root = settings.rootFolderPath;
  if (!root) return {};
  return { folderPath: { startsWith: root } };
}

/**
 * Sync raw filter — when caller already loaded settings and wants
 * to thread the value through multiple queries without a second
 * read. Returns the same shape.
 */
export function buildLocalRootFilter(
  rootFolderPath: string | null | undefined,
): { folderPath?: { startsWith: string } } {
  if (!rootFolderPath) return {};
  return { folderPath: { startsWith: rootFolderPath } };
}
