"use client";

// Pass 90 — Kept Workspace: Handoff Panel.
//
// Sticky bottom bar — seçili asset varsa görünür. İçerik:
//   - "{N} asset seçili"
//   - SelectionSet adı input (default: "Kept yyyy-mm-dd HH:mm")
//   - Reference picker (reuse Pass 58)
//   - ProductType select
//   - "Selection Set'e gönder" buton
//
// Submit → POST /api/admin/midjourney/kept/handoff → success bannerda
// link ile yeni set'e geç.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReferencePicker } from "../[id]/ReferencePicker";

type ProductTypeOption = { id: string; label: string };

type HandoffResult = {
  selectionSetId: string;
  selectionSetName: string;
  promotedCreated: number;
  promotedAlready: number;
  itemsAdded: number;
  itemsAlreadyInSet: number;
};

type HandoffPanelProps = {
  selectedIds: string[];
  /** Seçimi temizle (handoff başarılı sonrası). */
  onClearSelection: () => void;
};

export function HandoffPanel({
  selectedIds,
  onClearSelection,
}: HandoffPanelProps) {
  const router = useRouter();
  const [referenceId, setReferenceId] = useState("");
  const [productTypeId, setProductTypeId] = useState("");
  const [ptOptions, setPtOptions] = useState<ProductTypeOption[] | null>(null);
  const [setName, setSetName] = useState(() => defaultSetName());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HandoffResult | null>(null);

  // ProductType lookup (PromoteToReview pattern)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/product-types");
        const json: unknown = await res.json().catch(() => null);
        if (cancelled) return;
        const items = extractList(json);
        const mapped: ProductTypeOption[] = items
          .map((p) => ({
            id: String(p["id"] ?? ""),
            label: String(
              p["displayName"] ?? p["label"] ?? p["key"] ?? p["id"] ?? "?",
            ),
          }))
          .filter((p) => p.id);
        setPtOptions(mapped);
        if (!productTypeId && mapped.length > 0) {
          setProductTypeId(mapped[0]!.id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            `ProductType yüklenemedi: ${err instanceof Error ? err.message : "?"}`,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (selectedIds.length === 0) return;
    if (!referenceId) {
      setError("Reference seç");
      return;
    }
    if (!productTypeId) {
      setError("ProductType seç");
      return;
    }
    if (setName.trim().length === 0) {
      setError("Set adı boş olamaz");
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/midjourney/kept/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          midjourneyAssetIds: selectedIds,
          referenceId,
          productTypeId,
          selectionSetName: setName.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as HandoffResult;
      setResult(data);
      onClearSelection();
      // Yeni name oluştur (kullanıcı arka arkaya handoff yapabilsin)
      setSetName(defaultSetName());
      // Sayfa data'sını refresh et (alreadyPromoted badge'leri güncellensin)
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "fail");
    } finally {
      setSubmitting(false);
    }
  }

  // Hiç seçim yok ve önceki sonuç da yoksa panel görünmez
  if (selectedIds.length === 0 && !result) return null;

  return (
    <div
      className="sticky bottom-0 left-0 right-0 z-10 flex flex-col gap-2 border-t border-border bg-surface p-3 shadow-card"
      data-testid="mj-kept-handoff-panel"
    >
      {result ? (
        <div
          className="flex items-center justify-between gap-3 rounded-md border border-success bg-success-soft p-2 text-sm"
          data-testid="mj-kept-handoff-success"
        >
          <div>
            <span className="font-semibold text-success">✓ Handoff tamam.</span>{" "}
            <span className="text-text">
              SelectionSet <strong>{result.selectionSetName}</strong> oluştu.
            </span>{" "}
            <span className="text-text-muted">
              ({result.itemsAdded} item eklendi
              {result.itemsAlreadyInSet > 0
                ? `, ${result.itemsAlreadyInSet} duplicate skip`
                : ""}
              ; {result.promotedCreated} yeni promote
              {result.promotedAlready > 0
                ? `, ${result.promotedAlready} mevcut`
                : ""}
              )
            </span>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/selection/sets/${result.selectionSetId}`}
              className="rounded border border-success bg-bg px-2 py-1 text-xs font-medium text-success hover:bg-success hover:text-on-accent"
            >
              SelectionSet&apos;i aç →
            </Link>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="rounded border border-border bg-bg px-2 py-1 text-xs text-text-muted hover:border-border-strong"
            >
              Kapat
            </button>
          </div>
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-0.5">
            <span
              className="text-xs font-semibold text-text"
              data-testid="mj-kept-selected-count"
            >
              {selectedIds.length} asset seçili
            </span>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-text-muted underline hover:text-text"
            >
              Seçimi temizle
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">SelectionSet adı</label>
            <input
              type="text"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
              disabled={submitting}
              className="w-64 rounded-md border border-border bg-bg px-2 py-1 text-xs disabled:opacity-50"
              data-testid="mj-kept-set-name"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Reference</label>
            <div className="w-64">
              <ReferencePicker
                value={referenceId}
                onChange={(id, opt) => {
                  setReferenceId(id);
                  // Auto-fill productType (PromoteToReview pattern)
                  if (opt && opt.productTypeId) {
                    setProductTypeId(opt.productTypeId);
                  }
                }}
                disabled={submitting}
                testIdPrefix="mj-kept-ref"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">ProductType</label>
            <select
              value={productTypeId}
              onChange={(e) => setProductTypeId(e.target.value)}
              disabled={submitting || !ptOptions}
              className="w-48 rounded-md border border-border bg-bg px-2 py-1 text-xs disabled:opacity-50"
              data-testid="mj-kept-product-type"
            >
              {!ptOptions ? <option>Yükleniyor…</option> : null}
              {ptOptions?.length === 0 ? (
                <option>ProductType yok</option>
              ) : null}
              {ptOptions?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={submitting || selectedIds.length === 0}
            className="rounded-md border border-accent bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-40"
            data-testid="mj-kept-handoff-submit"
          >
            {submitting
              ? "Gönderiliyor…"
              : `→ SelectionSet'e gönder (${selectedIds.length})`}
          </button>

          {error ? (
            <span
              className="text-xs text-danger"
              data-testid="mj-kept-handoff-error"
            >
              ⚠ {error}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function defaultSetName(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return `Kept ${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function extractList(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    if ("items" in json) {
      const items = (json as { items: unknown }).items;
      if (Array.isArray(items)) return items as Record<string, unknown>[];
    }
  }
  return [];
}
