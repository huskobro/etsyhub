"use client";

import { useMemo, useState } from "react";
import { useCompetitorsList } from "../queries/use-competitors";
import { useTriggerScanStandalone } from "../mutations/use-trigger-scan-standalone";
import { CompetitorCard } from "./competitor-card";
import { AddCompetitorDialog } from "./add-competitor-dialog";
import { PageShell } from "@/components/ui/PageShell";
import { Toolbar } from "@/components/ui/Toolbar";
import { FilterBar } from "@/components/ui/FilterBar";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { Toast } from "@/components/ui/Toast";

/**
 * CompetitorListPage — T-33 primitive migrasyonu.
 *
 * Sözleşme: docs/design/implementation-notes/competitors-screens.md
 * - PageShell (variant default) tüketildi; title/subtitle/actions/toolbar slot
 * - Toolbar: search input (leading) + 3 filter chip (Tümü / Oto-tarama / Manuel)
 * - Filter davranışı CLIENT-SIDE: hook query parametresi yalnızca q (search);
 *   autoScan filtresi items array'inde uygulanır. Backend sözleşmesi DOKUNULMAZ.
 * - StateMessage: loading / empty / error
 * - AddCompetitorDialog dokunulmaz (CP-5 ConfirmDialog ailesi dışı disclosure)
 *
 * T-38: Toast primitive terfisi tamamlandı — manuel role="status" div yerine
 * `<Toast tone={...} />` tüketilir. kind→tone mapping: success→success,
 * error→error. "Kapat" butonu primitive dışında bir wrapper olarak kalır.
 */
type AutoFilter = "ALL" | "AUTO" | "MANUAL";

const AUTO_FILTERS: { value: AutoFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "AUTO", label: "Auto-scan" },
  { value: "MANUAL", label: "Manual" },
];

export function CompetitorListPage() {
  const [q, setQ] = useState("");
  const [autoFilter, setAutoFilter] = useState<AutoFilter>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [toast, setToast] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  const list = useCompetitorsList({ q });
  const scan = useTriggerScanStandalone();

  function handleScan(id: string) {
    setScanningId(id);
    scan.mutate(id, {
      onSuccess: () => {
        setToast({ kind: "success", message: "Scan queued." });
      },
      onError: (err) => {
        setToast({ kind: "error", message: err.message });
      },
      onSettled: () => setScanningId(null),
    });
  }

  const items = useMemo(() => {
    const rawItems = list.data?.items ?? [];
    if (autoFilter === "ALL") return rawItems;
    if (autoFilter === "AUTO")
      return rawItems.filter((c) => c.autoScanEnabled === true);
    return rawItems.filter((c) => c.autoScanEnabled === false);
  }, [list.data?.items, autoFilter]);

  const toolbar = (
    <Toolbar
      leading={
        <div className="w-60">
          <Input
            type="search"
            placeholder="Search by shop name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search competitors"
          />
        </div>
      }
    >
      <FilterBar>
        {AUTO_FILTERS.map((f) => (
          <Chip
            key={f.value}
            active={autoFilter === f.value}
            onToggle={() => setAutoFilter(f.value)}
          >
            {f.label}
          </Chip>
        ))}
      </FilterBar>
    </Toolbar>
  );

  return (
    <PageShell
      // R11.14.3 — Title/subtitle References shell tarafından üst topbar'da
      // gösteriliyor; PageShell başlığı boş bırakıldı (çift header kaldırma).
      title=""
      subtitle=""
      actions={
        <button
          type="button"
          data-size="sm"
          className="k-btn k-btn--primary"
          onClick={() => setDialogOpen(true)}
        >
          + Add Shop
        </button>
      }
      toolbar={toolbar}
    >
      <div className="flex flex-col gap-4">
        {/* T-38: Toast primitive tüketildi. Kapat aksiyonu primitive scope
            dışında bir trigger; primitive yalnızca tone + message + aria-live
            sözleşmesini taşır. */}
        {toast ? (
          <div className="flex items-start gap-2">
            <Toast
              tone={toast.kind === "success" ? "success" : "error"}
              message={toast.message}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Close
            </button>
          </div>
        ) : null}

        {list.isLoading ? (
          <StateMessage tone="neutral" title="Loading…" />
        ) : list.isError ? (
          <StateMessage
            tone="error"
            title="Couldn't load list"
            body={(list.error as Error).message}
          />
        ) : items.length === 0 ? (
          <StateMessage
            tone="neutral"
            title="No competitor shops yet"
            body={
              autoFilter === "ALL"
                ? 'Use "+ Add Shop" above to track your first store.'
                : "No competitors match this filter."
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((c) => (
              <CompetitorCard
                key={c.id}
                competitor={c}
                scanning={scanningId === c.id}
                onTriggerScan={handleScan}
              />
            ))}
          </div>
        )}

        {dialogOpen ? (
          <AddCompetitorDialog
            onClose={() => setDialogOpen(false)}
            onCreated={() => {
              setToast({
                kind: "success",
                message: "Shop added, first scan queued.",
              });
            }}
          />
        ) : null}
      </div>
    </PageShell>
  );
}
