"use client";

// Phase 9 V1 — Listing submit result panel.
//
// ListingDraftView footer'ında render edilir; submit pipeline durumunu
// ve sonuçlarını kullanıcıya zengin gösterir:
//   - DRAFT: readiness uyarısı (varsa) + "Taslak Gönder" CTA
//   - PUBLISHED: shopName + Etsy listing ID + "Etsy'de Aç" deep-link +
//     image upload breakdown + providerSnapshot + manuel publish notu
//   - FAILED: failedReason + image upload breakdown (varsa) +
//     "Yeniden DRAFT'a çevir" recovery button + Etsy admin'e gitme rehberi
//   - Taze submit success/error: aynı breakdown ile
//
// Auto-redirect YOK; cache invalidation parent hook'unda.
//
// Phase 9 V1 sözleşmesi: Etsy "draft" oluşturuldu = bizim "PUBLISHED";
// kullanıcı Etsy admin'de manuel "publish" yapacak (V2 active publish).

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  ExternalLink,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useSubmitListingDraft } from "../hooks/useSubmitListingDraft";
import { useResetListingToDraft } from "../hooks/useResetListingToDraft";
import type { ListingDraftView } from "../types";
import { LISTING_STATUS_LABELS } from "../ui/status-labels";

const ETSY_LISTING_BASE = "https://www.etsy.com/your/shops/me/tools/listings";
const ETSY_SHOP_DASHBOARD = "https://www.etsy.com/your/shops/me/dashboard";

function buildEtsyListingUrl(etsyListingId: string): string {
  return `${ETSY_LISTING_BASE}/${etsyListingId}`;
}

function buildEtsyShopUrl(shopName: string | null): string {
  if (!shopName) return ETSY_SHOP_DASHBOARD;
  return `https://www.etsy.com/shop/${encodeURIComponent(shopName)}`;
}

/**
 * Image upload attempt — submit response'tan flat shape (etsyImageId / error
 * mutually exclusive ama optional, UI render-friendly). Submit service
 * `imageUpload.attempts` field'ından gelir.
 */
type ImageUploadAttempt = {
  rank: number;
  packPosition: number;
  renderId: string;
  isCover: boolean;
  ok: boolean;
  etsyImageId?: string;
  error?: string;
};

/**
 * Submit response'un opsiyonel imageUpload extension'ı. Hook tipi
 * (useSubmitListingDraft) DOKUNULMAZ olduğu için panelde local cast yapılır;
 * submit service real response shape'i bunu zaten döndürüyor (Task 1).
 */
type SubmitDataWithImageUpload = {
  status: "PUBLISHED";
  etsyListingId: string;
  failedReason: string | null;
  providerSnapshot: string;
  imageUpload?: {
    successCount: number;
    failedCount: number;
    partial: boolean;
    attempts: ImageUploadAttempt[];
  };
};

