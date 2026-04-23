import { FlagsTable } from "@/features/admin/feature-flags/flags-table";

export default function AdminFeatureFlagsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Feature Flags</h1>
        <p className="text-sm text-text-muted">
          Modül ve davranış anahtarları. Değişiklikler audit log&apos;a işlenir.
        </p>
      </div>
      <FlagsTable />
    </div>
  );
}
