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
import { TestRenderForm } from "./TestRenderForm";

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

      {/* Pass 44 — challenge / login handoff bilgi banner. Bridge sağlıklı
          ama mjSession.likelyLoggedIn=false ise kullanıcıya manuel
          intervention notu. Pass 47 — attach modunda kullanıcı kendi
          browser'ında login yapar; launch modunda bridge'in açtığı
          pencerede. */}
      {healthResult.ok &&
      healthResult.health &&
      !healthResult.health.mjSession.likelyLoggedIn ? (
        <div
          className="rounded-md border border-warning bg-warning-soft p-3 text-sm text-warning-text"
          data-testid="bridge-handoff-notice"
        >
          <p className="font-semibold">Manuel intervention bekleniyor</p>
          <p className="mt-1 text-xs">
            {healthResult.health.browser.mode === "attach" ? (
              <>
                Bridge sizin başlattığınız Brave/Chrome penceresine bağlı.
                O pencereye geçip{" "}
                <strong>Cloudflare doğrulamasını tamamlayın</strong> ve{" "}
                <strong>Discord/Google ile login olun</strong>. Bridge
                CDP üzerinden bağlı kaldığı için pencereyi kapatmanız
                gerekmez.
              </>
            ) : (
              <>
                Bridge MJ web&apos;e bağlandı ama login durumu pasif.
                Bridge&apos;in açtığı pencerede{" "}
                <strong>Cloudflare doğrulamasını tamamlayın</strong> ve
                ardından{" "}
                <strong>Discord/Google ile login olun</strong>. Bridge
                persistent profile session&apos;ı kaydeder; sonraki turda
                tekrar login gerekmez.
              </>
            )}
          </p>
        </div>
      ) : null}

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
          <details className="mt-2" open>
            <summary className="cursor-pointer text-xs text-text-muted hover:text-text">
              Kurulum ipucu — Attach modeli (Pass 49, Chrome-first)
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-surface-2 p-3 text-xs text-text">
{`# 1. Önce mevcut Chrome'u kapat:
osascript -e 'quit app "Google Chrome"'

# 2. Chrome'u ayrı profile + remote-debugging-port ile başlat:
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\
  --remote-debugging-port=9222 \\
  --user-data-dir="$HOME/.mj-bridge-chrome-profile"

# 3. Açılan pencerede:
#    a) Cloudflare doğrulamasını çöz (gelirse)
#    b) midjourney.com → Discord/Google ile login
#    c) PENCEREYİ AÇIK BIRAK (kapatma)

# 4. Başka terminal — bridge'i attach modunda başlat:
cd mj-bridge
MJ_BRIDGE_TOKEN=secret \\
MJ_BRIDGE_DRIVER=playwright \\
MJ_BRIDGE_BROWSER_MODE=attach \\
MJ_BRIDGE_CDP_URL=http://127.0.0.1:9222 \\
npm run dev

# 5. EtsyHub .env.local:
MJ_BRIDGE_URL=http://127.0.0.1:8780
MJ_BRIDGE_TOKEN=<aynı token>

# 6. EtsyHub'ı restart et.

# Brave alternatifi (Pass 47 yolu):
# --user-data-dir="$HOME/.mj-bridge-brave-profile"

# --- Alternatif: Mock (UI test) veya Launch (CF riski yüksek):
# MJ_BRIDGE_DRIVER=mock npm run dev
# MJ_BRIDGE_DRIVER=playwright MJ_BRIDGE_BROWSER_MODE=launch \\
#   MJ_BRIDGE_BROWSER_KIND=chrome npm run dev`}
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

      {/* Pass 50 — operator Test Render tetikleyici. Bridge sağlıklı
          değilse form disabled ama görünür kalır (operator
          kurulum ipucundan sonra direkt buradan tetikleyebilsin). */}
      <TestRenderForm
        bridgeOk={healthResult.ok}
        driverKind={healthResult.health?.driver}
      />

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
  const smoke = health.selectorSmoke;
  // Pass 43 — selector smoke yalnız PlaywrightDriver'da. Mock'ta null.
  const smokeWarn =
    smoke &&
    !smoke.promptInputFound &&
    !smoke.loginIndicatorFound &&
    !smoke.signInLinkFound;
  return (
    <div className="flex flex-col gap-3" data-testid="bridge-health">
      <div className="grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs text-text-muted">Bridge</div>
          <div className="text-sm font-semibold text-success">
            ✓ Bağlı (v{health.version})
          </div>
          <div className="mt-1 text-xs text-text-muted">
            Driver: <span className="font-mono">{health.driver}</span>
          </div>
          <div className="text-xs text-text-muted">
            Started: {new Date(health.startedAt).toLocaleString("tr-TR")}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Browser</div>
          <div className="text-sm">
            {health.browser.launched ? "Açık" : "Kapalı"} ·{" "}
            {health.browser.pageCount} tab
          </div>
          {/* Pass 47 — mode + browserKind + (attach ise) cdpUrl.
              Pass 45 — channel + profile state geriye uyumlu. */}
          <div className="mt-1 text-xs text-text-muted">
            Mod:{" "}
            <span className="font-mono">
              {health.browser.mode ?? "—"}
            </span>
            {" · "}
            Binary:{" "}
            <span className="font-mono">
              {health.browser.browserKind ?? health.browser.channel ?? "—"}
            </span>
            {" · "}
            Profile:{" "}
            <span className="font-mono">
              {health.browser.profileState ?? "—"}
            </span>
          </div>
          {health.browser.mode === "attach" && health.browser.cdpUrl ? (
            <div className="mt-1 truncate text-xs text-text-muted">
              CDP:{" "}
              <span className="font-mono">{health.browser.cdpUrl}</span>
            </div>
          ) : null}
          <div className="mt-1 truncate text-xs text-text-muted">
            {health.browser.activeUrl ?? "—"}
          </div>
          {/* Pass 46 — driver gözlem alanları. lastDriverMessage:
              "render bekleniyor… Ns" / "selector eşleşmedi"; lastDriverError:
              "render-timeout" / "selector-mismatch". Admin "bridge ne
              yapıyor?" sorusunu cevaplar. */}
          {health.browser.lastDriverMessage ? (
            <div className="mt-1 truncate text-xs text-text-muted">
              <span className="text-text-muted">Driver:</span>{" "}
              {health.browser.lastDriverMessage}
            </div>
          ) : null}
          {health.browser.lastDriverError ? (
            <div
              className="mt-1 truncate text-xs text-danger"
              title={health.browser.lastDriverError}
            >
              <span className="text-text-muted">Hata:</span>{" "}
              {health.browser.lastDriverError}
            </div>
          ) : null}
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
      {smoke ? (
        <div
          className={
            smokeWarn
              ? "rounded-md border border-warning bg-warning-soft p-3 text-xs text-warning-text"
              : "rounded-md border border-border bg-surface-2 p-3 text-xs text-text-muted"
          }
          data-testid="bridge-selector-smoke"
        >
          <div className="font-semibold">
            Selector smoke ({new Date(smoke.at).toLocaleString("tr-TR")})
          </div>
          <div className="mt-1">
            promptInput: {smoke.promptInputFound ? "✓" : "✗"} · loginIndicator:{" "}
            {smoke.loginIndicatorFound ? "✓" : "✗"} · signInLink:{" "}
            {smoke.signInLinkFound ? "✓" : "✗"}
          </div>
          {smokeWarn ? (
            <div className="mt-1">
              ⚠ MJ web tarafında selector eşleşmedi. Bridge MJ_SELECTOR_OVERRIDES
              env ile kalibre edilmeli.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
