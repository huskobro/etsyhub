"use client";

// Phase 8 Task 25 — IncompatibleSetBand.
//
// Spec §5.2 — Uyumsuzluk uyarı bandı.
// Set'in aspectRatio'su hiçbir template ile match etmiyorsa gösterilir.
//
// Kullanım:
// - PackPreviewCard'ın üstünde, warning durumunda
// - Turuncu/warn renginde bilgilendirme

export function IncompatibleSetBand() {
  return (
    <div className="rounded-md bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-900">
        ⚠ Seçili set parametreleriyle uyumlu mockup şablonu bulunamadı
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Lütfen Özel Seçim yaparak manuel olarak şablon seçiniz.
      </p>
    </div>
  );
}
