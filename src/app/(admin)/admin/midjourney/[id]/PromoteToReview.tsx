"use client";

// Pass 55 — MJ output'larını Review queue'ya promote eden inline panel.
//
// UX:
//   • Detail sayfada outputs grid'in üstünde küçük bir panel.
//   • Her thumb için checkbox; üstte "Hepsini seç" toggle'ı.
//   • Reference + ProductType select (mevcut kullanıcının reference'ları).
//   • "Review'a gönder" butonu → POST /promote → router.refresh.
//   • Zaten promote edilmiş (generatedDesignId dolu) asset'ler "✓ Review'da"
//     etiketi + checkbox disabled.
//
// MJ test render formundan gelen job'lar genelde reference'sız;
// operatör burada hangi reference altına bağlanacağını seçer.

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AssetItem = {
  midjourneyAssetId: string;
  gridIndex: number;
  alreadyPromoted: boolean;
};

type ReferenceOption = { id: string; productTypeId: string; label: string };
type ProductTypeOption = { id: string; label: string };

type PromoteToReviewProps = {
  midjourneyJobId: string;
  /** Detail page query'sinden gelen 4 asset; alreadyPromoted = generatedDesignId !== null */
  assets: AssetItem[];
  /** MJ job'un kendi referenceId'si — varsa default olarak seçili gelir. */
  defaultReferenceId?: string | null;
  /** MJ job'un productTypeId'si — varsa default olarak seçili gelir. */
  defaultProductTypeId?: string | null;
};

