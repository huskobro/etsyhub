import { Download } from "lucide-react";
import type { ListingDraftView, ListingImageOrderEntry } from "../types";

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
export function AssetSection({ listing }: { listing: ListingDraftView }) {
  // Organize images: cover first, then others by packPosition
  const coverImage = listing.imageOrder.find(
    (img: ListingImageOrderEntry) => img.isCover,
  );
  const otherImages = listing.imageOrder
    .filter((img: ListingImageOrderEntry) => !img.isCover)
    .sort(
      (a: ListingImageOrderEntry, b: ListingImageOrderEntry) =>
        a.packPosition - b.packPosition,
    );

  // Check if ready for ZIP download
  // Defensive: empty imageOrder makes Array.every() return true (vacuous truth) —
  // explicit length guard prevents misleading "✓ ZIP'e hazır" + active link
  // when listing has no images yet (e.g. listing created before mockup pack).
  const allImagesReady =
    listing.imageOrder.length > 0 &&
    listing.imageOrder.every((img) => img.outputKey);

  // Mockup count (from readiness check — Phase 8 integration)
  const mockupJobReady = listing.mockupJobId != null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
        <span>Images & Files</span>
        {allImagesReady && (
          <a
            href={`/api/listings/draft/${listing.id}/assets/download`}
            download={`listing-${listing.id}.zip`}
            className="inline-flex items-center gap-2 px-3 py-1 bg-accent text-white rounded text-sm hover:bg-accent/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download ZIP
          </a>
        )}
      </h2>

      {/* Image Gallery */}
      <div className="mb-6">
        <div className="grid grid-cols-4 gap-4">
          {coverImage && (
            <div className="relative rounded-lg overflow-hidden shadow-lg col-span-1 row-span-2">
              <div className="aspect-square bg-gray-100 flex items-center justify-center border-2 border-accent">
                {/* Pass 36 — signedUrl öncelikli (UI display), outputKey
                    fallback (legacy listing imageOrderJson signedUrl yok).
                    Pre-Pass 36 outputKey raw storage key olarak verildi
                    → 404 broken image. */}
                {coverImage.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverImage.signedUrl}
                    alt={`Cover image (${coverImage.templateName})`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-xs">No image</span>
                )}
              </div>
              <div className="absolute top-2 left-2 bg-accent text-white px-2 py-1 rounded text-xs font-bold">
                ★ COVER
              </div>
            </div>
          )}

          {otherImages.map((img: ListingImageOrderEntry) => (
            <div
              // Phase 100 — kind discriminator: mockup-render renderId
              // veya frame-export frameExportId (Listing imageOrder
              // entry union narrow).
              key={
                img.kind === "frame-export"
                  ? img.frameExportId
                  : img.renderId
              }
              className="relative rounded-lg overflow-hidden shadow border"
            >
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {img.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.signedUrl}
                    alt={`Image ${img.packPosition + 1} (${img.templateName})`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-xs">No image</span>
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
        {mockupJobReady && (
          <div className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded">
            1 mockup
          </div>
        )}
        {allImagesReady && (
          <div className="px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded">
            ✓ Ready for ZIP
          </div>
        )}
        {!allImagesReady && (
          <div className="px-3 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded">
            Waiting for all images to upload
          </div>
        )}
      </div>
    </div>
  );
}
