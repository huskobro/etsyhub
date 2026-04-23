import { ThemesList } from "@/features/admin/themes/themes-list";

export default function AdminThemePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Tema</h1>
        <p className="text-sm text-text-muted">
          Sistem temaları ve aktif tema seçimi.
        </p>
      </div>
      <ThemesList />
    </div>
  );
}
