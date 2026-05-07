// Pass 52 — Admin Midjourney job detail.
//
// Pass 51'de tablo level "Tamamlandı" görünüyor + asset count görünüyor,
// ama operatör hangi 4 görselin üretildiğini, hangi prompt string'in
// gerçekten gönderildiğini, hangi flag'lerle bridge'in çalıştığını
// ve hata durumunda hangi blockReason/lastMessage'ı gördüğünü
// inceleyemiyordu. Bu sayfa o gözlemi tek yerde toplar.
//
// İçerik:
//   • Başlık + state badge + lifecycle timeline (enqueued/submitted/
//     completed veya failed)
//   • Promptu + flag breakdown (mjMetadata.promptString)
//   • bridgeJobId / mjJobId / referans IDler (admin teşhis)
//   • blockReason / failedReason / lastMessage
//   • 4 grid thumbnail (lazy signed URL)
//   • Geri dönüş linki
//
// Build now scope: read-only. Retry/Cancel butonları strong-follow-up.

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { AssetThumb } from "../AssetThumb";

const STATE_LABELS: Record<string, string> = {
  QUEUED: "Sırada",
  OPENING_BROWSER: "Browser açılıyor",
  AWAITING_LOGIN: "Login bekleniyor",
  AWAITING_CHALLENGE: "Doğrulama bekleniyor",
  SUBMITTING_PROMPT: "Prompt gönderiliyor",
  WAITING_FOR_RENDER: "Render bekleniyor",
  COLLECTING_OUTPUTS: "Çıktılar toplanıyor",
  DOWNLOADING: "İndiriliyor",
  IMPORTING: "İçeri alınıyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
  CANCELLED: "İptal",
};

const BLOCK_REASON_LABELS: Record<string, string> = {
  "challenge-required": "Doğrulama gerekli (Cloudflare/captcha)",
  "login-required": "Login gerekli",
  "render-timeout": "Render zaman aşımı",
  "browser-crashed": "Browser çöktü",
  "selector-mismatch": "MJ web değişmiş — bridge update gerek",
  "rate-limited": "Rate limit",
  "user-cancelled": "Kullanıcı iptal etti",
  "internal-error": "İç hata",
};

function stateTone(state: string): BadgeTone {
  if (state === "COMPLETED") return "success";
  if (state === "FAILED" || state === "CANCELLED") return "danger";
  if (state === "AWAITING_LOGIN" || state === "AWAITING_CHALLENGE") return "warning";
  if (state === "QUEUED") return "neutral";
  return "accent";
}

type Props = { params: { id: string } };

