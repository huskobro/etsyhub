"use client";

import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { BookmarkStatus, RiskLevel } from "@prisma/client";
import { BookmarkCard } from "./bookmark-card";

type BookmarkLite = {
  id: string;
  title: string | null;
  sourceUrl: string | null;
  sourcePlatform: string | null;
  status: BookmarkStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  asset: { id: string; storageKey: string; bucket: string } | null;
  productType: { id: string; displayName: string } | null;
  collection: { id: string; name: string } | null;
  tags: { tag: { id: string; name: string; color: string | null } }[];
};

type ListResponse = {
  items: BookmarkLite[];
  nextCursor: string | null;
};

const STATUS_OPTIONS: { value: BookmarkStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tümü" },
  { value: "INBOX", label: "Inbox" },
  { value: "REFERENCED", label: "Referans" },
  { value: "RISKY", label: "Riskli" },
  { value: "ARCHIVED", label: "Arşiv" },
];

type ProductTypeOption = { id: string; displayName: string };

export function BookmarksPage({
  productTypes,
}: {
  productTypes: ProductTypeOption[];
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<BookmarkStatus | "ALL">("INBOX");
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [promoteId, setPromoteId] = useState<string | null>(null);

  const query = useQuery<ListResponse>({
    queryKey: ["bookmarks", status, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "60");
      const res = await fetch(`/api/bookmarks?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Liste alınamadı");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Arşivleme başarısız");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const promoteMutation = useMutation({
    mutationFn: async (args: { bookmarkId: string; productTypeId: string }) => {
      const res = await fetch("/api/references/promote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Referansa taşıma başarısız");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      qc.invalidateQueries({ queryKey: ["references"] });
      setPromoteId(null);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Bookmark Inbox</h1>
          <p className="text-sm text-text-muted">
            URL&apos;den veya görsel yükleyerek fikirlerini buraya topla.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          >
            URL&apos;den ekle
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BookmarkStatus | "ALL")}
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Ara (title/notes/url)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 min-w-60 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text"
        />
      </div>

      {query.isLoading ? (
        <p className="text-sm text-text-muted">Yükleniyor…</p>
      ) : query.error ? (
        <p className="text-sm text-danger">{(query.error as Error).message}</p>
      ) : !query.data || query.data.items.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Henüz bookmark yok. Yukarıdaki &quot;URL&apos;den ekle&quot; ile başla.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {query.data.items.map((bm) => (
            <BookmarkCard
              key={bm.id}
              bookmark={bm}
              onArchive={(id) => archiveMutation.mutate(id)}
              onPromote={(id) => setPromoteId(id)}
            />
          ))}
        </div>
      )}

      {importOpen ? (
        <ImportUrlDialog
          onClose={() => {
            setImportOpen(false);
            qc.invalidateQueries({ queryKey: ["bookmarks"] });
          }}
        />
      ) : null}

      {promoteId ? (
        <PromoteDialog
          bookmarkId={promoteId}
          productTypes={productTypes}
          isPending={promoteMutation.isPending}
          error={
            promoteMutation.isError
              ? (promoteMutation.error as Error).message
              : null
          }
          onSubmit={(productTypeId) =>
            promoteMutation.mutate({ bookmarkId: promoteId, productTypeId })
          }
          onClose={() => setPromoteId(null)}
        />
      ) : null}
    </div>
  );
}

function PromoteDialog({
  bookmarkId,
  productTypes,
  isPending,
  error,
  onSubmit,
  onClose,
}: {
  bookmarkId: string;
  productTypes: ProductTypeOption[];
  isPending: boolean;
  error: string | null;
  onSubmit: (productTypeId: string) => void;
  onClose: () => void;
}) {
  const firstId = productTypes[0]?.id ?? "";
  const [productTypeId, setProductTypeId] = useState(firstId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-popover">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Referansa taşı</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted hover:text-text"
          >
            Kapat
          </button>
        </div>
        <p className="mb-3 text-xs text-text-muted">
          Bookmark {bookmarkId.slice(0, 10)}… için ürün tipi seç:
        </p>
        <select
          value={productTypeId}
          onChange={(e) => setProductTypeId(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text"
        >
          {productTypes.map((pt) => (
            <option key={pt.id} value={pt.id}>
              {pt.displayName}
            </option>
          ))}
        </select>
        {error ? (
          <p className="mt-3 text-xs text-danger">{error}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending || !productTypeId}
            onClick={() => onSubmit(productTypeId)}
            className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground disabled:opacity-50"
          >
            {isPending ? "Taşınıyor…" : "Referansa Taşı"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImportUrlDialog({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const jobStatus = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Job alınamadı");
      return res.json() as Promise<{
        job: {
          id: string;
          status: string;
          progress: number;
          error: string | null;
          metadata: { assetId?: string; title?: string | null } | null;
        };
      }>;
    },
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.job.status;
      return s === "SUCCESS" || s === "FAILED" ? false : 1500;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl: url,
          title: jobStatus.data?.job.metadata?.title ?? undefined,
          assetId: jobStatus.data?.job.metadata?.assetId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Bookmark oluşturulamadı");
      return res.json();
    },
    onSuccess: () => {
      setMessage("Bookmark oluşturuldu.");
      setTimeout(() => onClose(), 800);
    },
  });

  async function onStart() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/assets/import-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl: url }),
      });
      if (!res.ok) {
        throw new Error((await res.json()).error ?? "Job başlatılamadı");
      }
      const data = (await res.json()) as { jobId: string };
      setJobId(data.jobId);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const job = jobStatus.data?.job;
  const success = job?.status === "SUCCESS";
  const failed = job?.status === "FAILED";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4">
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-popover">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">URL&apos;den bookmark ekle</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted hover:text-text"
          >
            Kapat
          </button>
        </div>

        <input
          type="url"
          placeholder="https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={!!jobId}
          className="h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text disabled:opacity-60"
        />

        {job ? (
          <div className="mt-3 flex flex-col gap-2 rounded-md bg-surface-muted p-3 text-xs">
            <span className="text-text-muted">
              Job {job.id.slice(0, 10)}… · {job.status} · {job.progress}%
            </span>
            {failed ? <span className="text-danger">Hata: {job.error ?? "-"}</span> : null}
            {success ? (
              <span className="text-success">
                Asset hazır: {job.metadata?.assetId?.slice(0, 10) ?? "-"}…
              </span>
            ) : null}
          </div>
        ) : null}

        {message ? <p className="mt-3 text-xs text-text-muted">{message}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          {success ? (
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground disabled:opacity-50"
            >
              {createMutation.isPending ? "Oluşturuluyor…" : "Bookmark olarak kaydet"}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !!jobId || !url}
              onClick={onStart}
              className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground disabled:opacity-50"
            >
              {busy ? "Başlatılıyor…" : jobId ? "Devam ediyor…" : "Başlat"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
