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

type TabId = "url" | "upload" | "bookmark" | "local";

/* Phase 40 — Local Library tab data shapes (kept lightweight on the
 * client; full schema lives server-side). */
type LocalFolderLite = {
  name: string;
  path: string;
  fileCount: number;
  coverHashes: string[];
};

type LocalAssetLite = {
  id: string;
  hash: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
};

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
  platform:
    | "ETSY"
    | "ETSY_LISTING"
    | "PINTEREST"
    | "CREATIVE_FABRICA"
    | "CREATIVE_FABRICA_LISTING"
    | "DIRECT"
    | "OTHER";
  label: string;
};

/**
 * Phase 37 — Listing picker source identifier. Single picker component
 * dispatches to platform-specific service endpoint based on this value.
 * Adding a new listing source (e.g. Pinterest pin URL) means:
 *   - new SourceHint platform marker (above)
 *   - new ListingSource value
 *   - new branch in LISTING_SOURCES below
 *   - server-side service + endpoint
 * UI shape (header copy, error fallback, image grid, footer) stays
 * shared.
 */
type ListingSource = "etsy" | "cf";

const LISTING_SOURCES: Record<
  ListingSource,
  {
    endpoint: string;
    queryKeyPrefix: string;
    siteLabel: string;
    headerTitle: string;
    blockedTitle: string;
    blockedExplanation: string;
  }
