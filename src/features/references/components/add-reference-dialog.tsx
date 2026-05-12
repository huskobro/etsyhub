"use client";

/**
 * AddReferenceDialog — Kivasy v5 B5 canonical intake door.
 *
 * Phase 26 — Phase 22-24 parçalı intake yüzeylerini (ayrı `ImportUrlDialog`
 * + dead `UploadImageDialog` + sub-view-specific "Add from URL" CTA)
 * tek canonical modal'da birleştirir. DS B5 (`v5/screens-b5-b6.jsx:8-165`):
 *
 *   • Tek modal, 3 sibling tab: URL / Upload / From Bookmark
 *   • Product type chips always-visible (modal body bottom)
 *   • Collection picker optional
 *   • Dynamic CTA: "Add Reference" / "Add N References" (multi-select)
 *
 * Bu turda hibrit kararlar:
 *   - Output **Bookmark** (Karar A=3 = status quo). Schema doğrudan
 *     Reference yaratmayı destekliyor (`bookmarkId nullable`) ama yeni
 *     POST /api/references endpoint yazma + service migration bu turun
 *     scope'unda değil. URL/Upload yolu bookmark oluşturur; From Bookmark
 *     tab'ı mevcut `/api/references/promote` ile multi-promote yapar.
 *   - Multi-URL bulk paste (Karar B=3): YOK. URL tab tek input. İlerde
 *     gerekirse aynı modal içinde toggle eklenir.
 *   - Pool'dan modal: navigation yerine modal aç (Karar C=2 hibrit).
 *     Pool topbar "Add Reference" → `?add=ref` → bu modal açılır,
 *     varsayılan tab URL.
 *   - Auto-detect: client-side hostname regex (Etsy/Pinterest/Creative
 *     Fabrica/direct). Server resolver yok; "Looks like Etsy" caption
 *     hint olarak görünür.
 *
 * Amazon scope dışı (kullanıcı Phase 26 talebi). Helper text + source
 * detection map'inden çıkarıldı; schema enum DB legacy uyumu için kalır.
 */

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookmarkStatus } from "@prisma/client";
import { X, Link as LinkIcon, Upload, Search, Plus } from "lucide-react";
import { useFocusTrap } from "@/components/ui/use-focus-trap";
import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/cn";

type TabId = "url" | "upload" | "bookmark";

type ProductTypeOption = { id: string; displayName: string; key?: string };
type CollectionOption = { id: string; name: string };

/**
 * Canonical digital-download product type keys (CLAUDE.md scope sözleşmesi:
 * "yalnızca dijital indirilebilir ürünler"). Bu set DS B5 mock'undaki
 * 5 canonical chip'in app karşılığı. Seed'deki `tshirt`, `hoodie`, `dtf`
 * physical POD scope dışı; intake'te gösterilmez. Test fixture / admin
 * custom types (`isSystem: false`) server-level filter ile zaten elenir.
 */
const CANONICAL_PRODUCT_TYPE_KEYS = [
  "clipart",
  "wall_art",
  "printable",
  "sticker",
  "canvas",
] as const;

type BookmarkLite = {
  id: string;
  title: string | null;
  sourcePlatform: string | null;
  status: BookmarkStatus;
  createdAt: string;
  asset: { id: string } | null;
};

type SourceHint = {
  platform: "ETSY" | "PINTEREST" | "CREATIVE_FABRICA" | "DIRECT" | "OTHER";
  label: string;
};

/**
 * detectSourceFromUrl — client-side hostname classifier.
 * Server-side resolver (asset import worker) gerçek meta extraction yapar;
 * burası yalnız operatöre erken görsel ipucu verir. Negative match = "OTHER".
 */
