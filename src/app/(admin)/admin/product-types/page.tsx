import { ProductTypesManager } from "@/features/admin/product-types/product-types-manager";

export default function AdminProductTypesPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Product Types</h1>
        <p className="text-sm text-text-muted">
          Sistem tipleri korunur; kullanıcı ekleri (isSystem=false) silinebilir.
        </p>
      </div>
      <ProductTypesManager />
    </div>
  );
}
