import { requireAdmin } from "@/server/session";
import { getScraperConfig } from "@/providers/scraper/provider-config";
import { ScraperConfigForm } from "@/features/admin/scraper-providers/scraper-config-form";

export default async function AdminScraperProvidersPage() {
  // Admin guard — layout zaten yönlendirir, burada fail-fast olarak tekrar.
  await requireAdmin();

  // Server-side ilk çekim: client hydrate olurken boş görünmesin diye
  // maskelenmiş config'i önceden görünür hâle getiriyoruz (sadece
  // bilgilendirici başlık — React Query yine yeniden fetch eder).
  const initial = await getScraperConfig();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Scraper Sağlayıcıları</h1>
        <p className="text-sm text-text-muted">
          Rakip tarama ve listing parse işleri için aktif sağlayıcı ve şifreli
          API anahtarları yönetimi. Mevcut aktif: {" "}
          <span className="font-mono text-text">{initial.activeProvider}</span>
        </p>
      </div>
      <ScraperConfigForm />
    </div>
  );
}
