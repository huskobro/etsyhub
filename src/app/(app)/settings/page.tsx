import { requireUser } from "@/server/session";
import { Card } from "@/components/ui/Card";

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
      <p className="text-sm text-text-muted">
        Mağaza bağlantıları, Etsy token&apos;ları ve preset&apos;ler Phase 3+&apos;da eklenecek.
      </p>
    </div>
  );
}
