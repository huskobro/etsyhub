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
        <div className="font-medium">AI generation incurs cost</div>
        <p className="mt-1 text-text-muted">
          Each image is a separate queue job; the provider is hit per request.
          Generation starts with a confirm step; the cost estimate is
          best-effort, not contractual.
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-text-muted">
            Reference URL status (required for image-to-image)
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
          // Pass 34 — "URL yok" durumu daha açık. Pre-Pass 34 mesaj net
          // değildi: kullanıcı niye dead-end'de olduğunu ve ne yapacağını
          // bilmiyordu. Şimdi sebep + iki olası çözüm: (1) Local mode'a geç
          // (lokal kütüphaneden seç), (2) Public URL'li yeni reference yarat
          // (Bookmark Inbox üzerinden).
          <div className="mt-2 flex flex-col gap-1 text-xs">
            <p className="text-text">
              Bu reference&apos;ın asset&apos;inde public bir kaynak URL yok —
              AI mode image-to-image için zorunlu.
            </p>
            <p className="text-text-muted">
              Çözümler:
            </p>
            <ul className="ml-4 list-disc text-text-muted">
              <li>
                Yukarıdaki <strong className="text-text">Local</strong> tab&apos;ına
                geç — lokal kütüphanen üzerinden devam et.
              </li>
              <li>
                Ya da{" "}
                <a
                  href="/bookmarks"
                  className="text-accent underline hover:no-underline"
                >
                  Bookmark Inbox
                </a>
                &apos;tan public URL&apos;li bir görsel ekleyip referansa taşı.
              </li>
            </ul>
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
