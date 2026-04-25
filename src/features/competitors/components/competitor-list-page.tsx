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
 * GEÇİCİ: Toast primitive 3+ ekran tüketimi olunca terfi edilir. Mevcut inline
 * role="status" div KORUNUR, görünürlük zayıflamasın diye konum + tone (success/
 * error renkli border + bg) aynen tutulur.
 * carry-forward: docs/design/implementation-notes/competitors-screens.md
 */
type AutoFilter = "ALL" | "AUTO" | "MANUAL";

const AUTO_FILTERS: { value: AutoFilter; label: string }[] = [
  { value: "ALL", label: "Tümü" },
  { value: "AUTO", label: "Oto-tarama" },
  { value: "MANUAL", label: "Manuel" },
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
        setToast({ kind: "success", message: "Tarama kuyruğa alındı." });
      },
      onError: (err) => {
        setToast({ kind: "error", message: err.message });
      },
      onSettled: () => setScanningId(null),
    });
  }

  const rawItems = list.data?.items ?? [];
  const items = useMemo(() => {
    if (autoFilter === "ALL") return rawItems;
    if (autoFilter === "AUTO")
      return rawItems.filter((c) => c.autoScanEnabled === true);
    return rawItems.filter((c) => c.autoScanEnabled === false);
  }, [rawItems, autoFilter]);

  const toolbar = (
    <Toolbar
      leading={
        <div className="w-60">
          <Input
            type="search"
            placeholder="Mağaza adına göre ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Rakip arama"
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
      title="Rakipler"
      subtitle="Etsy/Amazon mağazalarını takibe al, yeni listingleri analiz et."
      actions={
        <Button variant="primary" onClick={() => setDialogOpen(true)}>
          + Rakip Ekle
        </Button>
      }
      toolbar={toolbar}
    >
      <div className="flex flex-col gap-4">
        {/* GEÇİCİ: Toast primitive 3+ ekran tüketimi olunca terfi edilir.
            carry-forward: docs/design/implementation-notes/competitors-screens.md */}
        {toast ? (
          <div
            role="status"
            className={
              toast.kind === "success"
                ? "rounded-md border border-border bg-success-soft px-3 py-2 text-xs text-success"
                : "rounded-md border border-border bg-danger-soft px-3 py-2 text-xs text-danger"
            }
          >
            {toast.message}
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Kapat
            </button>
          </div>
        ) : null}

        {list.isLoading ? (
          <StateMessage tone="neutral" title="Yükleniyor…" />
        ) : list.isError ? (
          <StateMessage
            tone="error"
            title="Liste yüklenemedi"
            body={(list.error as Error).message}
          />
        ) : items.length === 0 ? (
          <StateMessage
            tone="neutral"
            title="Henüz rakip mağaza yok"
            body={
              autoFilter === "ALL"
                ? 'Yukarıdaki "+ Rakip Ekle" ile ilk mağazayı takibe al.'
                : "Bu filtreye uyan rakip bulunamadı."
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
                message: "Rakip eklendi, ilk tarama kuyruğa alındı.",
              });
            }}
          />
        ) : null}
      </div>
    </PageShell>
  );
}