function detectSourceFromUrl(raw: string): SourceHint | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let host = "";
  try {
    host = new URL(trimmed).host.toLowerCase();
  } catch {
    return null;
  }
  if (host.includes("etsystatic.com") || host.includes("etsy.com")) {
    return { platform: "ETSY", label: "Looks like Etsy" };
  }
  if (host.includes("pinimg.com") || host.includes("pinterest.")) {
    return { platform: "PINTEREST", label: "Looks like Pinterest" };
  }
  if (
    host.includes("creativefabrica.com") ||
    host.includes("creativefabrica.")
  ) {
    // Creative Fabrica product pages aren't direct images. Server-side
    // resolver fetches the page's main asset on fetch. Confidence tone
    // ink-2 (lower than Etsy/Pinterest CDN-direct) to set honest
    // expectation.
    return {
      platform: "CREATIVE_FABRICA",
      label: "Creative Fabrica page · we'll fetch the main image",
    };
  }
  // Direct image URL: extension-based hint
  if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(trimmed)) {
    return { platform: "DIRECT", label: "Direct image URL" };
  }
  return { platform: "OTHER", label: "Source will be resolved on fetch" };
}

type JobShape = {
  id: string;
  status: string;
  progress: number;
  error: string | null;
  metadata: { assetId?: string; title?: string | null } | null;
};

