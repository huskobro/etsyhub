import { requireUser } from "@/server/session";
import { Card } from "@/components/ui/Card";
import { LocalLibrarySettingsPanel } from "@/features/settings/local-library/components/local-library-settings-panel";
import { AiModeSettingsPanel } from "@/features/settings/ai-mode/components/ai-mode-settings-panel";
import { EtsyConnectionSettingsPanel } from "@/features/settings/etsy-connection/components/etsy-connection-settings-panel";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Ayarlar</h1>
      <Card variant="stat" className="p-5">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-text-muted">E-posta</dt>
          <dd className="text-text">{user.email}</dd>
          <dt className="text-text-muted">Rol</dt>
          <dd className="text-text">{user.role}</dd>
        </dl>
      </Card>

      {/* Phase 5 Task 15 — operator-facing settings (Settings Registry kuralı). */}
      <LocalLibrarySettingsPanel />
      <AiModeSettingsPanel />
      {/* Phase 9 V1 — Etsy bağlantı paneli (OAuth flow). */}
      <EtsyConnectionSettingsPanel />
    </div>
  );
}
