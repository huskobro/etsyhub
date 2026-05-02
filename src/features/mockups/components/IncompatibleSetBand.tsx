// Phase 8 Task 25 — Uyumsuz Set uyarı bandı.
//
// Spec §5.2.2a: Seçilen şablon set ile uyumsuzsa
// (asset type, ölçü, format) uyarı bandı göster.
// Kullanıcı render et butonunu tıklamadan önce
// uyarıyı görsün.

import { memo } from "react";

interface IncompatibleSetBandProps {
  reason?: string;
  affectedCount?: number;
}

function IncompatibleSetBandComponent({
  reason = "Uyumsuzluk tespit edildi",
  affectedCount = 0,
}: IncompatibleSetBandProps) {
  return (
    <div
      className="rounded-md border border-red-300 bg-red-50 p-3"
      data-testid="incompatible-set-band"
      role="alert"
    >
      <div className="flex gap-2">
        {/* İkon */}
        <span className="mt-0.5 text-sm text-red-600">⚠️</span>

        {/* Mesaj */}
        <div className="flex-1">
          <p className="text-xs font-medium text-red-900">
            {reason}
          </p>
          {affectedCount > 0 && (
            <p className="mt-0.5 text-xs text-red-700">
              {affectedCount} görselde sorun tespit edildi.
              Bu görseller atlanacaktır.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export const IncompatibleSetBand = memo(IncompatibleSetBandComponent);
