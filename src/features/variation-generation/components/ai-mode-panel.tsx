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
//
// Phase 8 fit-and-finish — `initialProviderId` server-side
// UserSetting.aiMode.defaultImageProvider'dan gelir; AiModeForm initial
// state olarak kullanır.
export function AiModePanel({
  referenceId,
  initialProviderId,
}: {
  referenceId: string;
  initialProviderId?: string;
}) {
  const ref = useReference(referenceId);
  const sourceUrl = ref.data?.reference.asset?.sourceUrl ?? null;
  const urlCheck = useUrlPublicCheck(sourceUrl);
  const jobs = useVariationJobs(referenceId);

  if (ref.isLoading) {
    return <StateMessage tone="neutral" title="Loading reference…" />;
  }
  if (ref.isError || !ref.data) {
    return (
      <StateMessage
        tone="error"
        title="Reference failed to load"
        body={(ref.error as Error | null)?.message ?? "Unexpected error"}
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
              No public URL
            </span>
          ) : urlChecking ? (
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-muted">
              Checking…
            </span>
          ) : urlOk ? (
            <span className="rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
              Reachable
            </span>
          ) : (
            // Task 15 (Parça 3) — status code ve reason artık görünür; sadece
            // title attribute'üne gizlenmiyor. network fail tarzı status undefined
            // ise "—" göster.
            <span className="rounded-md bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              Unreachable · HTTP {urlCheck.data?.status ?? "—"}
              {urlCheck.data?.reason ? ` · ${urlCheck.data.reason}` : ""}
            </span>
          )}
        </div>
        {sourceUrl ? (
          <div className="mt-1 truncate text-xs text-text-muted" title={sourceUrl}>
            {sourceUrl}
          </div>
        ) : (
          // Phase 10 — "No public URL" net açıklama. Pre-Phase mesaj net
          // değildi: kullanıcı niye dead-end'de olduğunu bilmiyordu. Şimdi
          // sebep + iki olası çözüm: (1) Local mode'a geç, (2) Bookmark
          // Inbox üzerinden public URL'li reference oluştur.
          <div className="mt-2 flex flex-col gap-1 text-xs">
            <p className="text-text">
              This reference&apos;s asset has no public source URL — required
              for AI mode image-to-image.
            </p>
            <p className="text-text-muted">Resolutions:</p>
            <ul className="ml-4 list-disc text-text-muted">
              <li>
                Switch to the <strong className="text-text">Local</strong> tab
                above and continue from your local library.
              </li>
              <li>
                Or open{" "}
                <a
                  href="/bookmarks"
                  className="text-accent underline hover:no-underline"
                >
                  Bookmark Inbox
                </a>
                {" "}and add a publicly accessible image, then promote it to
                a reference.
              </li>
            </ul>
          </div>
        )}
      </div>

      <AiModeForm
        referenceId={referenceId}
        disabled={disabled}
        initialProviderId={initialProviderId}
      />

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
