"use client";

// Phase 7 Task 36 — ExportButton 4-state machine + activeExport polling.
//
// Spec Section 6.6 (activeExport sözleşmesi) + Section 3.2 (üst bar "İndir
// (ZIP)" buton state'leri):
//
//   State 1 — null (idle)
//     UI: "İndir (ZIP)" enabled (itemCount>0). itemCount===0 → disabled +
//     tooltip "Set'te en az 1 varyant olmalı".
//     Click → POST /api/selection/sets/{setId}/export (Task 22, 202 + jobId).
//
//   State 2 — queued / running (preparing)
//     UI: "Export hazırlanıyor..." + spinner + disabled.
//     Polling: 3sn refetchInterval ile set query invalidate (Task 29 emsal).
//
//   State 3 — completed + downloadUrl + expiresAt > now
//     UI: native <a href download> "İndir" link, primary tonu (bg-accent +
//     text-accent-foreground). Next.js <Link> route navigation içindir;
//     direct file download için native <a> doğru.
//
//   State 4 — completed + expiresAt geçmiş
//     UI: "Yeniden hazırla" enabled buton + tooltip; click yeni POST tetikler.
//     Sebep: signed URL TTL (S3 / Cloudflare R2) — link önce tarayıcıda
//     kullanılmadıysa süresi dolabilir.
//
//   State 5 — failed
//     UI: "Tekrar dene" enabled buton + danger tonu + failedReason tooltip;
//     click yeni POST tetikler.
//
// Polling stratejisi:
//   `useQuery + refetchInterval` (Phase 6 emsali HeavyActionButton — Task
//   29). Query key ayrı (`["selection","export-poll",setId]`) — set query
//   key ile çakışmaz; queryFn yalnız invalidate tetikler, gerçek veri set
//   query'sinden gelir. Task 39 SSE entegrasyonu sonrası bu polling
//   kaldırılabilir.
//
// Inline error 5sn fade:
//   onError → setErrorMessage + setTimeout(setNull, 5000). Test 5sn timer
//   davranışı pragmatik atlanır (varlık + içerik kontrolü yeterli);
//   componentWillUnmount lifecycle riski yok (timeout id ref tutulmuyor —
//   pragmatik trade-off; Phase 6 emsallerinde de aynı patern).

import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { selectionSetQueryKey } from "../queries";
import type { ActiveExportView } from "../queries";
import { Button } from "@/components/ui/Button";
import { Download, AlertTriangle } from "lucide-react";
import { useExportCompletionToast } from "../hooks/useExportCompletionToast";

export type ExportButtonProps = {
  setId: string;
  /** `set.items.length` — itemCount===0 idle state'te buton disabled. */
  itemCount: number;
  /**
   * `set.activeExport` route payload (Task 14). null/queued/running/completed/
   * failed durumlarına göre 5 farklı render path.
   */
  activeExport: ActiveExportView;
};

