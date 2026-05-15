/* eslint-disable no-restricted-syntax */
// Phase 99 — Frame export result banner.
//
// File-level eslint-disable: Studio dark shell inline style yoğun
// (Sidebar / Stage / svg-art aynı pattern). Banner bottom-center
// floating, mode-aware (yalnız Frame mode), real PNG signed URL +
// scene snapshot drift indicator. Sözleşme #11 + #13.C fulfilled.

"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface FrameExportResultSnapshot {
  mode: string;
  glassVariant?: string;
  lensBlur?: boolean;
  frameAspect: string;
}

export interface FrameExportResultBannerProps {
  result: {
    downloadUrl: string;
    storageKey: string;
    width: number;
    height: number;
    sizeBytes: number;
    exportId: string;
    durationMs: number;
    /** Phase 100 — FrameExport row id (sözleşme #11 + #13.F). null
     *  ise persistence başarısız (Send to Product CTA disabled). */
    frameExportId: string | null;
    sceneSnapshot: FrameExportResultSnapshot;
  };
  currentSceneSnapshot: FrameExportResultSnapshot;
  onClose: () => void;
  onReexport: () => void;
  isExporting: boolean;
}

/* Phase 100 — Product handoff target (Listing draft). */
interface ListingTarget {
  id: string;
  title: string | null;
  status: string;
  updatedAt: string;
  coverThumbnailUrl: string | null;
}

