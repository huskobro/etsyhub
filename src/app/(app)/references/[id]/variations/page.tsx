import { redirect } from "next/navigation";
import { auth } from "@/server/auth";

/**
 * Phase 45 — Legacy route hard redirect.
 *
 * Phase 44'te `/references/[id]/variations` deprecation banner ile bridge
 * olarak tutulmuştu. Phase 45 queue/staging modeli oturduğu için yeni
 * canonical akış net: References Pool → Add to Draft → BatchQueuePanel →
 * Create Similar (compose page). Eski tek-reference variation page'i
 * artık operatör için faydalı değil.
 *
 * Karar: server-side hard redirect → `/references`. Operatör eski deep
 * link'lerden veya URL geçmişinden gelirse otomatik Pool'a düşer; orada
 * "Add to Draft" ile yeni akışa girer. Eski URL'lerin hâlâ "var olduğu"
 * ama yeniden hangi yönde olduğu net (302).
 *
 * VariationsPage component ve `AiModePanel` mevcut — Phase 45'te
 * silinmedi (potansiyel future reuse + git history için). Sadece bu
 * route entry kaldırıldı.
 */

export default async function LegacyVariationsRedirect() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect("/references");
}
