"use client";

import { useListingDraft } from "../hooks/useListingDraft";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, Loader2 } from "lucide-react";

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

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
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

  // Organize image order: cover first, then others by packPosition
  const coverImage = listing.imageOrder.find((img) => img.isCover);
  const otherImages = listing.imageOrder
    .filter((img) => !img.isCover)
    .sort((a, b) => a.packPosition - b.packPosition);

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">
          Listing Taslağı: {listing.title || "(başlıksız)"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Status: {listing.status} • Oluşturuldu: {new Date(listing.createdAt).toLocaleDateString("tr")}
        </p>
      </header>

      {/* Image Gallery — Cover + position badges */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Görseller</h2>
        <div className="grid grid-cols-4 gap-4">
          {coverImage && (
            <div className="relative rounded-lg overflow-hidden shadow-lg border-2 border-accent col-span-1 row-span-2">
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {coverImage.outputKey ? (
                  <img
                    src={coverImage.outputKey}
                    alt="cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-xs">Görsel yok</span>
                )}
              </div>
              <div className="absolute top-2 left-2 bg-accent text-white px-2 py-1 rounded text-xs font-bold">
                ★ COVER
              </div>
            </div>
          )}

          {otherImages.map((img) => (
            <div
              key={img.renderId}
              className="relative rounded-lg overflow-hidden shadow border"
            >
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {img.outputKey ? (
                  <img
                    src={img.outputKey}
                    alt={`position-${img.packPosition}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-xs">Görsel yok</span>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2">
                #{img.packPosition + 1}
              </div>
            </div>
          ))}
        </div>
      </div>

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
                  className={`text-lg font-bold ${check.pass ? "text-green-600" : "text-yellow-600"}`}
                >
                  {check.pass ? "✓" : "⚠"}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {check.field.charAt(0).toUpperCase() + check.field.slice(1)}
                  </p>
                  <p className="text-xs text-gray-700 mt-1">{check.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metadata Summary (read-only in V1) */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Metadata</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-surface rounded-lg border">
            <p className="text-xs text-muted-foreground">Başlık</p>
            <p className="text-sm font-medium mt-1">{listing.title || "(boş)"}</p>
          </div>
          <div className="p-4 bg-surface rounded-lg border">
            <p className="text-xs text-muted-foreground">Fiyat</p>
            <p className="text-sm font-medium mt-1">
              {listing.priceCents ? `$${(listing.priceCents / 100).toFixed(2)}` : "(boş)"}
            </p>
          </div>
          <div className="p-4 bg-surface rounded-lg border col-span-2">
            <p className="text-xs text-muted-foreground">Açıklama</p>
            <p className="text-sm font-medium mt-1">
              {listing.description ? listing.description.substring(0, 100) + "…" : "(boş)"}
            </p>
          </div>
          <div className="p-4 bg-surface rounded-lg border col-span-2">
            <p className="text-xs text-muted-foreground">Etiketler ({listing.tags.length}/13)</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {listing.tags.length > 0 ? (
                listing.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-accent/10 text-accent rounded text-xs">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500">(etiket yok)</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions — disabled in V1 (Task 20+ için yer tutucu) */}
      <div className="flex gap-3">
        <Button
          disabled
          title="Task 20'de edit form eklenecek"
          variant="secondary"
        >
          Düzenle
        </Button>
        <Button
          disabled
          title="Task 22'de publish aksiyonu eklenecek"
        >
          Taslak Gönder
        </Button>
      </div>
    </main>
  );
}