function ImageUploadDiagnostics({
  attempts,
  successCount,
  failedCount,
  partial,
}: {
  attempts: ImageUploadAttempt[];
  successCount: number;
  failedCount: number;
  partial: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!attempts || attempts.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-surface-2 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-text">
          Image upload: {successCount}/{attempts.length} succeeded
          {partial && (
            <span className="ml-2 text-yellow-700">
              ({failedCount} failed)
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-text-muted underline-offset-2 hover:underline"
        >
          {expanded ? "Hide details" : "Show details"}
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 space-y-1 font-mono text-xs">
          {attempts.map((a) => (
            <li
              key={a.rank}
              className={`flex items-start gap-2 ${
                a.ok ? "text-green-700" : "text-red-700"
              }`}
            >
              <span aria-hidden>{a.ok ? "✓" : "✗"}</span>
              <span className="flex-1">
                rank={a.rank} {a.isCover ? "(cover)" : ""} —{" "}
                {a.ok
                  ? `Etsy image ID: ${a.etsyImageId ?? "?"}`
                  : (a.error ?? "?")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SubmitResultPanel({ listing }: { listing: ListingDraftView }) {
  const submitMutation = useSubmitListingDraft(listing.id);
  const resetMutation = useResetListingToDraft(listing.id);

  const isEditable =
    listing.status === "DRAFT" || listing.status === "NEEDS_REVIEW";
  const hasReadinessWarn = listing.readiness.some((r) => !r.pass);

  // Etsy shop URL (connection varsa)
  const etsyShopUrl = listing.etsyShop
    ? buildEtsyShopUrl(listing.etsyShop.shopName)
    : null;

  // Taze submit'in image upload bilgisi (mutation.data). Hook tipi
  // dokunulmaz olduğu için local cast — service zaten attempts'i döndürür.
  const freshSubmitData = submitMutation.isSuccess
    ? (submitMutation.data as SubmitDataWithImageUpload)
    : null;
  const freshImageUpload = freshSubmitData?.imageUpload ?? null;

  return (
    <div className="space-y-3">
      {/* DRAFT durumunda: readiness soft warn (submit'i bloklamaz, K3 lock) */}
      {hasReadinessWarn && listing.status === "DRAFT" && (
        <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
          ⚠ Some readiness checks are missing. You can still submit, but
          Etsy may reject the draft.
        </p>
      )}

      {/* PUBLISHED status — geçmiş submit (taze değil) */}
      {listing.status === "PUBLISHED" &&
        listing.etsyListingId &&
        !submitMutation.isSuccess && (
          <div
            role="status"
            className="rounded-md border border-green-200 bg-green-50 p-4"
          >
            <div className="flex items-start gap-2">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-green-700"
                aria-hidden
              />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-green-800">
                  Sent to Etsy
                </p>
                {listing.etsyShop?.shopName && (
                  <p className="text-xs text-green-700">
                    Shop:{" "}
                    <span className="font-medium">
                      {listing.etsyShop.shopName}
                    </span>
                  </p>
                )}
                <p className="text-xs text-green-700">
                  Etsy listing ID:{" "}
                  <code className="font-mono">{listing.etsyListingId}</code>
                </p>
                <p className="text-xs text-green-700">
                  Publish manually from the Etsy admin panel to go live.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={buildEtsyListingUrl(listing.etsyListingId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
                  >
                    Open on Etsy
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                  {etsyShopUrl && (
                    <a
                      href={etsyShopUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                    >
                      Go to shop
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                </div>
                {listing.failedReason && (
                  <p className="text-xs text-yellow-700 mt-2">
                    Note: {listing.failedReason}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

      {/* FAILED status — geçmiş submit (taze değil), recovery */}
      {listing.status === "FAILED" &&
        listing.failedReason &&
        !submitMutation.isError && (
          <div
            role="status"
            className="rounded-md border border-red-200 bg-red-50 p-4"
          >
            <div className="flex items-start gap-2">
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-red-700"
                aria-hidden
              />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-red-800">
                  Previous submission failed
                </p>
                <p className="text-xs text-red-700">{listing.failedReason}</p>
                {listing.etsyListingId && (
                  <p className="text-xs text-red-700">
                    An orphan listing may exist on Etsy (ID:{" "}
                    <code className="font-mono">{listing.etsyListingId}</code>
                    ). Review and delete it manually from the Etsy admin panel.
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="secondary"
                    onClick={() => resetMutation.mutate()}
                    disabled={resetMutation.isPending}
                    loading={resetMutation.isPending}
                    className="inline-flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    {resetMutation.isPending
                      ? "Resetting…"
                      : "Reset to DRAFT"}
                  </Button>
                  {listing.etsyListingId && (
                    <a
                      href={buildEtsyListingUrl(listing.etsyListingId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                    >
                      Open orphan on Etsy
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                </div>
                {resetMutation.isError && (
                  <p role="alert" className="text-xs text-red-800 mt-2">
                    Reset failed: {resetMutation.error.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Taze submit success */}
      {submitMutation.isSuccess && (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 p-4"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-green-700"
              aria-hidden
            />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-green-800">
                Etsy draft created
              </p>
              {listing.etsyShop?.shopName && (
                <p className="text-xs text-green-700">
                  Shop:{" "}
                  <span className="font-medium">
                    {listing.etsyShop.shopName}
                  </span>
                </p>
              )}
              <p className="text-xs text-green-700">
                Etsy listing ID:{" "}
                <code className="font-mono">
                  {submitMutation.data.etsyListingId}
                </code>
              </p>
              {freshImageUpload && (
                <ImageUploadDiagnostics
                  attempts={freshImageUpload.attempts}
                  successCount={freshImageUpload.successCount}
                  failedCount={freshImageUpload.failedCount}
                  partial={freshImageUpload.partial}
                />
              )}
              {submitMutation.data.failedReason && (
                <p className="text-xs text-yellow-700">
                  Note: {submitMutation.data.failedReason}
                </p>
              )}
              <p className="text-xs text-green-700">
                Publish manually from the Etsy admin panel to go live.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={buildEtsyListingUrl(submitMutation.data.etsyListingId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
                >
                  Open on Etsy
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
                {etsyShopUrl && (
                  <a
                    href={etsyShopUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    Go to shop
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </div>
              <p className="text-xs text-green-700/70 mt-1">
                Provider: {submitMutation.data.providerSnapshot}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Taze submit error */}
      {submitMutation.isError && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-4"
        >
          <div className="flex items-start gap-2">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-red-700"
              aria-hidden
            />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-red-800">
                Submission failed
              </p>
              <p className="text-xs text-red-700">
                {submitMutation.error.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit button */}
      <div className="flex gap-3 items-center pt-1">
        <Button
          onClick={() => submitMutation.mutate()}
          disabled={submitMutation.isPending || !isEditable}
          loading={submitMutation.isPending}
        >
          {submitMutation.isPending ? "Submitting…" : "Submit draft"}
        </Button>

        {!isEditable && (
          <p className="text-xs text-muted-foreground">
            Cannot resubmit in this state (status:{" "}
            {LISTING_STATUS_LABELS[listing.status]}).
          </p>
        )}
      </div>
    </div>
  );
}