export default async function AdminMidjourneyJobDetailPage({ params }: Props) {
  const job = await db.midjourneyJob.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { email: true } },
      generatedAssets: {
        orderBy: { gridIndex: "asc" },
        select: {
          id: true,
          gridIndex: true,
          variantKind: true,
          assetId: true,
          mjImageUrl: true,
          asset: {
            select: { mimeType: true, sizeBytes: true, storageKey: true },
          },
        },
      },
      job: {
        select: {
          status: true,
          bullJobId: true,
          startedAt: true,
          finishedAt: true,
          error: true,
        },
      },
    },
  });

  if (!job) notFound();

  // Promptu satırlardan ayır: "<prompt> --ar 1:1 --v 7" → prompt + flags.
  const promptString =
    (job.mjMetadata as { promptString?: string } | null)?.promptString ??
    job.prompt;
  const promptCore = promptString.split(/\s--/)[0] ?? promptString;
  const flags = promptString
    .split(/(\s--)/)
    .reduce<string[]>((acc, p, i, arr) => {
      if (p === " --" && arr[i + 1]) acc.push(`--${arr[i + 1]!.trim()}`);
      return acc;
    }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/admin/midjourney"
          className="text-xs text-text-muted hover:text-text"
        >
          ← Midjourney köprüsü
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">MJ Job</h1>
          <Badge tone={stateTone(job.state)}>
            {STATE_LABELS[job.state] ?? job.state}
          </Badge>
          {job.blockReason ? (
            <Badge tone="warning">
              {BLOCK_REASON_LABELS[job.blockReason] ?? job.blockReason}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Kullanıcı:{" "}
          <span className="font-mono">{job.user?.email ?? "—"}</span> · ID:{" "}
          <span className="font-mono">{job.id}</span>
        </p>
      </div>

      <section
        className="grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-2"
        data-testid="mj-job-meta"
      >
        <div>
          <div className="text-xs text-text-muted">Prompt (kullanıcı)</div>
          <div className="text-sm">{promptCore.trim()}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Bridge prompt string</div>
          <div className="font-mono text-xs">{promptString}</div>
          {flags.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {flags.map((f) => (
                <span
                  key={f}
                  className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text-muted"
                >
                  {f}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <div className="text-xs text-text-muted">bridgeJobId</div>
          <div className="font-mono text-xs">{job.bridgeJobId}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">mjJobId (UUID)</div>
          <div className="font-mono text-xs">{job.mjJobId ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Lifecycle</div>
          <ul className="mt-1 space-y-0.5 text-xs">
            <li>
              <span className="text-text-muted">Sıraya alındı:</span>{" "}
              {job.enqueuedAt.toLocaleString("tr-TR")}
            </li>
            {job.submittedAt ? (
              <li>
                <span className="text-text-muted">Submit:</span>{" "}
                {job.submittedAt.toLocaleString("tr-TR")}
              </li>
            ) : null}
            {job.completedAt ? (
              <li>
                <span className="text-text-muted">Tamamlandı:</span>{" "}
                {job.completedAt.toLocaleString("tr-TR")}{" "}
                <span className="text-text-muted">
                  ({Math.round(
                    (job.completedAt.getTime() - job.enqueuedAt.getTime()) /
                      1000,
                  )}
                  s)
                </span>
              </li>
            ) : null}
            {job.failedAt ? (
              <li>
                <span className="text-text-muted">Başarısız:</span>{" "}
                {job.failedAt.toLocaleString("tr-TR")}
              </li>
            ) : null}
          </ul>
        </div>
        <div>
          <div className="text-xs text-text-muted">EtsyHub Job</div>
          <div className="text-xs">
            Status:{" "}
            <span className="font-mono">{job.job?.status ?? "—"}</span>
            {" · "}
            BullMQ ID:{" "}
            <span className="font-mono">{job.job?.bullJobId ?? "—"}</span>
          </div>
          {job.job?.error ? (
            <div className="mt-1 truncate font-mono text-xs text-danger" title={job.job.error}>
              {job.job.error}
            </div>
          ) : null}
        </div>
      </section>

      {job.failedReason ? (
        <section
          className="rounded-md border border-danger bg-danger-soft p-4 text-sm text-danger-text"
          data-testid="mj-job-failed-reason"
        >
          <div className="font-semibold">Başarısızlık nedeni</div>
          <div className="mt-1 whitespace-pre-wrap font-mono text-xs">
            {job.failedReason}
          </div>
        </section>
      ) : null}

      <section data-testid="mj-job-outputs">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Üretilen görseller ({job.generatedAssets.length})
          </h2>
          {job.mjJobId ? (
            <a
              href={`https://www.midjourney.com/jobs/${job.mjJobId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-text-muted hover:text-text"
            >
              MJ web&apos;de aç ↗
            </a>
          ) : null}
        </div>
        {job.generatedAssets.length === 0 ? (
          <div className="rounded-md border border-border bg-surface p-4 text-sm text-text-muted">
            {job.state === "COMPLETED"
              ? "Bu job tamamlanmış görünüyor ama henüz asset bulunamadı (ingest hatası olabilir)."
              : "Henüz görsel üretilmedi. Pipeline tamamlanınca burada 4 grid görüntülenir."}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {job.generatedAssets.map((a) => (
              <div key={a.id} className="flex flex-col gap-1">
                <AssetThumb
                  assetId={a.assetId}
                  alt={`Grid ${a.gridIndex}`}
                  square
                />
                <div className="text-xs text-text-muted">
                  Grid {a.gridIndex} · {a.variantKind}
                  {a.asset?.sizeBytes
                    ? ` · ${Math.round(a.asset.sizeBytes / 1024)}KB`
                    : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