export function FrameExportResultBanner({
  result,
  currentSceneSnapshot,
  onClose,
  onReexport,
  isExporting,
}: FrameExportResultBannerProps): ReactNode {
  const sizeKb = (result.sizeBytes / 1024).toFixed(1);
  const isStale =
    currentSceneSnapshot.mode !== result.sceneSnapshot.mode ||
    currentSceneSnapshot.glassVariant !== result.sceneSnapshot.glassVariant ||
    !!currentSceneSnapshot.lensBlur !== !!result.sceneSnapshot.lensBlur ||
    currentSceneSnapshot.frameAspect !== result.sceneSnapshot.frameAspect;
  const filename = `kivasy-frame-${result.exportId.slice(0, 8)}-${result.width}x${result.height}.png`;

  /* Phase 100 — Product handoff popover state.
   *
   * Operator "Send to Product" tıklayınca popover açılır; son N
   * Listing draft'ı listelenir (`GET /api/listings?status=DRAFT`).
   * Item click → `POST /api/listings/draft/[id]/add-frame-export`
   * (setAsCover: true; operator hero olarak set eder, mevcut cover
   * otomatik flip).
   *
   * frameExportId null ise CTA disabled (persistence başarısız —
   * Phase 100 service degraded mode). */
  const canSendToProduct = result.frameExportId !== null;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [listings, setListings] = useState<ListingTarget[] | null>(null);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [handoffPending, setHandoffPending] = useState<string | null>(null);
  const [handoffSuccess, setHandoffSuccess] = useState<{
    listingId: string;
    listingTitle: string | null;
  } | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  useEffect(() => {
    if (!popoverOpen || listings !== null || listingsLoading) return;
    setListingsLoading(true);
    setListingsError(null);
    fetch("/api/listings?status=DRAFT", {
      method: "GET",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as { listings: ListingTarget[] };
        setListings(body.listings ?? []);
      })
      .catch((err: unknown) => {
        setListingsError(
          err instanceof Error ? err.message : "Listings yüklenemedi",
        );
      })
      .finally(() => setListingsLoading(false));
  }, [popoverOpen, listings, listingsLoading]);

  const handleSendToListing = async (listingId: string) => {
    if (!result.frameExportId) return;
    setHandoffPending(listingId);
    setHandoffError(null);
    setHandoffSuccess(null);
    try {
      const res = await fetch(
        `/api/listings/draft/${listingId}/add-frame-export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            frameExportId: result.frameExportId,
            setAsCover: true,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const target = listings?.find((l) => l.id === listingId) ?? null;
      setHandoffSuccess({
        listingId,
        listingTitle: target?.title ?? null,
      });
      setPopoverOpen(false);
    } catch (err) {
      setHandoffError(err instanceof Error ? err.message : "Handoff failed");
    } finally {
      setHandoffPending(null);
    }
  };
  return (
    <div
      data-testid="studio-frame-export-result"
      data-stale={isStale ? "true" : "false"}
      style={{
        position: "absolute",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        minWidth: 460,
        maxWidth: 640,
        zIndex: 20,
        background: "rgba(28,25,22,0.92)",
        backdropFilter: "blur(16px) saturate(1.2)",
        WebkitBackdropFilter: "blur(16px) saturate(1.2)",
        border: "1px solid rgba(232,93,37,0.35)",
        boxShadow:
          "0 24px 60px -16px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <img
        src={result.downloadUrl}
        alt={`Frame export ${result.width}×${result.height}`}
        width={60}
        height={Math.round(60 * (result.height / result.width))}
        style={{
          borderRadius: 5,
          border: "1px solid rgba(255,255,255,0.12)",
          flexShrink: 0,
          background: "rgba(0,0,0,0.4)",
          objectFit: "cover",
        }}
        data-testid="studio-frame-export-thumb"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--ks-fm)",
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: isStale ? "var(--ks-or)" : "rgba(255,255,255,0.55)",
            marginBottom: 2,
          }}
          data-testid="studio-frame-export-status"
        >
          {isStale ? "Preview changed · re-export?" : "Frame exported · ready"}
        </div>
        <div
          style={{
            fontFamily: "var(--ks-fm)",
            fontSize: 11,
            color: "var(--ks-t1)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
          data-testid="studio-frame-export-meta"
        >
          <span>
            {result.width}×{result.height}
          </span>
          <span style={{ color: "rgba(255,255,255,0.32)" }}>·</span>
          <span>{sizeKb} KB</span>
          <span style={{ color: "rgba(255,255,255,0.32)" }}>·</span>
          <span>{result.durationMs} ms</span>
        </div>
      </div>
      {/* Phase 100 — Send to Product CTA + popover (sözleşme #11
       *  + #13.F fulfilled). FrameExport row → Listing.imageOrderJson
       *  handoff. */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => {
            if (!canSendToProduct) return;
            setPopoverOpen((v) => !v);
            setHandoffError(null);
          }}
          disabled={!canSendToProduct}
          data-testid="studio-frame-export-send-to-product"
          data-popover-open={popoverOpen ? "true" : "false"}
          title={
            canSendToProduct
              ? "Send this frame to a listing draft (set as cover)"
              : "Persistence failed — refresh / re-export to send"
          }
          style={{
            padding: "6px 10px",
            borderRadius: 5,
            background: handoffSuccess
              ? "rgba(64,162,89,0.18)"
              : "rgba(232,93,37,0.18)",
            border: `1px solid ${handoffSuccess ? "rgba(64,162,89,0.45)" : "rgba(232,93,37,0.45)"}`,
            color: handoffSuccess ? "#7fcf94" : "var(--ks-or)",
            fontFamily: "var(--ks-fm)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: canSendToProduct ? "pointer" : "not-allowed",
            opacity: canSendToProduct ? 1 : 0.5,
          }}
        >
          {handoffSuccess
            ? "✓ Sent"
            : popoverOpen
              ? "Pick listing…"
              : "Send to Product"}
        </button>
        {popoverOpen ? (
          <div
            data-testid="studio-frame-export-send-popover"
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              right: 0,
              minWidth: 320,
              maxWidth: 420,
              maxHeight: 360,
              overflow: "auto",
              background: "rgba(18,16,14,0.96)",
              backdropFilter: "blur(20px) saturate(1.4)",
              WebkitBackdropFilter: "blur(20px) saturate(1.4)",
              border: "1px solid rgba(232,93,37,0.4)",
              borderRadius: 8,
              padding: 10,
              boxShadow:
                "0 20px 48px -12px rgba(0,0,0,0.7), 0 6px 16px rgba(0,0,0,0.5)",
              zIndex: 30,
            }}
          >
            <div
              style={{
                fontFamily: "var(--ks-fm)",
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ks-or)",
                marginBottom: 8,
              }}
            >
              Choose listing draft
            </div>
            {handoffError ? (
              <div
                style={{
                  marginBottom: 8,
                  padding: "6px 8px",
                  borderRadius: 4,
                  background: "rgba(220,90,90,0.16)",
                  border: "1px solid rgba(220,90,90,0.4)",
                  color: "#f5b3b3",
                  fontFamily: "var(--ks-fm)",
                  fontSize: 11,
                }}
                role="alert"
                data-testid="studio-frame-export-handoff-error"
              >
                {handoffError}
              </div>
            ) : null}
            {listingsLoading ? (
              <div
                style={{
                  padding: "12px 4px",
                  fontFamily: "var(--ks-fm)",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                Loading listings…
              </div>
            ) : listingsError ? (
              <div
                style={{
                  padding: "12px 4px",
                  fontFamily: "var(--ks-fm)",
                  fontSize: 11,
                  color: "#f5b3b3",
                }}
              >
                {listingsError}
              </div>
            ) : (listings ?? []).length === 0 ? (
              <div
                style={{
                  padding: "10px 4px",
                  fontFamily: "var(--ks-fm)",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.5,
                }}
              >
                No draft listings yet. Create one from a Selection set
                first (Apply Mockups → Create Listing Draft).
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
                data-testid="studio-frame-export-listings"
              >
                {(listings ?? []).map((l) => {
                  const pending = handoffPending === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => handleSendToListing(l.id)}
                      disabled={pending || handoffPending !== null}
                      data-testid={`studio-frame-export-listing-${l.id}`}
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        borderRadius: 5,
                        background: pending
                          ? "rgba(232,93,37,0.18)"
                          : "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "var(--ks-t1)",
                        fontFamily: "var(--ks-fm)",
                        fontSize: 11,
                        cursor: pending ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 540,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {l.title || "Untitled draft"}
                        </div>
                        <div
                          style={{
                            fontSize: 9.5,
                            color: "rgba(255,255,255,0.45)",
                            letterSpacing: "0.04em",
                            marginTop: 1,
                          }}
                        >
                          {l.status} · {new Date(l.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      {pending ? (
                        <span
                          style={{
                            fontSize: 9.5,
                            color: "var(--ks-or)",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          Sending…
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
      {handoffSuccess ? (
        <span
          data-testid="studio-frame-export-handoff-success"
          style={{
            fontFamily: "var(--ks-fm)",
            fontSize: 9.5,
            color: "#7fcf94",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          ✓ Added to listing
        </span>
      ) : null}
      <a
        href={result.downloadUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="studio-frame-export-open"
        style={{
          padding: "6px 10px",
          borderRadius: 5,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "var(--ks-t1)",
          fontFamily: "var(--ks-fm)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        Open
      </a>
      <a
        href={result.downloadUrl}
        download={filename}
        data-testid="studio-frame-export-download"
        style={{
          padding: "6px 12px",
          borderRadius: 5,
          background: "var(--ks-or)",
          border: "1px solid rgba(232,93,37,0.85)",
          color: "#1a1410",
          fontFamily: "var(--ks-fm)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
        }}
      >
        Download
      </a>
      {isStale ? (
        <button
          type="button"
          onClick={onReexport}
          disabled={isExporting}
          data-testid="studio-frame-export-reexport"
          style={{
            padding: "6px 10px",
            borderRadius: 5,
            background: "rgba(232,93,37,0.16)",
            border: "1px solid rgba(232,93,37,0.45)",
            color: "var(--ks-or)",
            fontFamily: "var(--ks-fm)",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: isExporting ? "not-allowed" : "pointer",
          }}
        >
          {isExporting ? "Exporting…" : "Re-export"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close export result"
        data-testid="studio-frame-export-close"
        style={{
          padding: "4px 8px",
          borderRadius: 4,
          background: "transparent",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "rgba(255,255,255,0.55)",
          fontFamily: "var(--ks-fm)",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}
