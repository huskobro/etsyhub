// Pass 42 — /admin/midjourney admin yüzeyi.
//
// Bridge sağlığı + son N MJ job listesi. Bridge erişilemiyorsa açık banner
// + kurulum ipucu (env var + bridge dev komutu).
//
// V1: read-only — restart / focus action'ları V1.x'te admin server action
// olarak eklenecek.

import Link from "next/link";
import { db } from "@/server/db";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  getBridgeClient,
  BridgeUnreachableError,
  type BridgeHealth,
} from "@/server/services/midjourney/bridge-client";

function stateTone(state: string): BadgeTone {
  if (state === "COMPLETED") return "success";
  if (state === "FAILED" || state === "CANCELLED") return "danger";
  if (state === "AWAITING_LOGIN" || state === "AWAITING_CHALLENGE")
    return "warning";
  if (state === "QUEUED") return "neutral";
  return "accent";
}

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

async function fetchHealth(): Promise<{
  ok: boolean;
  health?: BridgeHealth;
  error?: string;
}> {
  try {
    const client = getBridgeClient();
    const health = await client.health();
    return { ok: true, health };
  } catch (err) {
    if (err instanceof BridgeUnreachableError) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "bilinmeyen hata",
    };
  }
}

export default async function AdminMidjourneyPage() {
  const [healthResult, recentJobs] = await Promise.all([
    fetchHealth(),
    db.midjourneyJob.findMany({
      orderBy: { enqueuedAt: "desc" },
      take: 50,
      include: {
        user: { select: { email: true } },
        generatedAssets: { select: { id: true } },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Midjourney köprüsü</h1>
        <p className="text-sm text-text-muted">
          Local MJ Bridge sağlığı + son 50 job. Pass 41 design doc:{" "}
          <code className="font-mono text-xs">
            docs/plans/2026-05-06-midjourney-web-bridge-design.md
          </code>
        </p>
      </div>

      {healthResult.ok && healthResult.health ? (
        <BridgeHealthCard health={healthResult.health} />
      ) : (
        <div
          className="rounded-md border border-danger bg-danger-soft p-4 text-sm"
          data-testid="bridge-unreachable"
        >
          <p className="font-semibold text-danger-text">
            Bridge erişilemiyor
          </p>
          <p className="mt-1 text-text-muted">
            {healthResult.error}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-text-muted hover:text-text">
              Kurulum ipucu
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-surface-2 p-3 text-xs text-text">
{`# Terminal 1 — bridge çalıştır:
cd mj-bridge
MJ_BRIDGE_TOKEN=$(openssl rand -hex 16) MJ_BRIDGE_DRIVER=mock npm run dev

# Terminal 2 — EtsyHub .env.local:
MJ_BRIDGE_URL=http://127.0.0.1:8780
MJ_BRIDGE_TOKEN=<aynı token>

# EtsyHub'ı restart et.`}
            </pre>
          </details>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold">Son 50 job</h2>
        <p className="text-xs text-text-muted">
          MJ jobs DB&apos;den; bridge çalışmıyor olsa bile geçmiş listelenir.
        </p>
      </div>

      <Table density="admin">
        <THead>
          <TR>
            <TH>Tarih</TH>
            <TH>Kullanıcı</TH>
            <TH>Prompt</TH>
            <TH>State</TH>
            <TH>Sebep</TH>
            <TH>Asset</TH>
            <TH>MJ Job ID</TH>
          </TR>
        </THead>
        <TBody>
          {recentJobs.length === 0 ? (
            <TR>
              <TD colSpan={7} align="center" muted>
                Henüz MJ job yok.
              </TD>
            </TR>
          ) : (
            recentJobs.map((j) => (
              <TR key={j.id} title={`bridgeJobId: ${j.bridgeJobId}`}>
                <TD muted className="whitespace-nowrap">
                  {j.enqueuedAt.toLocaleString("tr-TR")}
                </TD>
                <TD>{j.user?.email ?? "—"}</TD>
                <TD className="max-w-md truncate text-xs">{j.prompt}</TD>
                <TD>
                  <Badge tone={stateTone(j.state)}>
                    {STATE_LABELS[j.state] ?? j.state}
                  </Badge>
                </TD>
                <TD className="text-xs text-text-muted">
                  {j.blockReason
                    ? BLOCK_REASON_LABELS[j.blockReason] ?? j.blockReason
                    : "—"}
                </TD>
                <TD muted>{j.generatedAssets.length}</TD>
                <TD className="font-mono text-xs">
                  {j.mjJobId ?? "—"}
                </TD>
              </TR>
            ))
          )}
        </TBody>
      </Table>

      {!healthResult.ok ? null : (
        <p className="text-xs text-text-muted">
          ↻ Sayfa yenilendiğinde bridge sağlığı tekrar kontrol edilir.
          Otomatik refresh V1.x.
        </p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-border pt-3 text-xs">
        <Link
          href="/admin/jobs?status=RUNNING"
          className="rounded-md border border-border bg-bg px-3 py-1.5 text-text-muted hover:border-border-strong hover:text-text"
        >
          Tüm aktif joblar →
        </Link>
        <Link
          href="/admin/jobs"
          className="rounded-md border border-border bg-bg px-3 py-1.5 text-text-muted hover:border-border-strong hover:text-text"
        >
          /admin/jobs
        </Link>
      </div>
    </div>
  );
}

function BridgeHealthCard({ health }: { health: BridgeHealth }) {
  return (
    <div
      className="grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="bridge-health"
    >
      <div>
        <div className="text-xs text-text-muted">Bridge</div>
        <div className="text-sm font-semibold text-success">
          ✓ Bağlı (v{health.version})
        </div>
        <div className="mt-1 text-xs text-text-muted">
          Started: {new Date(health.startedAt).toLocaleString("tr-TR")}
        </div>
      </div>
      <div>
        <div className="text-xs text-text-muted">Browser</div>
        <div className="text-sm">
          {health.browser.launched ? "Açık" : "Kapalı"} ·{" "}
          {health.browser.pageCount} tab
        </div>
        <div className="mt-1 truncate text-xs text-text-muted">
          {health.browser.activeUrl ?? "—"}
        </div>
      </div>
      <div>
        <div className="text-xs text-text-muted">MJ login</div>
        <div className="text-sm">
          {health.mjSession.likelyLoggedIn ? "Aktif" : "Pasif"}
        </div>
        <div className="mt-1 text-xs text-text-muted">
          {new Date(health.mjSession.lastChecked).toLocaleString("tr-TR")}
        </div>
      </div>
      <div>
        <div className="text-xs text-text-muted">Job sayaçları</div>
        <div className="text-sm">
          {health.jobs.queued} sırada · {health.jobs.running} çalışıyor ·{" "}
          {health.jobs.blocked} blok
        </div>
        <div className="mt-1 text-xs text-text-muted">
          {health.jobs.completed} tamam · {health.jobs.failed} fail
        </div>
      </div>
    </div>
  );
}