export function AddReferenceDialog({
  onClose,
  onCreated,
  productTypes,
  collections,
  defaultTab = "url",
  initialBookmarkSelection,
}: {
  onClose: () => void;
  onCreated?: () => void;
  productTypes: ProductTypeOption[];
  collections?: CollectionOption[];
  defaultTab?: TabId;
  initialBookmarkSelection?: string[];
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>(defaultTab);

  /* Phase 27 — Product type display IA.
   *   v5 B5 mock 5 canonical chip gösteriyor. Bizim app'te seed +
   *   admin custom types karışık (Phase 26'da 36 chip kaos). Server
   *   already `isSystem: true` filter ekliyor; client tarafında
   *   canonical-key whitelist ile core types öne çıkarılır, kalan
   *   "More types…" disclosure'unda kalır (operatör hâlâ erişebilir,
   *   ama default scan kaosu kalkar). */
  const { canonical: canonicalTypes, more: moreTypes } = useMemo(() => {
    const canonical: ProductTypeOption[] = [];
    const more: ProductTypeOption[] = [];
    for (const pt of productTypes) {
      if (pt.key && (CANONICAL_PRODUCT_TYPE_KEYS as readonly string[]).includes(pt.key)) {
        canonical.push(pt);
      } else {
        more.push(pt);
      }
    }
    canonical.sort((a, b) => {
      const ai = (CANONICAL_PRODUCT_TYPE_KEYS as readonly string[]).indexOf(
        a.key ?? "",
      );
      const bi = (CANONICAL_PRODUCT_TYPE_KEYS as readonly string[]).indexOf(
        b.key ?? "",
      );
      return ai - bi;
    });
    return { canonical, more };
  }, [productTypes]);

  // Default: canonical "wall_art" if exists (DS B5 "Defaults to your last
  // used type · Wall art"), else first canonical, else first overall.
  const defaultProductTypeId = useMemo(() => {
    const wallArt = canonicalTypes.find((p) => p.key === "wall_art");
    if (wallArt) return wallArt.id;
    if (canonicalTypes[0]) return canonicalTypes[0].id;
    return productTypes[0]?.id ?? "";
  }, [canonicalTypes, productTypes]);

  const [productTypeId, setProductTypeId] = useState<string>(defaultProductTypeId);
  const [moreOpen, setMoreOpen] = useState(false);
  const [collectionId, setCollectionId] = useState<string | null>(null);

  // Re-sync default if productTypes change (page-level prop change rare,
  // but covers HMR / re-mount with different data).
  useEffect(() => {
    if (!productTypeId && defaultProductTypeId) {
      setProductTypeId(defaultProductTypeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProductTypeId]);

  // URL tab state
  const [url, setUrl] = useState("");
  const [urlJobId, setUrlJobId] = useState<string | null>(null);
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [urlBusy, setUrlBusy] = useState(false);
  const sourceHint = useMemo(() => detectSourceFromUrl(url), [url]);

  // Upload tab state — multi-file
  type UploadEntry = {
    id: string;
    file: File;
    previewUrl: string;
    status: "pending" | "uploading" | "ready" | "failed";
    assetId?: string;
    error?: string;
  };
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Bookmark tab state — multi-select promote
  const [bookmarkSearch, setBookmarkSearch] = useState("");
  const [bookmarkSelection, setBookmarkSelection] = useState<Set<string>>(
    () => new Set(initialBookmarkSelection ?? []),
  );

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  useFocusTrap(dialogRef, true, urlInputRef);

  // Inbox bookmarks query — only when tab visited (cheap pre-fetch on mount)
  const bookmarksQuery = useQuery({
    queryKey: ["bookmarks", "INBOX", bookmarkSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("status", "INBOX");
      params.set("limit", "60");
      if (bookmarkSearch.trim()) params.set("q", bookmarkSearch.trim());
      const res = await fetch(`/api/bookmarks?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load bookmarks");
      return (await res.json()) as {
        items: BookmarkLite[];
        nextCursor: string | null;
      };
    },
    enabled: tab === "bookmark",
  });

  // URL fetch job polling
  const jobQuery = useQuery({
    queryKey: ["job", urlJobId],
    queryFn: async () => {
      if (!urlJobId) return null;
      const res = await fetch(`/api/jobs/${urlJobId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch job");
      return (await res.json()) as { job: JobShape };
    },
    enabled: !!urlJobId,
    refetchInterval: (q) => {
      const s = q.state.data?.job.status;
      return s === "SUCCESS" || s === "FAILED" ? false : 1500;
    },
  });

  const urlJob = jobQuery.data?.job;
  const urlSuccess = urlJob?.status === "SUCCESS";
  const urlFailed = urlJob?.status === "FAILED";
  const urlFetching = !!urlJobId && !urlSuccess && !urlFailed;

  // Submission mutation — bookmark create after asset resolution
  const createBookmark = useMutation({
    mutationFn: async (input: {
      sourceUrl?: string;
      assetId?: string;
      title?: string;
      sourcePlatform?: string;
    }) => {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...input,
          productTypeId: productTypeId || undefined,
          collectionId: collectionId || undefined,
        }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Failed to create bookmark");
      return res.json();
    },
  });

  // Multi-bookmark promote → Reference (From Bookmark tab)
  const promoteBookmarks = useMutation({
    mutationFn: async () => {
      const ids = Array.from(bookmarkSelection);
      if (ids.length === 0) throw new Error("No bookmarks selected");
      if (!productTypeId) throw new Error("Pick a product type");
      const results = await Promise.allSettled(
        ids.map((bookmarkId) =>
          fetch("/api/references/promote", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              bookmarkId,
              productTypeId,
              collectionId: collectionId ?? undefined,
            }),
          }).then(async (res) => {
            if (!res.ok)
              throw new Error(
                (await res.json()).error ?? "Failed to promote bookmark",
              );
            return res.json();
          }),
        ),
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        throw new Error(
          `${failed.length} of ${ids.length} promotions failed`,
        );
      }
      return results;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["references"] });
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      onCreated?.();
      onClose();
    },
  });

  // URL tab: fetch image
  async function urlOnFetch() {
    setUrlBusy(true);
    setUrlMessage(null);
    try {
      const res = await fetch("/api/assets/import-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl: url }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Failed to start job");
      }
      const data = (await res.json()) as { jobId: string };
      setUrlJobId(data.jobId);
    } catch (err) {
      setUrlMessage((err as Error).message);
    } finally {
      setUrlBusy(false);
    }
  }

  // URL tab: save as bookmark (success only)
  async function urlOnSave() {
    if (!urlSuccess) return;
    try {
      await createBookmark.mutateAsync({
        sourceUrl: url,
        assetId: urlJob?.metadata?.assetId,
        title: urlJob?.metadata?.title ?? undefined,
        sourcePlatform:
          sourceHint?.platform === "ETSY"
            ? "ETSY"
            : sourceHint?.platform === "PINTEREST"
              ? "PINTEREST"
              : sourceHint?.platform === "CREATIVE_FABRICA"
                ? "OTHER" // schema enum'da CREATIVE_FABRICA yok; UI tarafı tone, server OTHER
                : undefined,
      });
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      onCreated?.();
      onClose();
    } catch (err) {
      setUrlMessage((err as Error).message);
    }
  }

  // Upload tab: accept files (single & multi)
  function acceptFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) =>
      /^image\/(png|jpe?g|webp)$/i.test(f.type),
    );
    const entries: UploadEntry[] = list.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
    }));
    setUploads((cur) => [...cur, ...entries]);
  }

  function removeUpload(id: string) {
    setUploads((cur) => {
      const removed = cur.find((u) => u.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return cur.filter((u) => u.id !== id);
    });
  }

  // Upload tab: submit all → asset upload → bookmark creation
  const uploadAll = useMutation({
    mutationFn: async () => {
      if (uploads.length === 0) throw new Error("No images selected");
      if (!productTypeId) throw new Error("Pick a product type");
      const results = await Promise.allSettled(
        uploads.map(async (entry) => {
          setUploads((cur) =>
            cur.map((u) =>
              u.id === entry.id ? { ...u, status: "uploading" } : u,
            ),
          );
          const fd = new FormData();
          fd.set("file", entry.file);
          const upRes = await fetch("/api/assets/upload", {
            method: "POST",
            body: fd,
          });
          if (!upRes.ok) {
            const msg =
              (await upRes.json()).error ?? "Upload failed";
            setUploads((cur) =>
              cur.map((u) =>
                u.id === entry.id
                  ? { ...u, status: "failed", error: msg }
                  : u,
              ),
            );
            throw new Error(msg);
          }
          const { id: assetId } = (await upRes.json()) as { id: string };
          await createBookmark.mutateAsync({
            assetId,
            title: entry.file.name,
            sourcePlatform: "UPLOAD",
          });
          setUploads((cur) =>
            cur.map((u) =>
              u.id === entry.id
                ? { ...u, status: "ready", assetId }
                : u,
            ),
          );
        }),
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        throw new Error(
          `${failed.length} of ${uploads.length} uploads failed`,
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      onCreated?.();
      onClose();
    },
  });

  const closeIfIdle = () => {
    if (
      urlBusy ||
      uploadAll.isPending ||
      promoteBookmarks.isPending ||
      createBookmark.isPending
    )
      return;
    onClose();
  };

  // a11y: Escape close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeIfIdle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    urlBusy,
    uploadAll.isPending,
    promoteBookmarks.isPending,
    createBookmark.isPending,
  ]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      uploads.forEach((u) => URL.revokeObjectURL(u.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    closeIfIdle();
  };

  // Bookmarks tab filtered items
  const bookmarkItems = bookmarksQuery.data?.items ?? [];

  // Dynamic CTA label
  const bookmarkCount = bookmarkSelection.size;
  const uploadCount = uploads.length;
  const cta = (() => {
    if (tab === "bookmark") {
      return bookmarkCount > 1
        ? `Add ${bookmarkCount} References`
        : "Add Reference";
    }
    if (tab === "upload") {
      return uploadCount > 1 ? `Add ${uploadCount} References` : "Add Reference";
    }
    return urlSuccess ? "Save reference" : "Fetch image";
  })();

  const ctaDisabled = (() => {
    if (tab === "url") {
      if (!productTypeId) return true;
      if (!urlSuccess) return urlBusy || urlFetching || !url.trim();
      return createBookmark.isPending;
    }
    if (tab === "upload") {
      return (
        !productTypeId ||
        uploads.length === 0 ||
        uploadAll.isPending ||
        uploads.some((u) => u.status === "uploading")
      );
    }
    return (
      !productTypeId ||
      bookmarkCount === 0 ||
      promoteBookmarks.isPending
    );
  })();

  const onPrimaryCta = () => {
    if (tab === "url") {
      if (urlSuccess) urlOnSave();
      else urlOnFetch();
    } else if (tab === "upload") {
      uploadAll.mutate();
    } else {
      promoteBookmarks.mutate();
    }
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-reference-dialog-title"
      onClick={onBackdropClick}
    >
      <div
        className="flex h-[min(720px,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-popover"
        data-testid="add-reference-dialog"
      >
        {/* Header — Phase 27: rounded-xl + px-6 py-4 (DS B5 spacing). */}
        <div className="flex items-center justify-between border-b border-line bg-paper px-6 py-4">
          <h2
            id="add-reference-dialog-title"
            className="text-[16px] font-semibold text-ink"
          >
            Add Reference
          </h2>
          <button
            type="button"
            onClick={closeIfIdle}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-k-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-k-orange"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Tabs — Phase 27: DS B5 SiblingTabs recipe (k-stabs/k-stab,
         *   tokens.css:310-312). Phase 26'da k-chip kullanılmıştı; DS
         *   canonical k-stab segmented-pill container. */}
        <div className="border-b border-line-soft bg-paper px-6 pt-4 pb-3">
          <div className="k-stabs">
            {(
              [
                { id: "url", label: "Image URL" },
                { id: "upload", label: "Upload" },
                { id: "bookmark", label: "From Bookmark" },
              ] as { id: TabId; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={cn(
                  "k-stab",
                  tab === t.id && "k-stab--active",
                )}
                data-testid={`add-ref-tab-${t.id}`}
              >
                {t.label}
                {t.id === "bookmark" && bookmarkCount > 0 ? (
                  <span className="k-stab__count">{bookmarkCount}</span>
                ) : null}
                {t.id === "upload" && uploadCount > 0 ? (
                  <span className="k-stab__count">{uploadCount}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Body (scroll) — Phase 27: DS B5 px-6 py-6 spacing */}
        <div className="flex-1 overflow-y-auto bg-paper px-6 py-5">
          {tab === "url" ? (
            <UrlTab
              ref={urlInputRef}
              url={url}
              onChange={setUrl}
              disabled={!!urlJobId}
              sourceHint={sourceHint}
              job={urlJob ?? null}
              fetching={urlFetching}
              success={urlSuccess}
              failed={urlFailed}
              message={urlMessage}
            />
          ) : null}

          {tab === "upload" ? (
            <UploadTab
              uploads={uploads}
              dragOver={dragOver}
              setDragOver={setDragOver}
              acceptFiles={acceptFiles}
              removeUpload={removeUpload}
              openFilePicker={() => fileInputRef.current?.click()}
              fileInputRef={fileInputRef}
            />
          ) : null}

          {tab === "bookmark" ? (
            <BookmarkTab
              search={bookmarkSearch}
              onSearch={setBookmarkSearch}
              items={bookmarkItems}
              loading={bookmarksQuery.isLoading}
              selection={bookmarkSelection}
              toggleSelect={(id) =>
                setBookmarkSelection((cur) => {
                  const next = new Set(cur);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            />
          ) : null}
        </div>

        {/* Always-visible product type + collection (DS B5 pattern).
         *
         * Phase 27 — product type IA cleanup:
         *   - Canonical digital download types öne çıkar (DS B5 5-chip mock
         *     hissi); seed test fixture'lar `isSystem: true` server filter
         *     ile zaten elendi
         *   - Kalan system types collapsible "More types" disclosure'da
         *     (operatör erişebilir ama kaos görmez)
         *   - Default: wall_art (DS "Defaults to your last used type · Wall
         *     art" niyetinin sadeleştirilmiş hali)
         *   - From Bookmark tab'ında `Collection (optional)` saklanır:
         *     promote endpoint'i bookmark'ın kendi collection'ını **change
         *     etmez**, reference'a yeni bir override yazar; bu bookmark
         *     tab'ında "bu collection neyi etkiliyor?" karışıklığı yaratır.
         *     URL/Upload tab'larında yeni bookmark oluştuğu için anlamlı,
         *     bookmark tab'ında hide ediyoruz. */}
        <div className="border-t border-line-soft bg-paper px-6 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                  Product type
                </span>
                <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
                  Defaults to Wall art
                </span>
              </div>
              <div
                className="flex flex-wrap gap-1.5"
                data-testid="add-ref-product-types"
              >
                {canonicalTypes.map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => setProductTypeId(pt.id)}
                    aria-pressed={productTypeId === pt.id}
                    className={cn(
                      "k-chip",
                      productTypeId === pt.id && "k-chip--active",
                    )}
                  >
                    {pt.displayName}
                  </button>
                ))}
                {moreTypes.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    className="k-chip"
                    aria-expanded={moreOpen}
                    data-testid="add-ref-more-types-toggle"
                  >
                    {moreOpen ? "Hide more" : `More types · ${moreTypes.length}`}
                  </button>
                ) : null}
              </div>
              {moreOpen && moreTypes.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5 rounded-md bg-k-bg-2/40 p-2">
                  {moreTypes.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => setProductTypeId(pt.id)}
                      aria-pressed={productTypeId === pt.id}
                      className={cn(
                        "k-chip",
                        productTypeId === pt.id && "k-chip--active",
                      )}
                    >
                      {pt.displayName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {/* Collection: bookmark tab'ında saklanır (yukarıdaki yorum) */}
            {tab !== "bookmark" && collections && collections.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                  Collection (optional)
                </span>
                <select
                  value={collectionId ?? ""}
                  onChange={(e) =>
                    setCollectionId(e.target.value || null)
                  }
                  className="k-input max-w-xs"
                  data-testid="add-ref-collection-select"
                >
                  <option value="">None</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer — Phase 27: px-6 py-3.5 DS B5 spacing. */}
        <div className="flex items-center justify-end gap-2 border-t border-line bg-paper px-6 py-3.5">
          <button
            type="button"
            data-size="sm"
            className="k-btn k-btn--ghost"
            onClick={closeIfIdle}
          >
            Cancel
          </button>
          <button
            type="button"
            data-size="sm"
            className="k-btn k-btn--primary"
            disabled={ctaDisabled}
            onClick={onPrimaryCta}
            data-testid="add-ref-cta"
          >
            {tab === "url" && urlBusy ? (
              "Starting…"
            ) : tab === "url" && urlFetching ? (
              "Fetching…"
            ) : tab === "upload" && uploadAll.isPending ? (
              "Uploading…"
            ) : tab === "bookmark" && promoteBookmarks.isPending ? (
              "Promoting…"
            ) : tab === "url" && createBookmark.isPending ? (
              "Saving…"
            ) : (
              <>
                <Plus className="h-3 w-3" aria-hidden />
                {cta}
              </>
            )}
          </button>
        </div>

        {/* Inline error footer messages */}
        {promoteBookmarks.isError ? (
          <div className="border-t border-danger/40 bg-danger/5 px-5 py-2 text-[12px] text-danger">
            {(promoteBookmarks.error as Error).message}
          </div>
        ) : null}
        {uploadAll.isError ? (
          <div className="border-t border-danger/40 bg-danger/5 px-5 py-2 text-[12px] text-danger">
            {(uploadAll.error as Error).message}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ───────────────────────── URL TAB ───────────────────────── */
type UrlTabProps = {
  url: string;
  onChange: (v: string) => void;
  disabled: boolean;
  sourceHint: SourceHint | null;
  job: JobShape | null;
  fetching: boolean;
  success: boolean;
  failed: boolean;
  message: string | null;
};

const UrlTab = forwardRef<HTMLInputElement, UrlTabProps>(
  function UrlTab(
    { url, onChange, disabled, sourceHint, job, fetching, success, failed, message },
    ref,
  ) {
    return (
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            Image URL
          </span>
          <div className="relative">
            <LinkIcon
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3"
              aria-hidden
            />
            <input
              ref={ref}
              type="url"
              placeholder="https://i.etsystatic.com/…/il_1140xN.jpg"
              value={url}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="k-input !pl-9"
              data-testid="add-ref-url-input"
            />
          </div>
          {sourceHint ? (
            /* Phase 27 — Source detection confidence tone:
             *   - Etsy / Pinterest: known image-cdn hosts (etsystatic /
             *     pinimg) → high confidence (success/danger tone)
             *   - Creative Fabrica: product page detection; gerçek görsel
             *     URL'i server resolve eder. Daha düşük confidence —
             *     ink-2 + "page" ifadesi operatöre dürüst signal verir
             *   - Direct image: extension match (.png/.jpg) → ink-2
             *   - Other: ink-3 + "resolved on fetch" honest fallback */
            <span
              className={cn(
                "inline-flex items-center gap-1 font-mono text-[10.5px] tracking-wider",
                sourceHint.platform === "ETSY" && "text-success",
                sourceHint.platform === "PINTEREST" && "text-danger",
                sourceHint.platform === "CREATIVE_FABRICA" && "text-ink-2",
                sourceHint.platform === "DIRECT" && "text-ink-2",
                sourceHint.platform === "OTHER" && "text-ink-3",
              )}
              data-testid="add-ref-source-hint"
            >
              {sourceHint.platform === "OTHER" ? null : (
                <span aria-hidden>✓</span>
              )}
              {sourceHint.label}
            </span>
          ) : (
            <span className="text-[12px] text-ink-3">
              Paste an image URL from Etsy, Pinterest, Creative Fabrica or
              a direct image link.
            </span>
          )}
        </label>

        {/* Status panel */}
        {job ? (
          <div
            className={cn(
              "rounded-md border px-3 py-2.5 text-[12.5px]",
              failed
                ? "border-danger/40 bg-danger/5"
                : success
                  ? "border-success/40 bg-success/5"
                  : "border-line-soft bg-k-bg-2/50",
            )}
            role="status"
            aria-live="polite"
            data-testid="add-ref-url-status"
          >
            {fetching ? (
              <span className="flex items-center gap-2 text-ink-2">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-k-orange" />
                Fetching image… {job.progress > 0 ? `${job.progress}%` : null}
              </span>
            ) : null}
            {success ? (
              <span className="flex flex-col gap-0.5">
                <span className="text-ink">Image fetched.</span>
                <span className="text-[11.5px] text-ink-3">
                  Ready to save. Pick a product type and Save reference.
                </span>
              </span>
            ) : null}
            {failed ? (
              <span className="flex flex-col gap-0.5">
                <span className="text-danger">Couldn&apos;t fetch image</span>
                <span className="text-[11.5px] text-ink-3">
                  {job.error?.trim() ||
                    "The URL didn't return a usable image. Try a direct image link."}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}

        {message ? (
          <p className="text-[12px] text-danger" data-testid="add-ref-url-message">
            {message}
          </p>
        ) : null}
      </div>
    );
  },
);

/* ───────────────────────── UPLOAD TAB ───────────────────────── */
function UploadTab({
  uploads,
  dragOver,
  setDragOver,
  acceptFiles,
  removeUpload,
  openFilePicker,
  fileInputRef,
}: {
  uploads: {
    id: string;
    file: File;
    previewUrl: string;
    status: "pending" | "uploading" | "ready" | "failed";
    error?: string;
  }[];
  dragOver: boolean;
  setDragOver: (b: boolean) => void;
  acceptFiles: (files: FileList | File[]) => void;
  removeUpload: (id: string) => void;
  openFilePicker: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) acceptFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragOver
            ? "border-k-orange bg-k-orange-soft/30"
            : "border-line-strong bg-k-bg",
        )}
        data-testid="add-ref-upload-zone"
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-paper text-ink-3">
          <Upload className="h-5 w-5" aria-hidden />
        </div>
        <div className="text-[14px] font-semibold text-ink">
          Drop images to upload
        </div>
        <div className="mt-1 font-mono text-[10.5px] tracking-wider text-ink-3">
          PNG · JPG · JPEG · WEBP · max 20 MB each
        </div>
        <button
          type="button"
          onClick={openFilePicker}
          data-size="sm"
          className="k-btn k-btn--secondary mt-3"
          data-testid="add-ref-upload-browse"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Browse files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) acceptFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="overflow-hidden rounded-md border border-line bg-paper"
              data-testid="add-ref-upload-thumb"
            >
              <div className="aspect-square w-full bg-k-bg-2">
                <img
                  src={u.previewUrl}
                  alt={u.file.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span
                  className="truncate text-[11px] text-ink-2"
                  title={u.file.name}
                >
                  {u.file.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeUpload(u.id)}
                  aria-label={`Remove ${u.file.name}`}
                  className="text-ink-3 hover:text-danger"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </div>
              {u.status !== "pending" ? (
                <div
                  className={cn(
                    "px-2 pb-1.5 font-mono text-[10px] uppercase tracking-meta",
                    u.status === "uploading" && "text-ink-3",
                    u.status === "ready" && "text-success",
                    u.status === "failed" && "text-danger",
                  )}
                >
                  {u.status}
                  {u.error ? ` · ${u.error.slice(0, 40)}` : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── BOOKMARK TAB ───────────────────────── */
function BookmarkTab({
  search,
  onSearch,
  items,
  loading,
  selection,
  toggleSelect,
}: {
  search: string;
  onSearch: (v: string) => void;
  items: BookmarkLite[];
  loading: boolean;
  selection: Set<string>;
  toggleSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search Inbox bookmarks…"
          className="k-input !pl-9"
          data-testid="add-ref-bookmark-search"
        />
      </div>

      {loading ? (
        <div className="text-[12px] text-ink-3">Loading bookmarks…</div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-line-soft bg-k-bg-2/30 p-4 text-[12px] text-ink-3">
          No bookmarks in Inbox{search.trim() ? " match your search" : ""}.
          Paste a URL or upload an image to add references directly.
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-md border border-line"
          data-testid="add-ref-bookmark-list"
        >
          {items.map((b, i) => {
            const sel = selection.has(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleSelect(b.id)}
                aria-pressed={sel}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-k-bg",
                  sel && "bg-k-orange-soft/30",
                  i < items.length - 1 && "border-b border-line-soft",
                )}
                data-testid="add-ref-bookmark-row"
              >
                <span
                  className="k-checkbox"
                  data-checked={sel || undefined}
                  aria-hidden
                >
                  {sel ? (
                    <svg width="11" height="11" viewBox="0 0 24 24">
                      <path
                        d="M5 12l5 5L20 7"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <div className="k-thumb !aspect-square !w-9 flex-shrink-0">
                  <AssetImage
                    assetId={b.asset?.id ?? null}
                    alt={b.title ?? "Bookmark"}
                    frame={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">
                    {b.title ?? "Untitled"}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {b.sourcePlatform ? (
                      <span
                        className="k-badge"
                        data-tone={
                          b.sourcePlatform === "ETSY"
                            ? "warning"
                            : b.sourcePlatform === "PINTEREST"
                              ? "danger"
                              : "neutral"
                        }
                      >
                        {b.sourcePlatform === "ETSY"
                          ? "Etsy"
                          : b.sourcePlatform === "PINTEREST"
                            ? "Pinterest"
                            : b.sourcePlatform === "UPLOAD"
                              ? "Upload"
                              : "Other"}
                      </span>
                    ) : null}
                    <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
                      {relativeAgo(b.createdAt)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selection.size > 0 ? (
        <div className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          {selection.size} selected · will promote to Pool with the product
          type below
        </div>
      ) : null}
    </div>
  );
}

function relativeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
