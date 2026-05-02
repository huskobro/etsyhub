import { Download } from "lucide-react";
import type { ListingDraft } from "../types";

/**
 * AssetSection — Listing cover + grid + ZIP download + mockup badge.
 *
 * Spec §9.1:
 * - Cover image (first + orange border)
 * - Other images (position badge #1..N)
 * - Download ZIP link (if assets ready)
 * - Mockup count badge (if any)
 *
 * @param listing ListingDraft
 */
export function AssetSection({ listing }: { listing: ListingDraft }) {
  // Organize images: cover first, then others by packPosition
  const coverImage = listing.imageOrder.find((img: any) => img.isCover);
  const otherImages = listing.imageOrder
    .filter((img: any) => !img.isCover)
    .sort((a: any, b: any) => a.packPosition - b.packPosition);

  // Check if ready for ZIP download
  const allImagesReady = listing.imageOrder.every((img) => img.outputKey);

  // Mockup count
  const mockupCount = listing.mockups?.length ?? 0;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
        <span>Görseller & Dosyalar</span>
        {allImagesReady && (
          <a
            href={`/api/listings/${listing.id}/assets/download`}
            download={`listing-${listing.id}.zip`}
            className="inline-flex items-center gap-2 px-3 py-1 bg-accent text-white rounded text-sm hover:bg-accent/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            ZIP İndir
          </a>
        )}
      </h2>

      {/* Image Gallery */}
      <div className="mb-6">
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

          {otherImages.map((img: any) => (
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

      {/* Mockup Info & ZIP Ready */}
      <div className="flex flex-wrap gap-3 items-center text-sm">
        {mockupCount > 0 && (
          <div className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded">
            {mockupCount} mockup
          </div>
        )}
        {allImagesReady && (
          <div className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded">
            ✓ ZIP'e hazır
          </div>
        )}
        {!allImagesReady && (
          <div className="px-3 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded">
            Tüm görseller yüklenmeyi bekliyor
          </div>
        )}
      </div>
    </div>
  );
}
