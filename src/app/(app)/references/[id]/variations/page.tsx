import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { getUserAiModeSettings } from "@/features/settings/ai-mode/service";
import { VariationsPage } from "@/features/variation-generation/components/variations-page";

/**
 * Batch-first Phase 8 — Variations page artık server-side settings okuyor.
 *
 * Phase 7'de `defaultImageProvider` field UserSetting'e eklenmişti ama
 * UI consumer'da bağlı değildi (ai-mode-form.tsx hardcoded
 * "kie-gpt-image-1.5" kullanıyordu). Phase 8 fit-and-finish bu wiring'i
 * tamamlar:
 *
 *   - Page server component → getUserAiModeSettings(userId)
 *   - VariationsPage'e initialProviderId prop pass
 *   - AiModePanel → AiModeForm initial state
 *
 * Default Midjourney (kullanıcı kararı). Settings'te değiştirilebilir;
 * batch bazında dropdown override edilebilir.
 */

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const resolved = await Promise.resolve(params);
  const settings = await getUserAiModeSettings(session.user.id);
  return (
    <VariationsPage
      referenceId={resolved.id}
      initialProviderId={settings.defaultImageProvider}
    />
  );
}