export function ExportButton({
  setId,
  itemCount,
  activeExport,
}: ExportButtonProps) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isProcessing =
    activeExport?.status === "queued" || activeExport?.status === "running";

  // Task 39 — export completion/failure → page-level Toast (fail-safe;
  // 4-state inline UI ana yüzey, toast sayfa terk durumunda son state
  // bildirimi).
  useExportCompletionToast(activeExport);

  // Polling — queued/running iken 3sn aralıkla set query refetch.
  // `enabled: isProcessing` ile job bitince polling durur (completed/failed/
  // null → refetchInterval false). Query key ayrı; set query'siyle çakışmaz.
  //
  // Phase 7 v1.0.1 polish (2026-05-01 — manuel QA bulgusu
  // `selection-studio-export-polling-invalidate`): `invalidateQueries`
  // yerine `refetchQueries` kullanılır. Sebep: QueryProvider global
  // `staleTime: 30_000` koyduğu için `invalidateQueries` mark-stale yapar
  // ama refetch'i bir sonraki mount/focus event'ine erteleyebilir.
  // Component zaten mount + `refetchOnWindowFocus: false` → fiili refetch
  // gecikmeli geliyordu (manuel QA'da 10+ sn gözlendi). `refetchQueries`
  // staleness'tan bağımsız force refetch tetikler.
  useQuery({
    queryKey: ["selection", "export-poll", setId],
    queryFn: async () => {
      await queryClient.refetchQueries({
        queryKey: selectionSetQueryKey(setId),
      });
      return Date.now();
    },
    enabled: isProcessing,
    refetchInterval: isProcessing ? 3000 : false,
    staleTime: 0,
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/selection/sets/${setId}/export`, {
        method: "POST",
      });
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: string };
          detail = typeof body.error === "string" ? body.error : "";
        } catch {
          // ignore parse hatası
        }
        throw new Error(detail ? detail : `İşlem başarısız (${res.status})`);
      }
      return (await res.json()) as { jobId: string };
    },
    onSuccess: () => {
      setErrorMessage(null);
      // Server activeExport'u yansıtması için set query invalidate.
      queryClient.invalidateQueries({
        queryKey: selectionSetQueryKey(setId),
      });
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
      // 5sn fade — pragmatik (Phase 6 paterni).
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const startExport = () => {
    if (itemCount === 0) return;
    setErrorMessage(null);
    exportMutation.mutate();
  };

  // ────────────────────────────────────────────────────────────
  // State 1 — null (idle)
  // ────────────────────────────────────────────────────────────
  if (!activeExport) {
    return (
      <ExportButtonShell errorMessage={errorMessage}>
        <Button
          variant="secondary"
          icon={<Download className="h-4 w-4" aria-hidden />}
          onClick={startExport}
          disabled={itemCount === 0 || exportMutation.isPending}
          title={
            itemCount === 0 ? "Set'te en az 1 varyant olmalı" : undefined
          }
          loading={exportMutation.isPending}
        >
          {exportMutation.isPending ? "Hazırlanıyor..." : "İndir (ZIP)"}
        </Button>
      </ExportButtonShell>
    );
  }

  // ────────────────────────────────────────────────────────────
  // State 2 — queued / running (preparing) — polling aktif
  // ────────────────────────────────────────────────────────────
  if (isProcessing) {
    return (
      <ExportButtonShell errorMessage={errorMessage}>
        <Button variant="secondary" disabled>
          <span
            className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-text-muted border-t-transparent"
            aria-label="Yükleniyor"
          />
          Export hazırlanıyor...
        </Button>
      </ExportButtonShell>
    );
  }

  // ────────────────────────────────────────────────────────────
  // State 3 — completed + URL geçerli (ready-to-download)
  // ────────────────────────────────────────────────────────────
  const isCompletedFresh =
    activeExport.status === "completed" &&
    !!activeExport.downloadUrl &&
    !!activeExport.expiresAt &&
    new Date(activeExport.expiresAt).getTime() > Date.now();

  if (isCompletedFresh) {
    return (
      <ExportButtonShell errorMessage={errorMessage}>
        <a
          href={activeExport.downloadUrl}
          download
          className="inline-flex h-control-md items-center gap-2 rounded-md border border-accent bg-accent px-3.5 text-base font-medium text-accent-foreground transition-colors duration-fast ease-out hover:bg-accent-hover hover:border-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Download className="h-4 w-4" aria-hidden />
          İndir
        </a>
      </ExportButtonShell>
    );
  }

  // ────────────────────────────────────────────────────────────
  // State 4 — completed + URL süresi dolmuş (expired) → yeniden hazırla
  // ────────────────────────────────────────────────────────────
  if (activeExport.status === "completed") {
    return (
      <ExportButtonShell errorMessage={errorMessage}>
        <Button
          variant="secondary"
          icon={<Download className="h-4 w-4" aria-hidden />}
          onClick={startExport}
          disabled={exportMutation.isPending}
          title="Önceki indirme süresi doldu, yeniden hazırla"
          loading={exportMutation.isPending}
        >
          {exportMutation.isPending ? "Hazırlanıyor..." : "Yeniden hazırla"}
        </Button>
      </ExportButtonShell>
    );
  }

  // ────────────────────────────────────────────────────────────
  // State 5 — failed → tekrar dene + danger tonu + failedReason tooltip
  // ────────────────────────────────────────────────────────────
  return (
    <ExportButtonShell errorMessage={errorMessage}>
      <Button
        variant="destructive"
        icon={<AlertTriangle className="h-4 w-4" aria-hidden />}
        onClick={startExport}
        disabled={exportMutation.isPending}
        title={activeExport.failedReason ?? "Export başarısız oldu"}
        loading={exportMutation.isPending}
      >
        {exportMutation.isPending ? "Hazırlanıyor..." : "Tekrar dene"}
      </Button>
    </ExportButtonShell>
  );
}

/**
 * Shell wrapper — buton + altında inline error mesajı (5sn fade).
 * Phase 7 paterni: page-level Toast yerine kontekstüel inline alert
 * (HeavyActionButton/QuickActions emsali).
 */
function ExportButtonShell({
  children,
  errorMessage,
}: {
  children: React.ReactNode;
  errorMessage: string | null;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      {children}
      {errorMessage ? (
        <p className="text-xs text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
