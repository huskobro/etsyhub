"use client";

import { useReference } from "../queries/use-reference";
import { useUrlPublicCheck } from "../queries/use-url-public-check";
import { useVariationJobs } from "../queries/use-variation-jobs";
import { AiModeForm } from "./ai-mode-form";
import { VariationResultGrid } from "./variation-result-grid";
import { StateMessage } from "@/components/ui/StateMessage";

// Phase 5 §5.3 — AI mode orchestrator. Cost banner (R15) + URL public check
// (image-to-image kapasitesi için zorunlu, sessiz fallback YOK — R17.1).
// Gap C: truth `reference.asset.sourceUrl` (Reference.imageUrl YOK).
export function AiModePanel({ referenceId }: { referenceId: string }) {
  const ref = useReference(referenceId);
  const sourceUrl = ref.data?.reference.asset?.sourceUrl ?? null;
  const urlCheck = useUrlPublicCheck(sourceUrl);
  const jobs = useVariationJobs(referenceId);

  if (ref.isLoading) {
    return <StateMessage tone="neutral" title="Reference yükleniyor…" />;
  }
  if (ref.isError || !ref.data) {
    return (
      <StateMessage
        tone="error"
        title="Reference yüklenemedi"
        body={(ref.error as Error | null)?.message ?? "Beklenmeyen hata"}
      />
    );
  }

  const reference = ref.data.reference;
  const hasPublicUrl = !!sourceUrl;
  const urlOk = urlCheck.data?.ok === true;
  const urlChecking = urlCheck.isFetching && !urlCheck.data;
  const disabled = !hasPublicUrl || !urlOk;

  // R17.1 — provider yok / URL erişilemiyorsa form kilitli; kullanıcıya
  // sebep açıkça gösterilir, sessiz fallback YOK.
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-text">
        <div className="font-medium">AI üretimi maliyet üretir</div>
        <p className="mt-1 text-text-muted">
          Her görsel ayrı kuyruk işidir; provider&apos;a istek atılır. Üretim
          onay adımıyla başlar; tahmini maliyet sözleşme dışı.
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-text-muted">
            Reference URL durumu (image-to-image için zorunlu)
          </span>
          {!hasPublicUrl ? (
            <span className="rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              URL yok
            </span>
          ) : urlChecking ? (
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-muted">
              Kontrol ediliyor…
            </span>
          ) : urlOk ? (
            <span className="rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
              Erişilebilir
            </span>
          ) : (
            // Task 15 (Parça 3) — status code ve reason artık görünür; sadece
            // title attribute'üne gizlenmiyor. network fail tarzı status undefined
            // ise "—" göster.
            <span className="rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              Erişilemiyor · HTTP {urlCheck.data?.status ?? "—"}
              {urlCheck.data?.reason ? ` · ${urlCheck.data.reason}` : ""}
            </span>
          )}
        </div>
        {sourceUrl ? (
          <div className="mt-1 truncate text-xs text-text-muted" title={sourceUrl}>
            {sourceUrl}
          </div>
        ) : (
          <div className="mt-1 text-xs text-text-muted">
            Bu reference&apos;ın asset&apos;inde public bir kaynak URL yok. AI
            mode için URL gerekli.
          </div>
        )}
      </div>

      <AiModeForm referenceId={referenceId} disabled={disabled} />

      <VariationResultGrid
        referenceId={referenceId}
        designs={jobs.data?.designs ?? []}
      />

      {reference.productType ? (
        <div className="text-xs text-text-muted">
          Ürün tipi: <span className="text-text">{reference.productType.key}</span>
        </div>
      ) : null}
    </div>
  );
}
