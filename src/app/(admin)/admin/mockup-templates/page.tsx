import { MockupTemplatesManager } from "@/features/admin/mockup-templates/mockup-templates-manager";

export default function AdminMockupTemplatesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Mockup Template&apos;leri</h1>
        <p className="text-sm text-text-muted">
          Phase 8 V2 — Multi-Category mockup template lifecycle yönetimi.
          DRAFT → ACTIVE (yayınla) → ARCHIVED (deprecate). ARCHIVED
          template&apos;ler mevcut render&apos;ları bozmaz (templateSnapshot
          stable).
        </p>
      </div>
      <MockupTemplatesManager />
    </div>
  );
}
