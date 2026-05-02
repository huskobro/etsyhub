// Phase 8 Task 24 — Set Özeti kartı (bağlam, kalite, meta).
//
// Spec §5.2.1: Set adı, asset count, ortalama kalite skoru, collection
// etiketleri ve "Set İstatistikleri" badgelerinden oluşan özet kart.
//
// Props: setId
// Veri: useSelectionSet (Phase 7) → set.name, asset.length, quality, collections

import { memo } from "react";

interface SetSummaryCardProps {
  setId: string;
  setName?: string;
  assetCount?: number;
  avgQualityScore?: number;
  collections?: { id: string; name: string }[];
}

function SetSummaryCardComponent({
  setId,
  setName = "Başlıksız Set",
  assetCount = 0,
  avgQualityScore = 0,
  collections = [],
}: SetSummaryCardProps) {
  // Kalite rengi
  const getQualityColor = (score: number) => {
    if (score >= 90) return "text-green-700 bg-green-50";
    if (score >= 70) return "text-amber-700 bg-amber-50";
    return "text-red-700 bg-red-50";
  };

  return (
    <section
      aria-label="Set özeti"
      className="rounded-md border border-border bg-surface-2 p-4"
      data-testid="set-summary-card"
    >
      {/* Başlık + Çok sayı özet */}
      <div className="flex flex-col gap-4">
        {/* İsim ve temel bilgi */}
        <div>
          <h2 className="text-base font-semibold text-text">{setName}</h2>
          <p className="mt-1 text-xs text-text-muted">
            {setId}
          </p>
        </div>

        {/* İstatistikler grid */}
        <div className="grid grid-cols-3 gap-3">
          {/* Asset count */}
          <div className="rounded-sm bg-surface p-2">
            <p className="text-xs text-text-muted">Görseller</p>
            <p className="mt-0.5 text-lg font-bold text-text">
              {assetCount}
            </p>
          </div>

          {/* Ortalama kalite */}
          <div className="rounded-sm bg-surface p-2">
            <p className="text-xs text-text-muted">Ort. Kalite</p>
            <div className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-sm font-semibold ${getQualityColor(avgQualityScore)}`}>
              {avgQualityScore.toFixed(0)}
            </div>
          </div>

          {/* Koleksiyon count */}
          <div className="rounded-sm bg-surface p-2">
            <p className="text-xs text-text-muted">Koleksiyonlar</p>
            <p className="mt-0.5 text-lg font-bold text-text">
              {collections.length}
            </p>
          </div>
        </div>

        {/* Koleksiyon etiketleri (küçük flow) */}
        {collections.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {collections.map((col) => (
              <span
                key={col.id}
                className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-700"
              >
                {col.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export const SetSummaryCard = memo(SetSummaryCardComponent);
