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
import { deriveTitleFromUrl } from "@/lib/derive-title-from-url";

type TabId = "url" | "upload" | "bookmark";

type ProductTypeOption = { id: string; displayName: string; key?: string };
type CollectionOption = { id: string; name: string };

/**
 * DS v5 B5 canonical chip display order (mock screens-b5-b6.jsx:17-23):
 * clipart bundle / wall art / bookmark / sticker / printable. Server
 * already filters to these 5 keys (page-level query); client orders by
 * canonical sequence so chips appear in DS order regardless of
 * displayName alphabetical fallback.
 */
const CANONICAL_PRODUCT_TYPE_ORDER = [
  "clipart",
  "wall_art",
  "bookmark",
  "sticker",
  "printable",
] as const;

/**
 * localStorage key for last-used product type. DS B5 caption "Defaults to
 * your last used type · Wall art" persistence niyetini taşır — Phase 28
 * minimal client-side implementation. Sunucu/user-setting bağlama ileride
 * (admin-managed default? per-user setting?) genişletilebilir; şu an
 * tek-cihaz tarayıcı persistence yeterli.
 */
const LAST_USED_PT_KEY = "kivasy.addReference.lastProductTypeKey";

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
 * Phase 30 — `deriveTitleFromUrl` shared lib'e taşındı
 * (`@/lib/derive-title-from-url`). Client + server aynı helper'ı kullanır:
 *   - Client: queue mode save anında payload `title` field için
 *   - Server: `createBookmark` service fallback chain için (bypass'lı
 *     API çağrıları, eksik client title, vb.)
 *
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

  /* Phase 28 — Product type DS B5 parity cleanup.
   *
   * Phase 27 client-level whitelist + "More types · N" toggle DS canonical
   * değildi (mock screens-b5-b6.jsx:17-23'te yalnız 5 chip var; "More
   * types" yok). Phase 28: server zaten canonical 5 key'i döner (page-
   * level query `where.key IN ('clipart','wall_art','bookmark','sticker',
   * 'printable')`); client sadece sırayla render eder. Toggle kalktı.
   *
   * Sıralama: DS B5 mock'undaki canonical sıra (Clipart bundle / Wall art /
   * Bookmark / Sticker / Printable). DisplayName alphabetical sort
   * kullanılmaz — operatör DS'le aynı sırayı görür. */
  const orderedTypes = useMemo(() => {
    const sorted = [...productTypes].sort((a, b) => {
      const ai = (CANONICAL_PRODUCT_TYPE_ORDER as readonly string[]).indexOf(
        a.key ?? "",
      );
      const bi = (CANONICAL_PRODUCT_TYPE_ORDER as readonly string[]).indexOf(
        b.key ?? "",
      );
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return sorted;
  }, [productTypes]);

  /* Default selection — DS B5 caption: "Defaults to your last used type
   * · Wall art". Last-used persistence localStorage'a yazılır (CTA
   * confirmation anında). İlk girişte hiç kayıt yoksa wall_art fallback
   * (DS mock varsayılanı); wall_art yoksa ilk canonical type. */
  const lastUsedProductTypeId = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const lastKey = window.localStorage.getItem(LAST_USED_PT_KEY);
      if (!lastKey) return null;
      const match = orderedTypes.find((p) => p.key === lastKey);
      return match?.id ?? null;
    } catch {
      return null;
    }
  }, [orderedTypes]);

  const defaultProductTypeId = useMemo(() => {
    if (lastUsedProductTypeId) return lastUsedProductTypeId;
    const wallArt = orderedTypes.find((p) => p.key === "wall_art");
    if (wallArt) return wallArt.id;
    return orderedTypes[0]?.id ?? "";
  }, [lastUsedProductTypeId, orderedTypes]);

  const [productTypeId, setProductTypeId] = useState<string>(defaultProductTypeId);
  const [collectionId, setCollectionId] = useState<string | null>(null);

  // Re-sync default if productTypes prop changes (HMR / re-mount edge).
  useEffect(() => {
    if (!productTypeId && defaultProductTypeId) {
      setProductTypeId(defaultProductTypeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProductTypeId]);

  /* Persist last-used product type. Yalnız confirmation noktasında yazmak
   * isterdik ama her tab'ın confirmation farklı flow (URL: urlOnSave,
   * Upload: uploadAll.onSuccess, Bookmark: promoteBookmarks.onSuccess).
   * En basit + bozucu olmayan yaklaşım: productTypeId değişiminde yaz.
   * Kullanıcı chip'e dokunmasa bile last-used korunur. */
  useEffect(() => {
    if (!productTypeId) return;
    if (typeof window === "undefined") return;
    const pt = orderedTypes.find((p) => p.id === productTypeId);
    if (!pt?.key) return;
    try {
      window.localStorage.setItem(LAST_USED_PT_KEY, pt.key);
    } catch {
      /* localStorage disabled — silent skip */
    }
  }, [productTypeId, orderedTypes]);

  /* Track selected product type display name for caption. */
  const selectedProductTypeLabel = useMemo(() => {
    return orderedTypes.find((p) => p.id === productTypeId)?.displayName ?? "";
  }, [productTypeId, orderedTypes]);

  /* URL tab state — Phase 29 multi-URL queue.
   *
   * Önceki tek-URL state (`url`, `urlJobId`, ...) bir N=1 array'in
   * indirgenmiş hali; Phase 29'da queue mode default. Operatör default
   * tek-satır görür, "Add another URL" ile satır ekler. Bu **B5 sapması**
   * (DS mock'unda yok) ama operatör için kritik UX kazancı: 10 link
   * için 10× modal aç-paste-fetch yerine paste-fetch-save bir kez.
   *
   * Her satır kendi lifecycle'ına sahip:
   *   - idle: kullanıcı henüz fetch tetiklemedi
   *   - fetching: import-url job kuyruğa atıldı, polling devam
   *   - ready: asset fetched (assetId + thumbnail preview)
   *   - failed: worker error
   */
  type UrlEntry = {
    id: string;
    url: string;
    jobId: string | null;
    status: "idle" | "fetching" | "ready" | "failed";
    assetId?: string;
    error?: string;
    progress?: number;
  };
  const [urlEntries, setUrlEntries] = useState<UrlEntry[]>(() => [
    { id: crypto.randomUUID(), url: "", jobId: null, status: "idle" },
  ]);
  const [urlGlobalMessage, setUrlGlobalMessage] = useState<string | null>(null);

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

  /* URL queue job polling — Phase 29.
   *
   * React Query per-row `useQuery` array kullanmadık (hook count
   * dinamik olur, React kurallarına aykırı). Tek bir `useEffect`
   * 1500ms interval ile `status === "fetching"` entry'lerin job'unu
   * poll eder; SUCCESS/FAILED'da entry status'unu günceller.
   */
  useEffect(() => {
    const pending = urlEntries.filter(
      (e) => e.status === "fetching" && e.jobId,
    );
    if (pending.length === 0) return;
    const interval = setInterval(async () => {
      for (const entry of pending) {
        try {
          const res = await fetch(`/api/jobs/${entry.jobId}`, {
            cache: "no-store",
          });
          if (!res.ok) continue;
          const { job } = (await res.json()) as { job: JobShape };
          setUrlEntries((cur) =>
            cur.map((e) => {
              if (e.id !== entry.id) return e;
              if (job.status === "SUCCESS") {
                return {
                  ...e,
                  status: "ready",
                  assetId: job.metadata?.assetId,
                  progress: 100,
                };
              }
              if (job.status === "FAILED") {
                return {
                  ...e,
                  status: "failed",
                  error: job.error ?? "Couldn't fetch image",
                };
              }
              return { ...e, progress: job.progress };
            }),
          );
        } catch {
          /* network glitch; retry next tick */
        }
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [urlEntries]);

  /* Aggregate state derived for footer CTA / disabled. */
  const urlReadyCount = urlEntries.filter((e) => e.status === "ready").length;
  const urlFetchingCount = urlEntries.filter(
    (e) => e.status === "fetching",
  ).length;
  const urlIdleWithUrlCount = urlEntries.filter(
    (e) => e.status === "idle" && e.url.trim().length > 0,
  ).length;
  const urlFailedCount = urlEntries.filter((e) => e.status === "failed").length;

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

  /* URL tab queue helpers — Phase 29 multi-URL */

  function urlAddRow() {
    setUrlEntries((cur) => [
      ...cur,
      { id: crypto.randomUUID(), url: "", jobId: null, status: "idle" },
    ]);
  }

  function urlRemoveRow(id: string) {
    setUrlEntries((cur) => {
      if (cur.length === 1) {
        return [{ id: crypto.randomUUID(), url: "", jobId: null, status: "idle" }];
      }
      return cur.filter((e) => e.id !== id);
    });
  }

  function urlUpdateRow(id: string, patch: Partial<UrlEntry>) {
    setUrlEntries((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  /* Multi-line paste support: if user pastes text with newlines into a
   * single URL input, split into multiple entries. Operator pastes 8 URLs
   * from notes app → 8 row instantly. */
  function urlHandlePaste(targetId: string, text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length <= 1) return false;
    setUrlEntries((cur) => {
      const target = cur.find((e) => e.id === targetId);
      const others = cur.filter((e) => e.id !== targetId && (e.url.trim() || e.status !== "idle"));
      const newRows: UrlEntry[] = lines.map((url, idx) => ({
        id: idx === 0 && target ? target.id : crypto.randomUUID(),
        url,
        jobId: null,
        status: "idle",
      }));
      return [...others, ...newRows];
    });
    return true;
  }

  /* Bulk fetch all idle entries that have a URL. */
  async function urlOnFetchAll() {
    setUrlGlobalMessage(null);
    const toFetch = urlEntries.filter(
      (e) => e.status === "idle" && e.url.trim().length > 0,
    );
    if (toFetch.length === 0) return;
    /* Mark as fetching first to disable CTA while parallel requests fly. */
    setUrlEntries((cur) =>
      cur.map((e) =>
        toFetch.some((t) => t.id === e.id)
          ? { ...e, status: "fetching", progress: 0 }
          : e,
      ),
    );
    await Promise.all(
      toFetch.map(async (entry) => {
        try {
          const res = await fetch("/api/assets/import-url", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sourceUrl: entry.url }),
          });
          if (!res.ok) {
            const err = (await res.json()).error ?? "Failed to start job";
            urlUpdateRow(entry.id, { status: "failed", error: err });
            return;
          }
          const data = (await res.json()) as { jobId: string };
          urlUpdateRow(entry.id, { jobId: data.jobId });
        } catch (err) {
          urlUpdateRow(entry.id, {
            status: "failed",
            error: (err as Error).message,
          });
        }
      }),
    );
  }

  /* Bulk save all ready entries as bookmarks. */
  const urlOnSaveAll = useMutation({
    mutationFn: async () => {
      const ready = urlEntries.filter((e) => e.status === "ready" && e.assetId);
      if (ready.length === 0) throw new Error("No images ready to save");
      if (!productTypeId) throw new Error("Pick a product type");
      const results = await Promise.allSettled(
        ready.map((entry) => {
          const hint = detectSourceFromUrl(entry.url);
          const title = deriveTitleFromUrl(entry.url) ?? undefined;
          const sourcePlatform =
            hint?.platform === "ETSY"
              ? "ETSY"
              : hint?.platform === "PINTEREST"
                ? "PINTEREST"
                : hint?.platform === "CREATIVE_FABRICA"
                  ? "OTHER"
                  : undefined;
          return createBookmark.mutateAsync({
            sourceUrl: entry.url,
            assetId: entry.assetId,
            title,
            sourcePlatform,
          });
        }),
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        throw new Error(`${failed.length} of ${ready.length} saves failed`);
      }
      return results;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      onCreated?.();
      onClose();
    },
    onError: (err: Error) => {
      setUrlGlobalMessage(err.message);
    },
  });

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
      urlFetchingCount > 0 ||
      urlOnSaveAll.isPending ||
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
    urlFetchingCount,
    urlOnSaveAll.isPending,
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

  /* URL tab dynamic CTA — Phase 29 multi-URL.
   * Operatör flow: fill rows → "Fetch images" → readyCount görünür →
   * CTA "Save N references". Single ready row için "Save reference"
   * (singular). */
  const cta = (() => {
    if (tab === "bookmark") {
      return bookmarkCount > 1
        ? `Add ${bookmarkCount} References`
        : "Add Reference";
    }
    if (tab === "upload") {
      return uploadCount > 1 ? `Add ${uploadCount} References` : "Add Reference";
    }
    // URL queue: if any ready → "Save N references"; else "Fetch images"
    if (urlReadyCount > 0 && urlIdleWithUrlCount === 0 && urlFetchingCount === 0) {
      return urlReadyCount > 1
        ? `Save ${urlReadyCount} References`
        : "Save reference";
    }
    if (urlReadyCount > 0 && (urlIdleWithUrlCount > 0 || urlFailedCount > 0)) {
      return "Fetch remaining";
    }
    return urlIdleWithUrlCount > 1
      ? `Fetch ${urlIdleWithUrlCount} images`
      : "Fetch image";
  })();

  const ctaDisabled = (() => {
    if (tab === "url") {
      if (!productTypeId) return true;
      // Save mode active when all populated rows are ready
      if (
        urlReadyCount > 0 &&
        urlIdleWithUrlCount === 0 &&
        urlFetchingCount === 0
      ) {
        return urlOnSaveAll.isPending;
      }
      // Fetch mode
      return (
        urlIdleWithUrlCount === 0 ||
        urlFetchingCount > 0 ||
        urlOnSaveAll.isPending
      );
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
      if (
        urlReadyCount > 0 &&
        urlIdleWithUrlCount === 0 &&
        urlFetchingCount === 0
      ) {
        urlOnSaveAll.mutate();
      } else {
        urlOnFetchAll();
      }
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
              entries={urlEntries}
              onChangeRow={(id, url) => urlUpdateRow(id, { url, status: "idle", error: undefined })}
              onRemoveRow={urlRemoveRow}
              onAddRow={urlAddRow}
              onPaste={urlHandlePaste}
              globalMessage={urlGlobalMessage}
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
              selectAll={() =>
                setBookmarkSelection((cur) => {
                  const next = new Set(cur);
                  for (const b of bookmarkItems) next.add(b.id);
                  return next;
                })
              }
              clearAll={() => setBookmarkSelection(new Set())}
            />
          ) : null}
        </div>

        {/* Always-visible product type + collection (DS B5 pattern).
         *
         * Phase 28 — DS B5 parity cleanup:
         *   - "More types · N" toggle kaldırıldı (DS canonical değil;
         *     server zaten canonical 5 key dönüyor)
         *   - Sub-caption DS dilinde: "Defaults to your last used type ·
         *     <Selected>" — last-used localStorage persistence aktif
         *   - From Bookmark tab'ında collection saklı (Phase 27 IA karar):
         *     promote endpoint bookmark'ın collection'ını korur, reference'a
         *     override yazar; bookmark tab'ında "bu collection neyi
         *     etkiliyor?" karışıklığını ortadan kaldırmak için alanı
         *     gizliyoruz. URL/Upload tab'larında yeni bookmark+reference
         *     oluştuğu için anlamlı. */}
        <div className="border-t border-line-soft bg-paper px-6 py-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                Product type
              </span>
              <div
                className="flex flex-wrap gap-1.5"
                data-testid="add-ref-product-types"
              >
                {orderedTypes.map((pt) => (
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
              {selectedProductTypeLabel ? (
                <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
                  Defaults to your last used type · {selectedProductTypeLabel}
                </span>
              ) : null}
            </div>
            {/* Collection: bookmark tab'ında saklanır (Phase 27 IA karar) */}
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
            {tab === "url" && urlFetchingCount > 0 ? (
              `Fetching ${urlFetchingCount}…`
            ) : tab === "url" && urlOnSaveAll.isPending ? (
              "Saving…"
            ) : tab === "upload" && uploadAll.isPending ? (
              "Uploading…"
            ) : tab === "bookmark" && promoteBookmarks.isPending ? (
              "Promoting…"
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

/* ───────────────────────── URL TAB (Phase 29 multi-URL queue) ───────────────────────── */
type UrlEntryShape = {
  id: string;
  url: string;
  jobId: string | null;
  status: "idle" | "fetching" | "ready" | "failed";
  assetId?: string;
  error?: string;
  progress?: number;
};

type UrlTabProps = {
  entries: UrlEntryShape[];
  onChangeRow: (id: string, url: string) => void;
  onRemoveRow: (id: string) => void;
  onAddRow: () => void;
  onPaste: (id: string, text: string) => boolean;
  globalMessage: string | null;
};

/**
 * UrlRowThumb — Phase 30 pre-fetch image preview.
 *
 * URL queue row'un thumb slot'unda. Kullanıcı URL paste ettiğinde:
 *   - status === "idle" + URL boş değil → `<img>` direkt yükle.
 *     onLoad: thumb göster. onError: fallback icon (URL image değil
 *     veya 404). Operatör fetch öncesi "doğru URL mi?" cevabını alır.
 *   - status === "fetching" → pulse dot
 *   - status === "ready" + assetId → server-side `<AssetImage>` (fetch
 *     sonrası asset thumb, daha güvenli kaynak)
 *   - status === "failed" → X danger icon
 *
 * Pre-fetch `<img>` yalnız client-side display; backend job yok, no
 * upload, no PII. URL hostname allow-list yapmıyoruz çünkü kullanıcı
 * zaten kendi seçtiği URL'i paste ediyor (anti-pattern: kullanıcı URL'i
 * yasaklamak). CORS image rendering izin verir; data exfil yok.
 */
function UrlRowThumb({
  url,
  status,
  assetId,
}: {
  url: string;
  status: "idle" | "fetching" | "ready" | "failed";
  assetId?: string;
}) {
  const [imgState, setImgState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const trimmedUrl = url.trim();

  // Reset image state when URL changes
  useEffect(() => {
    setImgState("loading");
  }, [trimmedUrl]);

  // Ready (post-fetch): server asset
  if (status === "ready" && assetId) {
    return (
      <div className="k-thumb !w-9 !aspect-square flex-shrink-0">
        <AssetImage assetId={assetId} alt={trimmedUrl} frame={false} />
      </div>
    );
  }

  // Fetching: pulse
  if (status === "fetching") {
    return (
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-k-orange bg-k-orange-soft/20">
        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-k-orange" />
      </div>
    );
  }

  // Failed: X
  if (status === "failed") {
    return (
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-danger/40 bg-danger/5">
        <X className="h-3.5 w-3.5 text-danger" aria-hidden />
      </div>
    );
  }

  // Idle with valid-looking URL → attempt `<img>` pre-fetch render
  const looksLikeUrl = /^https?:\/\//i.test(trimmedUrl);

  if (looksLikeUrl && imgState !== "error") {
    return (
      <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-k-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={trimmedUrl}
          alt=""
          aria-hidden
          className={cn(
            "h-full w-full object-cover transition-opacity",
            imgState === "loaded" ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setImgState("loaded")}
          onError={() => setImgState("error")}
          referrerPolicy="no-referrer"
        />
        {imgState === "loading" ? (
          <LinkIcon
            className="absolute h-3.5 w-3.5 text-ink-3"
            aria-hidden
          />
        ) : null}
      </div>
    );
  }

  // Idle (empty URL or non-http or img failed) → link icon
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-line bg-k-bg">
      <LinkIcon className="h-3.5 w-3.5 text-ink-3" aria-hidden />
    </div>
  );
}

const UrlTab = forwardRef<HTMLInputElement, UrlTabProps>(
  function UrlTab(
    { entries, onChangeRow, onRemoveRow, onAddRow, onPaste, globalMessage },
    ref,
  ) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            Image URL
          </span>
          {entries.length > 1 ? (
            <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
              {entries.length} rows · paste multiple URLs into any row to split
            </span>
          ) : (
            <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
              Paste one or more URLs (one per line)
            </span>
          )}
        </div>

        <div
          className="flex flex-col gap-2"
          data-testid="add-ref-url-queue"
        >
          {entries.map((entry, idx) => {
            const sourceHint = detectSourceFromUrl(entry.url);
            return (
              <div
                key={entry.id}
                className="flex flex-col gap-1.5 rounded-md border border-line-soft bg-paper p-2"
                data-testid="add-ref-url-row"
              >
                <div className="flex items-center gap-2">
                  {/* Phase 30 — pre-fetch preview: idle durumunda direct
                   *   `<img>` ile URL'i render eder. CORS image rendering
                   *   permissive (binary load + display, data extraction
                   *   yok). Kullanıcı paste anında "doğru URL'i mi attım?"
                   *   sorusunu fetch'ten önce cevaplar. Image değilse
                   *   onError ile fallback icon. Fetching/Failed/Ready
                   *   state'ler önceki davranış (Phase 29) korunur. */}
                  <UrlRowThumb
                    url={entry.url}
                    status={entry.status}
                    assetId={entry.assetId}
                  />

                  <input
                    ref={idx === 0 ? ref : undefined}
                    type="url"
                    placeholder="https://i.etsystatic.com/…/il_1140xN.jpg"
                    value={entry.url}
                    onChange={(e) => onChangeRow(entry.id, e.target.value)}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (onPaste(entry.id, text)) {
                        e.preventDefault();
                      }
                    }}
                    disabled={entry.status === "fetching" || entry.status === "ready"}
                    className="k-input flex-1"
                    data-testid="add-ref-url-input"
                  />

                  <button
                    type="button"
                    onClick={() => onRemoveRow(entry.id)}
                    aria-label="Remove URL"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-k-bg hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>

                {/* Source hint + status line */}
                <div className="flex items-center justify-between gap-2 pl-11 pr-1">
                  {entry.status === "failed" ? (
                    <span className="font-mono text-[10.5px] tracking-wider text-danger">
                      {entry.error?.trim() || "Couldn't fetch image"}
                    </span>
                  ) : entry.status === "ready" ? (
                    <span className="font-mono text-[10.5px] tracking-wider text-success">
                      ✓ Image fetched · ready to save
                    </span>
                  ) : entry.status === "fetching" ? (
                    <span className="font-mono text-[10.5px] tracking-wider text-ink-2">
                      Fetching… {entry.progress ? `${entry.progress}%` : null}
                    </span>
                  ) : sourceHint ? (
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
                      {sourceHint.platform === "OTHER" ? null : <span aria-hidden>✓</span>}
                      {sourceHint.label}
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-3">
                      Etsy · Pinterest · Creative Fabrica · or a direct image link
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onAddRow}
          className="self-start font-mono text-[10.5px] uppercase tracking-meta text-ink-3 transition-colors hover:text-ink"
          data-testid="add-ref-url-add-row"
        >
          + Add another URL
        </button>

        {/* DS B5 canonical disclosure (screens-b5-b6.jsx:55-65) */}
        <details
          className="overflow-hidden rounded-lg border border-line"
          data-testid="add-ref-url-disclosure"
        >
          <summary className="flex cursor-pointer items-center justify-between bg-k-bg px-4 py-2.5 text-[12.5px] font-medium text-ink hover:bg-k-bg-2/60">
            <span>How to get the image URL</span>
            <span aria-hidden className="text-ink-3">
              ⌄
            </span>
          </summary>
          <ol className="space-y-2 bg-paper px-4 py-3 text-[12.5px] text-ink-2">
            <li className="flex gap-3">
              <span className="w-5 pt-0.5 font-mono text-[10.5px] tracking-wider text-k-orange">
                01
              </span>
              <span>Right-click the image on Etsy, Pinterest or Creative Fabrica</span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 pt-0.5 font-mono text-[10.5px] tracking-wider text-k-orange">
                02
              </span>
              <span>Select &ldquo;Copy image address&rdquo;</span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 pt-0.5 font-mono text-[10.5px] tracking-wider text-k-orange">
                03
              </span>
              <span>Paste here — Kivasy fetches the image and detects the source</span>
            </li>
          </ol>
        </details>

        {globalMessage ? (
          <p className="text-[12px] text-danger" data-testid="add-ref-url-message">
            {globalMessage}
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
        <>
          {/* Phase 30 — aggregate progress hint. Operatör 10 file
           *   upload edince "5 of 10 ready · 2 uploading · 1 failed"
           *   gibi tek satır toplamı görür. Per-file status detail
           *   aşağıdaki thumb grid'de zaten var. */}
          <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            <span data-testid="add-ref-upload-summary">
              {uploads.filter((u) => u.status === "ready").length} of {uploads.length} ready
              {uploads.filter((u) => u.status === "uploading").length > 0
                ? ` · ${uploads.filter((u) => u.status === "uploading").length} uploading`
                : null}
              {uploads.filter((u) => u.status === "failed").length > 0
                ? ` · ${uploads.filter((u) => u.status === "failed").length} failed`
                : null}
            </span>
          </div>
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
        </>
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
  selectAll,
  clearAll,
}: {
  search: string;
  onSearch: (v: string) => void;
  items: BookmarkLite[];
  loading: boolean;
  selection: Set<string>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;
}) {
  const allInListSelected =
    items.length > 0 && items.every((b) => selection.has(b.id));
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

      {/* Phase 30 — bulk select affordance. Operatör 60 bookmark için
       *   tek-tek click yerine "Select all (filtered)" ile hızlı seçim
       *   yapar. Filtre değişince Select all yeniden filtered list'i
       *   ifade eder (search'le daraltıp seçtikten sonra search temizleyip
       *   yeni grupta yeniden Select all uygular). */}
      {items.length > 0 ? (
        <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          <span>
            {selection.size} of {items.length} selected
            {search.trim() ? " · filtered" : null}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selectAll}
              disabled={allInListSelected}
              className="transition-colors hover:text-ink disabled:opacity-40"
              data-testid="add-ref-bookmark-select-all"
            >
              Select all
            </button>
            {selection.size > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="transition-colors hover:text-ink"
                data-testid="add-ref-bookmark-clear-all"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

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
          {selection.size} selected · will promote to Pool
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
