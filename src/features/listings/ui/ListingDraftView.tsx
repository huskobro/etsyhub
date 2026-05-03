"use client";

import { useListingDraft } from "../hooks/useListingDraft";
import { useSubmitListingDraft } from "../hooks/useSubmitListingDraft";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AssetSection } from "../components/AssetSection";
import { MetadataSection } from "../components/MetadataSection";
import { PricingSection } from "../components/PricingSection";
import { LISTING_STATUS_LABELS } from "./status-labels";

/**
 * Phase 9 V1 Task 19 — Listing draft detail view (foundation slice UI).
 *
 * Spec §8.1.1 — Draft UI foundation:
 * - List imageOrder (cover first + position badge)
 * - Display readiness checks (soft warn)
 * - Edit metadata form (Task 20)
 * - Publish action (Task 22)
 *
 * V1 scope: read-only detail + readiness checklist. Edit form + actions Task 20+.
 *
 * @param params { id: string } — listing cuid from URL
 */
export function ListingDraftView({ id }: { id: string }) {
  const { data: listing, isLoading, error } = useListingDraft(id);
  // Task 22 — submit mutation MUST be called before any early return
  // (React rules of hooks).
  const submitMutation = useSubmitListingDraft(id);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="p-8 flex items-center justify-center"
      >
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <span className="ml-2">Listing yükleniyor…</span>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div role="alert" className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h1 className="text-xl font-bold text-red-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            Listing yüklenemedi
          </h1>
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : "Bilinmeyen hata"}
          </p>
        </div>
      </div>
    );
  }


  return (
    <main className="p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">
          Listing Taslağı: {listing.title || "(başlıksız)"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Status: {LISTING_STATUS_LABELS[listing.status]} • Oluşturuldu: {new Date(listing.createdAt).toLocaleDateString("tr")}
        </p>
      </header>

      {/* Asset Section — cover + grid + ZIP + mockup badge */}
      <AssetSection listing={listing} />

      {/* Readiness Checklist (soft warn) */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Hazırlık Kontrolleri</h2>
        <div className="space-y-2">
          {listing.readiness.map((check) => (
            <div
              key={check.field}
              className={`p-4 rounded-lg border ${
                check.pass
                  ? "bg-green-50 border-green-200"
                  : "bg-yellow-50 border-yellow-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`text-lg font-bold ${check.pass ? "text-green-600" : "text-yellow-600"}`}
                >
                  {check.pass ? "✓" : "⚠"}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {check.field.charAt(0).toUpperCase() + check.field.slice(1)}
                    <span className="sr-only">
                      : {check.pass ? "geçti" : "uyarı"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-700 mt-1">{check.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata Section — title/description/13 tags form + save */}
      <MetadataSection listing={listing} />

      {/* Pricing Section — price + materials form + save */}
      <PricingSection listing={listing} />

      {/* Submit Action — Phase 9 V1 Task 22 (real endpoint, honest fail) */}
      {(() => {
        const isEditable =
          listing.status === "DRAFT" || listing.status === "NEEDS_REVIEW";
        const hasReadinessWarn = listing.readiness.some((r) => !r.pass);
        return (
          <div className="space-y-3">
            {/* Readiness uyarısı (soft warn — submit'i bloklamaz, K3 lock) */}
            {hasReadinessWarn && listing.status === "DRAFT" && (
              <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
                ⚠ Bazı hazırlık kontrolleri eksik. Yine de gönderilebilir, ancak
                Etsy reddedebilir.
              </p>
            )}

            {/* Geçmiş submit durum bilgisi (PUBLISHED) */}
            {listing.status === "PUBLISHED" &&
              listing.etsyListingId &&
              !submitMutation.isSuccess && (
                <p
                  role="status"
                  className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3"
                >
                  Bu listing Etsy'ye gönderildi (Etsy listing ID:{" "}
                  <code className="font-mono">{listing.etsyListingId}</code>).
                  Yayına almak için Etsy admin panelinden manuel publish
                  yapılabilir.
                </p>
              )}

            {/* Geçmiş submit durum bilgisi (FAILED) */}
            {listing.status === "FAILED" &&
              listing.failedReason &&
              !submitMutation.isError && (
                <p
                  role="status"
                  className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3"
                >
                  Önceki gönderim başarısız: {listing.failedReason}. Tekrar
                  denenebilir.
                </p>
              )}

            {/* Taze submit sonucu (success) */}
            {submitMutation.isSuccess && (
              <p
                role="status"
                className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3"
              >
                Etsy taslağı oluşturuldu (Etsy listing ID:{" "}
                <code className="font-mono">
                  {submitMutation.data.etsyListingId}
                </code>
                ). Etsy admin panelinden manuel publish yapabilirsin.
              </p>
            )}

            {/* Taze submit sonucu (error) */}
            {submitMutation.isError && (
              <p
                role="alert"
                className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3"
              >
                Gönderme başarısız: {submitMutation.error.message}
              </p>
            )}

            <div className="flex gap-3 items-center">
              <Button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || !isEditable}
                loading={submitMutation.isPending}
              >
                {submitMutation.isPending ? "Gönderiliyor…" : "Taslak Gönder"}
              </Button>

              {!isEditable && (
                <p className="text-xs text-muted-foreground">
                  Bu durumda yeniden gönderilemez (status:{" "}
                  {LISTING_STATUS_LABELS[listing.status]}).
                </p>
              )}
            </div>
          </div>
        );
      })()}
    </main>
  );
}