> = {
  etsy: {
    endpoint: "/api/scraper/etsy-listing-images",
    queryKeyPrefix: "etsy-listing-images",
    siteLabel: "Etsy",
    headerTitle: "Choose images from this Etsy listing",
    blockedTitle: "Etsy is blocking server-side requests",
    blockedExplanation:
      "Etsy uses anti-bot protection on listing pages, so we can't auto-pull the images. You have two options:",
  },
  cf: {
    endpoint: "/api/scraper/creative-fabrica-listing-images",
    queryKeyPrefix: "cf-listing-images",
    siteLabel: "Creative Fabrica",
    headerTitle: "Choose images from this Creative Fabrica listing",
    blockedTitle: "Creative Fabrica is blocking server-side requests",
    blockedExplanation:
      "Creative Fabrica uses anti-bot protection on product pages, so we can't auto-pull the images. You have two options:",
  },
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
 *
 * Phase 35 — Etsy listing detail (`etsy.com/listing/{id}/...`) ile Etsy CDN
 * direct image (`etsystatic.com/...`) ayrılır. Listing URL'i için ayrı
 * "ETSY_LISTING" platform marker'ı dönülür.
 *
 * Phase 38 — Etsy + CF listing-image pickers PASIVE. Marker'lar
 * detection için korunur (operatöre "biz listing URL'i tanıdık" sinyali
 * + doğru passive copy göstermek için), ama UrlTab branch artık canlı
 * request tetikleyen "View all images" CTA'sı yerine bilgilendirici
 * info panel render eder. Anti-bot duvarı (Datadome / Cloudflare
 * Turnstile) yüzünden server-side fetch güvenilir olmadığı için
 * `View all images` deneyimi pasifleştirildi.
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
  // Etsy listing detail page (NOT a direct image URL) — Phase 38:
  // passive copy; UI yönergesi direct image URL'i operatöre işaret
  // ediyor.
  if (host.includes("etsy.com") && /\/listing\/\d+/i.test(trimmed)) {
    return {
      platform: "ETSY_LISTING",
      label: "Etsy listing page detected",
    };
  }
  if (host.includes("etsystatic.com") || host.includes("etsy.com")) {
    return { platform: "ETSY", label: "Looks like Etsy" };
  }
  if (host.includes("pinimg.com") || host.includes("pinterest.")) {
    return { platform: "PINTEREST", label: "Looks like Pinterest" };
  }
  /* Phase 37 — Creative Fabrica product page (listing) — same pattern as
   * Etsy listing.
   * Phase 38 — passive copy paritesi. */
  if (
    host.includes("creativefabrica.com") &&
    /\/product\/[^/?#]+/i.test(trimmed)
  ) {
    return {
      platform: "CREATIVE_FABRICA_LISTING",
      label: "Creative Fabrica product page detected",
    };
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

  /* Phase 35 — Etsy listing image picker state.
   * Phase 37 — source-aware genişletme: aynı picker artık iki kaynak
   * destekler (Etsy, Creative Fabrica). `source` field'ı hangi
   * upstream service endpoint'inin çağrılacağını belirler. Operatör
   * "View all images" tıklayınca picker açılır; server ilgili listing
   * service'i (Etsy / CF) tüm görselleri + title'ı döner. Operatör
   * multi-select yapar; "Add N images" tıkladığında seçilen URL'ler
   * queue'ya yeni row olarak eklenir (mevcut tek-row listing URL'i
   * kaldırılır — operatör listing değil görselleri save eder). */
  const [listingPicker, setListingPicker] = useState<{
    sourceRowId: string;
    listingUrl: string;
    source: ListingSource;
  } | null>(null);

  // Upload tab state — multi-file
  // Phase 41 — sourceFolder added for folder-mode upload (operator
  // picks a whole folder, all images grouped by their relative
  // subfolder). `<root>` for files dropped/picked individually.
  type UploadEntry = {
    id: string;
    file: File;
    previewUrl: string;
    status: "pending" | "uploading" | "ready" | "failed";
    assetId?: string;
    error?: string;
    sourceFolder: string;
  };
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

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

  /* Phase 40 — Local Library tab state.
   *
   * Operator picks an active root folder (from settings), this tab
   * lists folders + their assets, multi-select, then commits via
   * POST /api/references/from-local-library which:
   *   1. reads each LocalLibraryAsset filePath from disk
   *   2. uploads to storage via createAssetFromBuffer (hash dedup)
   *   3. creates an INBOX Bookmark
   *   4. promotes to Reference (single transactional chain reuse)
   *
   * No schema migration. LocalLibraryAsset stays in place; we copy
   * the byte content into the canonical Asset/storage pipeline. */
  const [localFolder, setLocalFolder] = useState<string | null>(null);
  const [localAssetSelection, setLocalAssetSelection] = useState<Set<string>>(
    new Set(),
  );

  const localFoldersQuery = useQuery({
    queryKey: ["local-library", "folders"],
    queryFn: async () => {
      const res = await fetch("/api/local-library/folders", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load folders");
      return (await res.json()) as { folders: LocalFolderLite[] };
    },
    enabled: tab === "local",
  });

  const localAssetsQuery = useQuery({
    queryKey: ["local-library", "assets", localFolder],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (localFolder) params.set("folder", localFolder);
      const res = await fetch(
        `/api/local-library/assets?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Failed to load assets");
      return (await res.json()) as { assets: LocalAssetLite[] };
    },
    enabled: tab === "local" && !!localFolder,
  });

  // Auto-pick first folder when the tab loads (cheap UX).
  useEffect(() => {
    if (tab !== "local") return;
    if (localFolder) return;
    const first = localFoldersQuery.data?.folders?.[0]?.name;
    if (first) setLocalFolder(first);
  }, [tab, localFolder, localFoldersQuery.data]);

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

  // Phase 40 — Multi local-asset promote → Reference (From Local
  // Library tab). Single endpoint handles disk→buffer→Asset→Bookmark→
  // Reference chain server-side; idempotent at hash level.
  const promoteLocalAssets = useMutation({
    mutationFn: async () => {
      const ids = Array.from(localAssetSelection);
      if (ids.length === 0) throw new Error("No local assets selected");
      if (!productTypeId) throw new Error("Pick a product type");
      const res = await fetch("/api/references/from-local-library", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          localAssetIds: ids,
          productTypeId,
          collectionId: collectionId ?? undefined,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Failed to import local assets");
      }
      const data = (await res.json()) as {
        references: Array<{
          referenceId: string;
          bookmarkId: string;
          reused: boolean;
        }>;
        failed: Array<{ localAssetId: string; error: string }>;
      };
      if (data.references.length === 0 && data.failed.length > 0) {
        throw new Error(
          `${data.failed.length} of ${ids.length} imports failed`,
        );
      }
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["references"] });
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      // If everything succeeded AND no items were reused (Phase 41
      // dedup), close immediately. If partial OR any reuse happened,
      // leave the modal open so the operator can read the breakdown
      // — "X added, Y already in Pool".
      const reusedCount = data.references.filter((r) => r.reused).length;
      if (data.failed.length === 0 && reusedCount === 0) {
        onCreated?.();
        onClose();
      } else {
        onCreated?.();
      }
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

  /* Phase 35 — Etsy listing picker entry. Operatör picker'da N görsel
   * seçince listing URL row'unu kaldırıp N yeni idle row ekleriz.
   * Yeni row'lar idle → operatör hepsini "Fetch N images" ile çeker. */
  function urlReplaceRowWithUrls(rowId: string, newUrls: string[]) {
    setUrlEntries((cur) => {
      const filtered = cur.filter((e) => e.id !== rowId);
      const additions: UrlEntry[] = newUrls.map((u) => ({
        id: crypto.randomUUID(),
        url: u,
        jobId: null,
        status: "idle",
      }));
      const merged = [...filtered, ...additions];
      // Defansif: tüm row'lar uçtuysa 1 boş row bırak (UI hep en az 1 satır)
      if (merged.length === 0) {
        return [
          { id: crypto.randomUUID(), url: "", jobId: null, status: "idle" },
        ];
      }
      return merged;
    });
  }

  function urlUpdateRow(id: string, patch: Partial<UrlEntry>) {
    setUrlEntries((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  /* Multi-line paste support: if user pastes text with newlines into a
   * single URL input, split into multiple entries. Operator pastes 8 URLs
   * from notes app → 8 row instantly. */
  /**
   * Phase 39 — paste handler.
   *
   * Cleans the pasted text:
   *   - splits on `\r?\n` (CR/LF agnostic — copy from any OS)
   *   - trims each line
   *   - drops blank lines (operator-friendly: paste "url1\n\n\nurl2"
   *     produces 2 rows, not 5)
   *
   * Two behaviors:
   *   1. 0 valid lines → native paste does nothing useful; we
   *      preventDefault so the target row stays unchanged.
   *   2. 1 valid line → write the trimmed URL into the target row,
   *      preventDefault. This catches "paste `\n\nhttps://...\n\n`"
   *      cases that previously filled the input with newlines.
   *   3. N valid lines → fill target + append rest as new rows. Existing
   *      rows that have URLs or non-idle status are preserved.
   */
  function urlHandlePaste(targetId: string, text: string) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) {
      // Pure-whitespace paste; preventDefault to avoid filling input
      // with junk.
      return true;
    }
    if (lines.length === 1) {
      // Single URL with surrounding whitespace/blank lines — write the
      // cleaned line into the target row.
      const onlyUrl = lines[0]!;
      urlUpdateRow(targetId, {
        url: onlyUrl,
        status: "idle",
        error: undefined,
      });
      return true;
    }
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
  // Phase 41 — folder-mode support. When the operator picks a whole
  // folder via `<input webkitdirectory>`, each File carries a
  // `webkitRelativePath` like "MyFolder/sub/img.png". We derive the
  // source folder (last directory segment) for visual grouping
  // without touching the LocalLibraryAsset / settings root pipeline.
  // Files dropped/picked individually keep `sourceFolder = "<root>"`
  // (rendered as "Browser drop" in UI to avoid pretending these are
  // a folder).
  function acceptFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) =>
      /^image\/(png|jpe?g|webp)$/i.test(f.type),
    );
    const entries: UploadEntry[] = list.map((file) => {
      // webkitRelativePath: empty for individually picked files;
      // "FolderName/img.png" for folder-mode; nested "FolderName/sub/img.png"
      // for nested folders. We take the last directory segment as a
      // simple grouping label (no full-path display, no leak of
      // operator's filesystem layout).
      const relPath = (file as File & { webkitRelativePath?: string })
        .webkitRelativePath ?? "";
      const segments = relPath.split("/").filter((s) => s.length > 0);
      const sourceFolder =
        segments.length >= 2 ? segments[segments.length - 2]! : "<root>";
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${relPath}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: "pending" as const,
        sourceFolder,
      };
    });
    // Dedup by id (same file picked twice during folder picker re-open
    // wouldn't show a second entry).
    setUploads((cur) => {
      const seen = new Set(cur.map((u) => u.id));
      return [...cur, ...entries.filter((e) => !seen.has(e.id))];
    });
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
      promoteLocalAssets.isPending ||
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
    promoteLocalAssets.isPending,
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
  const localCount = localAssetSelection.size;

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
    if (tab === "local") {
      return localCount > 1
        ? `Add ${localCount} References`
        : "Add Reference";
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
    if (tab === "local") {
      return (
        !productTypeId ||
        localCount === 0 ||
        promoteLocalAssets.isPending
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
    } else if (tab === "local") {
      promoteLocalAssets.mutate();
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
                { id: "local", label: "From Local Library" },
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
                {t.id === "local" && localCount > 0 ? (
                  <span className="k-stab__count">{localCount}</span>
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
              /* Phase 38 — Etsy + CF listing picker pasive. UrlTab
               * artık `onOpenListingPicker` prop'unu almıyor → "View
               * all images" CTA render edilmez → request hiç atılmaz.
               * UrlTab içinde detection + passive info panel kalır
               * (operatöre net yönerge). ListingPicker component'i
               * ve `listingPicker` state diskte korunur (Phase 35-37
               * kodu silinmez; ileride browser-side / extension
               * çözümüyle geri açılabilir). */
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
              openFolderPicker={() => folderInputRef.current?.click()}
              fileInputRef={fileInputRef}
              folderInputRef={folderInputRef}
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

          {tab === "local" ? (
            <LocalLibraryTab
              folders={localFoldersQuery.data?.folders ?? []}
              foldersLoading={localFoldersQuery.isLoading}
              foldersError={
                localFoldersQuery.isError
                  ? (localFoldersQuery.error as Error).message
                  : null
              }
              activeFolder={localFolder}
              onPickFolder={(name) => {
                setLocalFolder(name);
                setLocalAssetSelection(new Set());
              }}
              assets={localAssetsQuery.data?.assets ?? []}
              assetsLoading={localAssetsQuery.isLoading}
              selection={localAssetSelection}
              toggleSelect={(id) =>
                setLocalAssetSelection((cur) => {
                  const next = new Set(cur);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              selectAll={() =>
                setLocalAssetSelection((cur) => {
                  const next = new Set(cur);
                  for (const a of localAssetsQuery.data?.assets ?? []) {
                    next.add(a.id);
                  }
                  return next;
                })
              }
              clearAll={() => setLocalAssetSelection(new Set())}
              partialFailureMessage={(() => {
                const data = promoteLocalAssets.data;
                if (!data) return null;
                const added = data.references.filter((r) => !r.reused).length;
                const reused = data.references.filter((r) => r.reused).length;
                const failed = data.failed.length;
                if (failed === 0 && reused === 0) return null;
                const parts: string[] = [];
                if (added > 0) parts.push(`${added} added`);
                if (reused > 0)
                  parts.push(`${reused} already in Pool (reused)`);
                if (failed > 0) parts.push(`${failed} failed`);
                return parts.join(" · ");
              })()}
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
            ) : tab === "local" && promoteLocalAssets.isPending ? (
              "Importing…"
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
        {promoteLocalAssets.isError ? (
          <div
            className="border-t border-danger/40 bg-danger/5 px-5 py-2 text-[12px] text-danger"
            data-testid="add-ref-local-error"
          >
            {(promoteLocalAssets.error as Error).message}
          </div>
        ) : null}
      </div>

      {/* Phase 35-37: Etsy + CF listing image picker (modal-over-
       * modal) burada render edilirdi.
       *
       * Phase 38 — DORMANT.
       *   UrlTab artık `onOpenListingPicker` callback'ini almadığı
       *   için `setListingPicker` çağrılmaz; `listingPicker` state
       *   her zaman null; bu blok hiç render edilmez.
       *
       *   `ListingPicker` component'i, `listingPicker` state ve
       *   `urlReplaceRowWithUrls` helper'ı diskte KORUNUR — Phase
       *   35-37 işi silinmedi. Gelecek browser-side / extension
       *   tabanlı çözüm landing yaptığında UrlTab'a callback geri
       *   geçilir → blok yeniden canlanır.
       *
       *   Şu an aktif olsaydı operatör "View all images" tıklardı,
       *   server bir CF/Etsy fetch atardı, Datadome / Cloudflare
       *   Turnstile 403 dönerdi, blocked fallback UI'ı görülürdü.
       *   Bu deneyim "var ama çalışmıyor" hissi verdiği için (ve
       *   IP reputation maliyeti olduğu için) Phase 38'de
       *   pasifleştirildi. */}
      {listingPicker ? (
        <ListingPicker
          listingUrl={listingPicker.listingUrl}
          source={listingPicker.source}
          onClose={() => setListingPicker(null)}
          onSubmit={(urls) => {
            urlReplaceRowWithUrls(listingPicker.sourceRowId, urls);
            setListingPicker(null);
          }}
        />
      ) : null}
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
  /* Phase 35 — Etsy listing URL → image picker callback.
   * Phase 37 — source-aware genişletme: `source` parametresi hangi
   * listing service'inin tetikleneceğini ("etsy" | "cf") taşır.
   * UrlTab kendisi picker UI'ı render etmez; parent component
   * `openListingPicker(rowId, url, source)` ile picker'ı açar.
   * Picker seçimleri parent tarafında queue'ya basılır. */
  onOpenListingPicker?: (
    rowId: string,
    url: string,
    source: ListingSource,
  ) => void;
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
    {
      entries,
      onChangeRow,
      onRemoveRow,
      onAddRow,
      onPaste,
      onOpenListingPicker,
      globalMessage,
    },
    ref,
  ) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            Direct image URL
          </span>
          {entries.length > 1 ? (
            <span
              className="font-mono text-[10.5px] tracking-wider text-ink-3"
              data-testid="add-ref-url-helper"
            >
              {entries.length} rows · Enter to advance · paste multiple URLs to split
            </span>
          ) : (
            <span
              className="font-mono text-[10.5px] tracking-wider text-ink-3"
              data-testid="add-ref-url-helper"
            >
              Paste one or more direct image URLs · press Enter for a new row
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
                data-add-ref-url-row-id={entry.id}
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
                    onKeyDown={(e) => {
                      /* Phase 39 — Enter advances to the next row
                       * (queue mode ergonomics). NEVER triggers fetch
                       * or submit. Behavior:
                       *   - If a next row exists: focus its input.
                       *   - If this is the last row: ask parent to
                       *     append a fresh row, then focus the new
                       *     input on the next paint (rAF). */
                      if (e.key !== "Enter") return;
                      // Don't ever submit a containing form (defensive
                      // — Add Reference dialog has no form wrapper but
                      // future split-modal embeddings should not break).
                      e.preventDefault();
                      const nextEntry = entries[idx + 1];
                      const focusByRowId = (rowId: string) => {
                        const sel = `[data-add-ref-url-row-id="${rowId}"] [data-testid="add-ref-url-input"]`;
                        const el = document.querySelector<HTMLInputElement>(sel);
                        el?.focus();
                        el?.select?.();
                      };
                      if (nextEntry) {
                        focusByRowId(nextEntry.id);
                        return;
                      }
                      // Don't auto-append if the current row is still
                      // empty — operator is just spamming Enter on a
                      // blank row, give them nothing.
                      if (!entry.url.trim()) return;
                      onAddRow();
                      // New row id is unknown to us synchronously; the
                      // parent's setState batches. Focus the last
                      // input element after React commits the new row
                      // (microtask + paint). One rAF inside a 0-delay
                      // timeout gives React time to flush the state
                      // update before we read the DOM.
                      setTimeout(() => {
                        const inputs = document.querySelectorAll<HTMLInputElement>(
                          '[data-testid="add-ref-url-input"]',
                        );
                        inputs[inputs.length - 1]?.focus();
                      }, 0);
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
                  ) : sourceHint?.platform === "ETSY_LISTING" ||
                    sourceHint?.platform === "CREATIVE_FABRICA_LISTING" ? (
                    /* Phase 35 → Phase 37: listing detection + "View all
                     * images" affordance ile picker açılırdı.
                     *
                     * Phase 38 — PASSIVE STATE:
                     *   Etsy = Datadome WAF, Creative Fabrica =
                     *   Cloudflare Turnstile. Server-side reliable
                     *   success path yok. Bu yüzden CTA + canlı request
                     *   pasifleştirildi. Detection korunur (operatör
                     *   "biz tanıdık" sinyalini görür), ama hiç request
                     *   atılmaz; bunun yerine kullanıcıya direct image
                     *   URL yönergesi gösterilir.
                     *
                     *   - hiç fetch yok
                     *   - hiç spinner yok
                     *   - hiç "blocked" error sayfası yok
                     *   - operatör neyi yapmalı net görür: image
                     *     address'i kopyala, queue'ya paste'le. */
                    <span
                      className="inline-flex items-center gap-1 font-mono text-[10.5px] tracking-wider text-ink-2"
                      data-testid="add-ref-source-hint"
                      data-listing-source={
                        sourceHint.platform === "ETSY_LISTING" ? "etsy" : "cf"
                      }
                    >
                      <span aria-hidden>•</span> {sourceHint.label}
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

                {/* Phase 38 — passive info panel for Etsy + CF listing
                 *   URLs. When the row contains a product page (not a
                 *   direct image URL), this block tells the operator
                 *   what to do: copy the direct image address from the
                 *   browser and paste it instead. No live request is
                 *   triggered from this row. */}
                {sourceHint?.platform === "ETSY_LISTING" ||
                sourceHint?.platform === "CREATIVE_FABRICA_LISTING" ? (
                  <div
                    className="ml-11 mt-0.5 rounded-md border border-line-soft bg-k-bg-2/40 px-3 py-2 text-[11.5px] text-ink-2"
                    data-testid="add-ref-listing-passive-panel"
                    data-listing-source={
                      sourceHint.platform === "ETSY_LISTING" ? "etsy" : "cf"
                    }
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span
                        aria-hidden
                        className="text-[10.5px] font-mono uppercase tracking-meta text-ink-3"
                      >
                        Heads up
                      </span>
                      <span className="font-medium text-ink">
                        Pulling images from{" "}
                        {sourceHint.platform === "ETSY_LISTING"
                          ? "Etsy"
                          : "Creative Fabrica"}{" "}
                        product pages is temporarily unavailable.
                      </span>
                    </div>
                    <p className="mt-1 leading-snug text-ink-2">
                      Open the page in your browser, right-click the
                      image you want and choose{" "}
                      <em>&ldquo;Copy image address&rdquo;</em>, then
                      paste that direct image URL into this row (or any
                      other row). The queue handles the rest.
                    </p>
                  </div>
                ) : null}
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
            <span>How to get a direct image URL</span>
            <span aria-hidden className="text-ink-3">
              ⌄
            </span>
          </summary>
          <ol className="space-y-2 bg-paper px-4 py-3 text-[12.5px] text-ink-2">
            <li className="flex gap-3">
              <span className="w-5 pt-0.5 font-mono text-[10.5px] tracking-wider text-k-orange">
                01
              </span>
              <span>
                Open the source page in your browser (Etsy, Pinterest,
                Creative Fabrica, or anywhere else)
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 pt-0.5 font-mono text-[10.5px] tracking-wider text-k-orange">
                02
              </span>
              <span>
                Right-click the image you want and select{" "}
                <em>&ldquo;Copy image address&rdquo;</em>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="w-5 pt-0.5 font-mono text-[10.5px] tracking-wider text-k-orange">
                03
              </span>
              <span>
                Paste here — Kivasy fetches the image, builds a preview
                and detects the source
              </span>
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
  openFolderPicker,
  fileInputRef,
  folderInputRef,
}: {
  uploads: {
    id: string;
    file: File;
    previewUrl: string;
    status: "pending" | "uploading" | "ready" | "failed";
    error?: string;
    sourceFolder: string;
  }[];
  dragOver: boolean;
  setDragOver: (b: boolean) => void;
  acceptFiles: (files: FileList | File[]) => void;
  removeUpload: (id: string) => void;
  openFilePicker: () => void;
  openFolderPicker: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  folderInputRef: React.RefObject<HTMLInputElement>;
}) {
  /* Phase 41 — folder-mode upload. Files carrying a non-empty
   * webkitRelativePath are grouped by their immediate parent folder
   * (sourceFolder), giving the operator a visible "these came from
   * Folder A, those came from Folder B" picture. Individual drops
   * are grouped under "Browser drop" so they don't masquerade as a
   * folder. Order preserved (insertion order). */
  const grouped = (() => {
    const map = new Map<string, typeof uploads>();
    for (const u of uploads) {
      const key = u.sourceFolder === "<root>" ? "Browser drop" : u.sourceFolder;
      const arr = map.get(key) ?? [];
      arr.push(u);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  })();
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
          Drop images or pick a folder
        </div>
        <div className="mt-1 font-mono text-[10.5px] tracking-wider text-ink-3">
          PNG · JPG · JPEG · WEBP · max 20 MB each · folder mode groups by subfolder
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={openFilePicker}
            data-size="sm"
            className="k-btn k-btn--secondary"
            data-testid="add-ref-upload-browse"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Browse files
          </button>
          <button
            type="button"
            onClick={openFolderPicker}
            data-size="sm"
            className="k-btn k-btn--ghost"
            data-testid="add-ref-upload-folder"
            title="Pick a folder — every image inside it is loaded, grouped by subfolder. No filesystem path is stored; this is browser-only intake."
          >
            <Plus className="h-3 w-3" aria-hidden />
            Pick a folder
          </button>
        </div>
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
        {/* Phase 41 — folder mode. webkitdirectory is non-standard but
         * supported by Chromium/WebKit/Gecko. accept attribute is
         * ignored by directory pickers (browsers walk the whole tree),
         * so we filter MIME types in acceptFiles(). */}
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error — webkitdirectory is a non-standard but
          // widely-supported attribute; React's HTMLInputElement type
          // doesn't include it.
          webkitdirectory="true"
          // directory mirror for Firefox compat (no-op elsewhere).
          directory="true"
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
           *   aşağıdaki thumb grid'de zaten var.
           *   Phase 41 — folder count surfaced too. */}
          <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            <span data-testid="add-ref-upload-summary">
              {uploads.filter((u) => u.status === "ready").length} of {uploads.length} ready
              {uploads.filter((u) => u.status === "uploading").length > 0
                ? ` · ${uploads.filter((u) => u.status === "uploading").length} uploading`
                : null}
              {uploads.filter((u) => u.status === "failed").length > 0
                ? ` · ${uploads.filter((u) => u.status === "failed").length} failed`
                : null}
              {grouped.length > 1
                ? ` · from ${grouped.length} folders`
                : null}
            </span>
          </div>
          {/* Phase 41 — per-folder grouping. Single source (all "<root>"
           * drops or one folder pick) renders as flat grid without
           * folder header. Multiple sources render with mono caption
           * folder headers + their own grid each, so the operator
           * sees the intake provenance clearly. */}
          {grouped.length === 1 ? (
            <div className="grid grid-cols-3 gap-2">
              {grouped[0]![1].map((u) => (
                <UploadThumb key={u.id} u={u} removeUpload={removeUpload} />
              ))}
            </div>
          ) : (
            <div
              className="flex flex-col gap-4"
              data-testid="add-ref-upload-groups"
            >
              {grouped.map(([folder, items]) => (
                <div
                  key={folder}
                  data-testid="add-ref-upload-group"
                  data-folder={folder}
                >
                  <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                    <span aria-hidden>▸</span>
                    <span className="text-ink-2">{folder}</span>
                    <span>· {items.length}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((u) => (
                      <UploadThumb
                        key={u.id}
                        u={u}
                        removeUpload={removeUpload}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

/* UploadThumb — shared thumbnail card used by flat and grouped
 * render paths above. Phase 41 split to avoid duplicating the
 * thumb markup in two branches. */
function UploadThumb({
  u,
  removeUpload,
}: {
  u: {
    id: string;
    file: File;
    previewUrl: string;
    status: "pending" | "uploading" | "ready" | "failed";
    error?: string;
  };
  removeUpload: (id: string) => void;
}) {
  return (
    <div
      className="overflow-hidden rounded-md border border-line bg-paper"
      data-testid="add-ref-upload-thumb"
    >
      <div className="aspect-square w-full bg-k-bg-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
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

/* ───────────────────────── LOCAL LIBRARY TAB (Phase 40) ───────────────────────── */
/**
 * LocalLibraryTab — folder picker + asset grid + multi-select.
 *
 * Operatör Settings → Local library altında bir rootFolderPath
 * ayarlamış olmalı. Yoksa folders listesi boş döner ve operatöre
 * "no folders" mesajı gösterilir.
 *
 * Asset grid 4-col, k-thumb pattern (B5 Upload tab parallel'i),
 * select all / clear (Phase 30 BookmarkTab pattern paritesi).
 *
 * Thumbnail endpoint: `/api/local-library/thumbnail?hash=...` (var
 * olan endpoint, IA-33). Asset id'leri parent state'ine seçilir;
 * commit anında parent `POST /api/references/from-local-library`
 * ile gerçek import yapar.
 */
function LocalLibraryTab({
  folders,
  foldersLoading,
  foldersError,
  activeFolder,
  onPickFolder,
  assets,
  assetsLoading,
  selection,
  toggleSelect,
  selectAll,
  clearAll,
  partialFailureMessage,
}: {
  folders: LocalFolderLite[];
  foldersLoading: boolean;
  foldersError: string | null;
  activeFolder: string | null;
  onPickFolder: (name: string) => void;
  assets: LocalAssetLite[];
  assetsLoading: boolean;
  selection: Set<string>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;
  partialFailureMessage: string | null;
}) {
  const allInListSelected =
    assets.length > 0 && assets.every((a) => selection.has(a.id));

  if (foldersError) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/5 p-4 text-[12.5px] text-danger">
        {foldersError}
      </div>
    );
  }

  if (foldersLoading) {
    return (
      <div className="text-[12px] text-ink-3">Loading local folders…</div>
    );
  }

  if (folders.length === 0) {
    return (
      <div
        className="rounded-md border border-line-soft bg-k-bg-2/30 p-4 text-[12.5px] text-ink-3"
        data-testid="add-ref-local-empty"
      >
        <div className="font-medium text-ink">No local folders found</div>
        <p className="mt-1 leading-snug">
          Set a local library root folder in{" "}
          <span className="font-mono text-[11.5px]">
            Settings → Local library
          </span>{" "}
          and scan it. Folders that contain scanned assets will appear
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Folder picker — segmented chips. Phase 30 BookmarkTab/Filter
        * chip pattern; many folders → operator scrolls horizontally. */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          Folder
        </span>
        <div
          className="flex flex-wrap gap-1.5"
          data-testid="add-ref-local-folder-list"
        >
          {folders.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => onPickFolder(f.name)}
              aria-pressed={activeFolder === f.name}
              className={cn(
                "k-chip",
                activeFolder === f.name && "k-chip--active",
              )}
              data-testid="add-ref-local-folder-chip"
            >
              {f.name}
              <span className="ml-1.5 font-mono text-[10px] text-ink-3">
                · {f.fileCount}
              </span>
            </button>
          ))}
        </div>
      </div>

      {assets.length > 0 ? (
        <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          <span data-testid="add-ref-local-summary">
            {selection.size} of {assets.length} selected · will promote
            to Pool
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={selectAll}
              disabled={allInListSelected}
              className="transition-colors hover:text-ink disabled:opacity-40"
              data-testid="add-ref-local-select-all"
            >
              Select all
            </button>
            {selection.size > 0 ? (
              <button
                type="button"
                onClick={clearAll}
                className="transition-colors hover:text-ink"
                data-testid="add-ref-local-clear-all"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {assetsLoading ? (
        <div className="text-[12px] text-ink-3">Loading assets…</div>
      ) : activeFolder && assets.length === 0 ? (
        <div className="rounded-md border border-line-soft bg-k-bg-2/30 p-4 text-[12.5px] text-ink-3">
          No assets in this folder.
        </div>
      ) : assets.length > 0 ? (
        <div
          className="grid grid-cols-4 gap-3"
          data-testid="add-ref-local-grid"
        >
          {assets.map((a) => {
            const sel = selection.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleSelect(a.id)}
                aria-pressed={sel}
                className={cn(
                  "group relative overflow-hidden rounded-md border bg-paper transition-all",
                  sel
                    ? "border-k-orange ring-2 ring-k-orange-soft"
                    : "border-line hover:border-line-strong",
                )}
                data-testid="add-ref-local-asset"
                title={a.fileName}
              >
                <div className="aspect-square w-full bg-k-bg-2">
                  {/* Server-rendered thumbnail; reuses Phase 21 endpoint. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/local-library/thumbnail?hash=${encodeURIComponent(
                      a.hash,
                    )}`}
                    alt={a.fileName}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span
                  className={cn(
                    "absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded border bg-paper/95",
                    sel
                      ? "border-k-orange text-k-orange-ink bg-k-orange"
                      : "border-line text-transparent",
                  )}
                  aria-hidden
                >
                  {sel ? (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      className="text-paper"
                    >
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
              </button>
            );
          })}
        </div>
      ) : null}

      {partialFailureMessage ? (
        <div
          className="rounded-md border border-warning/40 bg-warning/5 p-3 text-[12px] text-warning"
          data-testid="add-ref-local-partial-failure"
        >
          {partialFailureMessage}
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────── LISTING PICKER (Phase 35 → Phase 37) ───────────────────────── */
/**
 * ListingPicker — modal-over-modal listing image picker.
 *
 * Phase 35: yalnız Etsy listing destekliyordu (`EtsyListingPicker`).
 * Phase 37: source-aware refactor → aynı component Etsy + Creative
 * Fabrica için kullanılır. `source` prop'u service endpoint + copy
 * seçer (`LISTING_SOURCES` map).
 *
 * Operatör URL row'da "View all images" tıklayınca açılır. Server-side
 * platform-specific service (Etsy: `/api/scraper/etsy-listing-images`,
 * CF: `/api/scraper/creative-fabrica-listing-images`) listing'in tüm
 * görsellerini + title'ı döner. Operatör multi-select yapar, "Add N
 * images" tıklayınca seçilen URL'ler queue'ya yeni idle row olarak
 * basılır.
 *
 * Direct image URL akışı bozulmaz: listing detection sadece domain +
 * path formatına bağlı (Etsy: `etsy.com/listing/{id}`, CF:
 * `creativefabrica.com/product/{slug}`); direct image URL paste
 * edilirse picker hiç açılmaz, mevcut akış devam eder.
 *
 * a11y: role="dialog" + aria-modal + aria-labelledby + Escape close +
 * backdrop click (busy-guard).
 */
function ListingPicker({
  listingUrl,
  source,
  onClose,
  onSubmit,
}: {
  listingUrl: string;
  source: ListingSource;
  onClose: () => void;
  onSubmit: (urls: string[]) => void;
}) {
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const sourceConfig = LISTING_SOURCES[source];

  /* Phase 36 — error code'u Error object'ine doğrudan field olarak
   * attach ediyoruz. Class instanceof React Query queryFn boundary'sinde
   * stable reference vermiyor (component re-render her seferinde yeni
   * class oluşturur); plain `error.code` field'ı serialization-safe. */
  const query = useQuery({
    queryKey: [sourceConfig.queryKeyPrefix, listingUrl],
    queryFn: async () => {
      const res = await fetch(sourceConfig.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: listingUrl }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: "blocked" | "fetch_failed";
        };
        const err = new Error(payload.error ?? "Couldn't fetch listing");
        (err as Error & { code?: string }).code = payload.code ?? "unknown";
        throw err;
      }
      return (await res.json()) as {
        externalId: string;
        title: string;
        imageUrls: string[];
        warnings: string[];
      };
    },
    retry: false,
  });

  const errorCode =
    (query.error as Error & { code?: string } | null)?.code ?? "unknown";

  /* All-images select-all toggle (Phase 30 From Bookmark Select all pattern
   * paritesi). */
  const allSelected =
    !!query.data &&
    query.data.imageUrls.length > 0 &&
    query.data.imageUrls.every((u) => selection.has(u));

  const toggle = (url: string) => {
    setSelection((cur) => {
      const next = new Set(cur);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAll = () => {
    if (!query.data) return;
    setSelection(new Set(query.data.imageUrls));
  };
  const clearAll = () => setSelection(new Set());

  // Escape close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    onClose();
  };

  const submit = () => {
    if (selection.size === 0) return;
    onSubmit(Array.from(selection));
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-bg/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-picker-title"
      onClick={onBackdropClick}
      data-testid="listing-picker"
      data-source={source}
    >
      <div className="flex h-[min(720px,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-popover">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-paper px-6 py-4">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2
              id="listing-picker-title"
              className="text-[16px] font-semibold text-ink"
            >
              {sourceConfig.headerTitle}
            </h2>
            <span
              className="truncate font-mono text-[10.5px] tracking-wider text-ink-3"
              title={listingUrl}
            >
              {listingUrl}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-k-bg hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-k-orange"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-paper px-6 py-5">
          {query.isLoading ? (
            <div className="flex items-center gap-2 text-[12px] text-ink-3">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-k-orange" />
              Fetching listing images…
            </div>
          ) : query.isError ? (
            /* Phase 36 — typed error UX. `blocked` code (Datadome WAF /
             * HTTP 403/429/503) için actionable fallback copy. Generic
             * fetch_failed için retry + raw error mesajı. Kullanıcı
             * "broken affordance" hissi yerine "alternatif yol var"
             * hissi alır. */
            <div
              className="flex flex-col gap-3 rounded-md border border-danger/40 bg-danger/5 p-4 text-[12.5px]"
              data-testid="listing-picker-error"
              data-error-code={errorCode}
            >
              {errorCode === "blocked" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <div className="font-medium text-danger">
                      {sourceConfig.blockedTitle}
                    </div>
                    <div className="text-[11.5px] text-ink-2">
                      {sourceConfig.blockedExplanation}
                    </div>
                  </div>
                  <ol className="ml-1 flex flex-col gap-1.5 text-[12px] text-ink-2">
                    <li className="flex gap-2">
                      <span className="font-mono text-[10.5px] tracking-wider text-k-orange pt-0.5">
                        01
                      </span>
                      <span>
                        Open the listing in your browser, right-click each
                        image, choose <em>&ldquo;Copy image address&rdquo;</em>{" "}
                        and paste those direct URLs into the queue.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-mono text-[10.5px] tracking-wider text-k-orange pt-0.5">
                        02
                      </span>
                      <span>
                        Try again later — {sourceConfig.siteLabel}{" "}
                        occasionally lets the request through.
                      </span>
                    </li>
                  </ol>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-size="sm"
                      className="k-btn k-btn--ghost"
                      onClick={() => query.refetch()}
                      data-testid="listing-picker-retry"
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      data-size="sm"
                      className="k-btn k-btn--ghost"
                      onClick={onClose}
                      data-testid="listing-picker-cancel-blocked"
                    >
                      Close & paste URLs directly
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="font-medium text-danger">
                    Couldn&apos;t fetch listing
                  </div>
                  <div className="text-[11.5px] text-ink-3">
                    {(query.error as Error).message}
                  </div>
                  <button
                    type="button"
                    data-size="sm"
                    className="k-btn k-btn--ghost self-start"
                    onClick={() => query.refetch()}
                    data-testid="listing-picker-retry"
                  >
                    Try again
                  </button>
                </>
              )}
            </div>
          ) : query.data && query.data.imageUrls.length === 0 ? (
            <div className="rounded-md border border-line-soft bg-k-bg-2/30 p-4 text-[12.5px] text-ink-3">
              No images found on this listing. Paste a direct image URL
              instead.
            </div>
          ) : query.data ? (
            <div className="flex flex-col gap-3">
              {/* Title + caption */}
              <div className="flex flex-col gap-1">
                {query.data.title ? (
                  <span className="text-[14px] font-medium text-ink truncate" title={query.data.title}>
                    {query.data.title}
                  </span>
                ) : null}
                <div className="flex items-center justify-between gap-2 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                  <span data-testid="listing-picker-summary">
                    We found {query.data.imageUrls.length} image
                    {query.data.imageUrls.length === 1 ? "" : "s"} ·{" "}
                    {selection.size} selected
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={selectAll}
                      disabled={allSelected}
                      className="transition-colors hover:text-ink disabled:opacity-40"
                      data-testid="listing-picker-select-all"
                    >
                      Select all
                    </button>
                    {selection.size > 0 ? (
                      <button
                        type="button"
                        onClick={clearAll}
                        className="transition-colors hover:text-ink"
                        data-testid="listing-picker-clear"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Image grid (4-col, multi-select) */}
              <div
                className="grid grid-cols-4 gap-3"
                data-testid="listing-picker-grid"
              >
                {query.data.imageUrls.map((url, i) => {
                  const sel = selection.has(url);
                  return (
                    <button
                      key={url}
                      type="button"
                      onClick={() => toggle(url)}
                      aria-pressed={sel}
                      className={cn(
                        "group relative overflow-hidden rounded-md border bg-paper transition-all",
                        sel
                          ? "border-k-orange ring-2 ring-k-orange-soft"
                          : "border-line hover:border-line-strong",
                      )}
                      data-testid="listing-picker-image"
                    >
                      <div className="aspect-square w-full bg-k-bg-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Image ${i + 1}`}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      {/* Checkbox overlay */}
                      <span
                        className={cn(
                          "absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded border bg-paper/95",
                          sel
                            ? "border-k-orange text-k-orange-ink bg-k-orange"
                            : "border-line text-transparent",
                        )}
                        aria-hidden
                      >
                        {sel ? (
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            className="text-paper"
                          >
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
                    </button>
                  );
                })}
              </div>

              {query.data.warnings.length > 0 ? (
                <div className="font-mono text-[10.5px] tracking-wider text-ink-3">
                  Parser notes: {query.data.warnings.slice(0, 2).join(" · ")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line bg-paper px-6 py-3.5">
          <button
            type="button"
            data-size="sm"
            className="k-btn k-btn--ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            data-size="sm"
            className="k-btn k-btn--primary"
            disabled={selection.size === 0}
            onClick={submit}
            data-testid="listing-picker-add"
          >
            <Plus className="h-3 w-3" aria-hidden />
            {selection.size > 1
              ? `Add ${selection.size} images`
              : "Add image"}
          </button>
        </div>
      </div>
    </div>
  );
}