export function PromoteToReview({
  midjourneyJobId,
  assets,
  defaultReferenceId,
  defaultProductTypeId,
}: PromoteToReviewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Promote edilebilir (henüz promote olmamış) asset id seti.
  const promotable = useMemo(
    () => assets.filter((a) => !a.alreadyPromoted),
    [assets],
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(promotable.map((a) => a.midjourneyAssetId)),
  );

  const [refOptions, setRefOptions] = useState<ReferenceOption[] | null>(null);
  const [ptOptions, setPtOptions] = useState<ProductTypeOption[] | null>(null);
  const [referenceId, setReferenceId] = useState<string>(
    defaultReferenceId ?? "",
  );
  const [productTypeId, setProductTypeId] = useState<string>(
    defaultProductTypeId ?? "",
  );

  // Lookup'ları lazy fetch — panel ilk render'da.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [refRes, ptRes] = await Promise.all([
          fetch("/api/references?limit=50"),
          fetch("/api/admin/product-types"),
        ]);
        const refJson: unknown = await refRes.json().catch(() => null);
        const ptJson: unknown = await ptRes.json().catch(() => null);
        if (cancelled) return;

        // Reference list shape: { items: [{ id, productTypeId, productType: { label } }] } veya array
        const refItems = extractList(refJson);
        const refMapped: ReferenceOption[] = refItems
          .map((r) => {
            const pt = r["productType"] as
              | { displayName?: string; key?: string }
              | undefined;
            const ptLabel = pt?.displayName ?? pt?.key ?? "?";
            const note =
              (r["notes"] as string | undefined)?.slice(0, 30) || "—";
            return {
              id: String(r["id"] ?? ""),
              productTypeId: String(r["productTypeId"] ?? ""),
              label: `${ptLabel} · ${note}`,
            };
          })
          .filter((r) => r.id);
        setRefOptions(refMapped);

        const ptItems = extractList(ptJson);
        const ptMapped: ProductTypeOption[] = ptItems
          .map((p) => ({
            id: String(p["id"] ?? ""),
            label: String(
              p["displayName"] ??
                p["label"] ??
                p["key"] ??
                p["id"] ??
                "?",
            ),
          }))
          .filter((p) => p.id);
        setPtOptions(ptMapped);

        // Default'lar yoksa ilk option'a düş.
        if (!referenceId && refMapped.length > 0) {
          setReferenceId(refMapped[0]!.id);
          if (!productTypeId) setProductTypeId(refMapped[0]!.productTypeId);
        }
        if (!productTypeId && ptMapped.length > 0 && !refMapped.length) {
          setProductTypeId(ptMapped[0]!.id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            `Reference/ProductType yüklenemedi: ${err instanceof Error ? err.message : "?"}`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selectedIds.size === promotable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(promotable.map((a) => a.midjourneyAssetId)));
    }
  }

  // Reference seçildiğinde productType auto-fill (Reference.productTypeId).
  function handleRefChange(newRefId: string) {
    setReferenceId(newRefId);
    const found = refOptions?.find((r) => r.id === newRefId);
    if (found) setProductTypeId(found.productTypeId);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (selectedIds.size === 0) {
      setError("En az 1 asset seç");
      return;
    }
    if (!referenceId) {
      setError("Reference seç");
      return;
    }
    if (!productTypeId) {
      setError("ProductType seç");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/midjourney/${midjourneyJobId}/promote`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              midjourneyAssetIds: Array.from(selectedIds),
              referenceId,
              productTypeId,
            }),
          },
        );
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          if (
            json &&
            typeof json === "object" &&
            "error" in json &&
            typeof (json as { error: unknown }).error === "string"
          ) {
            msg = (json as { error: string }).error;
          }
          setError(msg);
          return;
        }
        const data = json as {
          createdCount: number;
          alreadyPromotedCount: number;
        };
        setSuccess(
          `✓ ${data.createdCount} yeni Review (${data.alreadyPromotedCount} mevcut)`,
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bilinmeyen hata");
      }
    });
  }

  const allPromoted = promotable.length === 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
      data-testid="mj-promote-to-review"
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Review&apos;a gönder</div>
        {allPromoted ? (
          <span
            className="rounded bg-success-soft px-2 py-0.5 text-xs text-success"
            data-testid="mj-promote-all-done"
          >
            ✓ Tüm asset&apos;ler Review&apos;da
          </span>
        ) : null}
      </div>

      {!allPromoted ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-md border border-border bg-bg px-2 py-1 text-text-muted hover:text-text"
              disabled={pending}
            >
              {selectedIds.size === promotable.length
                ? "Hiçbirini seçme"
                : "Hepsini seç"}
            </button>
            <span className="text-text-muted">
              {selectedIds.size}/{promotable.length} seçili
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {assets.map((a) => (
              <label
                key={a.midjourneyAssetId}
                className={
                  "flex items-center gap-1 text-xs " +
                  (a.alreadyPromoted
                    ? "text-success"
                    : "cursor-pointer text-text-muted")
                }
              >
                <input
                  type="checkbox"
                  checked={
                    a.alreadyPromoted ||
                    selectedIds.has(a.midjourneyAssetId)
                  }
                  disabled={a.alreadyPromoted || pending}
                  onChange={() => toggle(a.midjourneyAssetId)}
                />
                Grid {a.gridIndex}
                {a.alreadyPromoted ? " ✓" : ""}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-text-muted">Reference</span>
              <select
                value={referenceId}
                onChange={(e) => handleRefChange(e.target.value)}
                disabled={pending || !refOptions}
                className="rounded-md border border-border bg-bg px-2 py-1 text-xs disabled:opacity-50"
                data-testid="mj-promote-ref"
              >
                {!refOptions ? (
                  <option value="">Yükleniyor…</option>
                ) : refOptions.length === 0 ? (
                  <option value="">Reference yok — önce ekle</option>
                ) : (
                  refOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-text-muted">ProductType</span>
              <select
                value={productTypeId}
                onChange={(e) => setProductTypeId(e.target.value)}
                disabled={pending || !ptOptions}
                className="rounded-md border border-border bg-bg px-2 py-1 text-xs disabled:opacity-50"
                data-testid="mj-promote-pt"
              >
                {!ptOptions ? (
                  <option value="">Yükleniyor…</option>
                ) : (
                  ptOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="submit"
              disabled={pending || selectedIds.size === 0 || !referenceId}
              className="rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-40"
              data-testid="mj-promote-submit"
            >
              {pending ? "Gönderiliyor…" : "→ Review'a gönder"}
            </button>
          </div>
        </>
      ) : null}

      {error ? (
        <p className="text-xs text-danger" data-testid="mj-promote-error">
          ⚠ {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="text-xs text-success"
          data-testid="mj-promote-success"
        >
          {success}
        </p>
      ) : null}
    </form>
  );
}

function extractList(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object" && "items" in json) {
    const items = (json as { items: unknown }).items;
    if (Array.isArray(items)) return items as Record<string, unknown>[];
  }
  if (json && typeof json === "object" && "references" in json) {
    const refs = (json as { references: unknown }).references;
    if (Array.isArray(refs)) return refs as Record<string, unknown>[];
  }
  if (json && typeof json === "object" && "data" in json) {
    const d = (json as { data: unknown }).data;
    if (Array.isArray(d)) return d as Record<string, unknown>[];
  }
  return [];
}
