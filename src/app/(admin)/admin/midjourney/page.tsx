// Pass 42 — /admin/midjourney admin yüzeyi.
// Pass 87 — Operator Control Center: ana sayfa dashboard'a çevrildi.
//   - Quick Stats (6 tile)
//   - Quick Actions (Batch / Templates / Batches CTA)
//   - Active Operations (running jobs + recent batches)
//   - Needs Attention (failed jobs son 24h)
//   - Recent Templates
//   - Advanced (TestRenderForm + Preferences <details> içinde)
//   - All Recent Jobs (mevcut tablo, daraltılmış section)

import Link from "next/link";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  getBridgeClient,
  BridgeUnreachableError,
  type BridgeHealth,
} from "@/server/services/midjourney/bridge-client";
import { TestRenderForm } from "./TestRenderForm";
import { AssetThumb } from "./AssetThumb";
import { JobListFilters } from "./JobListFilters";
import { ListBatchPanel } from "./ListBatchPanel";
import { MidjourneyPreferencesPanel } from "./MidjourneyPreferencesPanel";
// Pass 87 — Control Center components
import { ControlCenterStats } from "./ControlCenterStats";
import { ControlCenterQuickActions } from "./ControlCenterQuickActions";
import { ControlCenterActiveOps } from "./ControlCenterActiveOps";
import { ControlCenterAttention } from "./ControlCenterAttention";
import { ControlCenterTemplates } from "./ControlCenterTemplates";
import {
  getControlCenterStats,
  listFailedJobsNeedingAttention,
  listRecentBatches,
} from "@/server/services/midjourney/batches";
import { listMjTemplates } from "@/server/services/midjourney/templates";

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

type SearchParams = {
  days?: string;
  q?: string;
  status?: string;
  /**
   * Pass 85 — `?batchId=...` filter. Mevcut listeyi sadece o batch'in
   * jobs'larıyla daraltır. Pass 84 Job.metadata.batchId üzerinden join.
   */
  batchId?: string;
};

// Pass 64 — Asset durum filtresi (audit-derived).
// "undownloaded" = en az bir asset MIDJOURNEY_ASSET_EXPORT audit'i yok
// "unreviewed"   = en az bir asset generatedDesignId NULL
// Job-level "en az bir asset uyuyorsa görünür" mantığı: tablo eksiltilmez
// ama tamamen tamamlanmış joblar gizlenir. visibleAssets array'i ayrıca
// asset-level post-filter ile ListBatchPanel'a verilir.
const STATUS_FILTERS = ["all", "undownloaded", "unreviewed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function parseStatusFilter(raw: string | undefined): StatusFilter {
  if (raw && (STATUS_FILTERS as readonly string[]).includes(raw)) {
    return raw as StatusFilter;
  }
  return "all";
}

// Pass 63 — gün bazlı filter chip'leri.
// "today" / "yesterday" / "7d" / "all" — URL'de ?days= olarak persistent.
const DAY_FILTERS = ["today", "yesterday", "7d", "all"] as const;
type DayFilter = (typeof DAY_FILTERS)[number];

function parseDayFilter(raw: string | undefined): DayFilter {
  if (raw && (DAY_FILTERS as readonly string[]).includes(raw)) {
    return raw as DayFilter;
  }
  return "all";
}

function dayFilterToWhere(
  filter: DayFilter,
): Prisma.MidjourneyJobWhereInput {
  if (filter === "all") return {};
  const now = new Date();
  if (filter === "today") {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    return { enqueuedAt: { gte: startOfDay } };
  }
  if (filter === "yesterday") {
    const startOfYesterday = new Date(now);
    startOfYesterday.setDate(now.getDate() - 1);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(startOfYesterday);
    endOfYesterday.setHours(23, 59, 59, 999);
    return { enqueuedAt: { gte: startOfYesterday, lte: endOfYesterday } };
  }
  if (filter === "7d") {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    return { enqueuedAt: { gte: sevenDaysAgo } };
  }
  return {};
}

export default async function AdminMidjourneyPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  // Pass 87 — Control Center user-scoped data
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  // Pass 63/64 — URL state'ten filter'lar.
  const dayFilter = parseDayFilter(searchParams?.days);
  const keyword = (searchParams?.q ?? "").trim();
  const statusFilter = parseStatusFilter(searchParams?.status);
  const batchIdFilter = (searchParams?.batchId ?? "").trim() || null;

  // Pass 64 — Status "unreviewed" job-level Prisma where ile (relation
  // exists). "undownloaded" audit log relation Prisma'da modellenmediği
  // için post-fetch filter (aşağıda).
  const unreviewedWhere: Prisma.MidjourneyJobWhereInput =
    statusFilter === "unreviewed"
      ? { generatedAssets: { some: { generatedDesignId: null } } }
      : {};

  // Pass 85 — `?batchId=` filter. Pass 84 Job.metadata.batchId üzerinden
  // join. MidjourneyJob → Job (jobId FK) → metadata.batchId.
  const batchWhere: Prisma.MidjourneyJobWhereInput = batchIdFilter
    ? {
        job: {
          metadata: {
            path: ["batchId"],
            equals: batchIdFilter,
          },
        },
      }
    : {};

  const where: Prisma.MidjourneyJobWhereInput = {
    ...dayFilterToWhere(dayFilter),
    ...unreviewedWhere,
    ...batchWhere,
    ...(keyword
      ? {
          OR: [
            { prompt: { contains: keyword, mode: "insensitive" as const } },
            { mjJobId: { contains: keyword, mode: "insensitive" as const } },
            {
              bridgeJobId: {
                contains: keyword,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  // Pass 87 — Control Center server-side data (paralel fetch)
  const [
    healthResult,
    recentJobs,
    ccStats,
    ccRecentBatches,
    ccFailedJobs,
    ccTemplates,
  ] = await Promise.all([
    fetchHealth(),
    db.midjourneyJob.findMany({
      where,
      orderBy: { enqueuedAt: "desc" },
      take: 50,
      include: {
        user: { select: { email: true } },
        // Pass 52 — listede ilk grid (gridIndex=0) thumbnail için.
        // Tüm asset'leri çekmek yerine sadece sayı + ilk asset id.
        generatedAssets: {
          orderBy: { gridIndex: "asc" },
          select: {
            id: true,
            gridIndex: true,
            assetId: true,
            // Pass 63 — Review/Selection durumu badge için.
            generatedDesignId: true,
          },
        },
      },
    }),
    // Pass 87 — Control Center paralel fetch
    getControlCenterStats(userId),
    listRecentBatches(userId, 50),
    listFailedJobsNeedingAttention(userId, 10),
    listMjTemplates(),
  ]);

  // Pass 63 — Per-job export count (audit log derived). Tek query'de
  // tüm görünür asset id'leri için groupBy.
  const allAssetIds = recentJobs.flatMap((j) =>
    j.generatedAssets.map((a) => a.id),
  );
  const exportAudits = allAssetIds.length
    ? await db.auditLog.groupBy({
        by: ["targetId"],
        where: {
          action: "MIDJOURNEY_ASSET_EXPORT",
          targetId: { in: allAssetIds },
        },
        _count: { targetId: true },
        _max: { createdAt: true },
      })
    : [];
  const exportByAsset = new Map<
    string,
    { count: number; lastAt: Date | null }
  >();
  for (const e of exportAudits) {
    if (!e.targetId) continue;
    exportByAsset.set(e.targetId, {
      count: e._count.targetId,
      lastAt: e._max.createdAt,
    });
  }
  // Per-job aggregation
  const jobExportSummary = new Map<
    string,
    { totalExports: number; downloadedAssetCount: number }
  >();
  for (const j of recentJobs) {
    let totalExports = 0;
    let downloaded = 0;
    for (const a of j.generatedAssets) {
      const stat = exportByAsset.get(a.id);
      if (stat) {
        totalExports += stat.count;
        downloaded += 1;
      }
    }
    jobExportSummary.set(j.id, {
      totalExports,
      downloadedAssetCount: downloaded,
    });
  }

  // Pass 64 — Status "undownloaded" job-level post-filter (audit log
  // Prisma'da modelli olmadığından SQL where'de uygulanamaz).
  // En az bir asset henüz export edilmediyse job görünür.
  const filteredJobs =
    statusFilter === "undownloaded"
      ? recentJobs.filter((j) =>
          j.generatedAssets.some((a) => !exportByAsset.has(a.id)),
        )
      : recentJobs;

  // Pass 64 — List-level batch için tüm görünen asset'lerin flat listesi.
  // ListBatchPanel client component bu array'i alır + akıllı seçim
  // filter'ları (downloaded/promoted/hepsi/temizle) için audit-derived
  // state'leri kullanır.
  const visibleAssets = filteredJobs.flatMap((j) =>
    j.generatedAssets.map((a) => ({
      midjourneyAssetId: a.id,
      midjourneyJobId: j.id,
      gridIndex: a.gridIndex,
      jobPrompt: j.prompt.slice(0, 80),
      mjJobId: j.mjJobId,
      isDownloaded: exportByAsset.has(a.id),
      isPromoted: a.generatedDesignId !== null,
    })),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Midjourney köprüsü</h1>
          <p className="text-sm text-text-muted">
            Local MJ Bridge sağlığı + son 50 job. Pass 41 design doc:{" "}
            <code className="font-mono text-xs">
              docs/plans/2026-05-06-midjourney-web-bridge-design.md
            </code>
          </p>
        </div>
        {/* Pass 81 — Templates + Batch Run shortcut'ları
            Pass 84 — Batches list shortcut */}
        <nav className="flex shrink-0 gap-2" data-testid="mj-page-shortcuts">
          <Link
            href="/admin/midjourney/templates"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text hover:border-border-strong hover:bg-surface-2"
          >
            Templates
          </Link>
          <Link
            href="/admin/midjourney/batches"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text hover:border-border-strong hover:bg-surface-2"
          >
            Batches
          </Link>
          <Link
            href="/admin/midjourney/batch-run"
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-text hover:border-border-strong hover:bg-surface-2"
          >
            Batch Run
          </Link>
        </nav>
      </div>

      {/* Pass 85 — Batch filter banner. ?batchId=X aktifken kullanıcıya
          "şu an Batch X için filtrelenmiş liste görüyorsun" + filter'ı
          temizleme + batch detail sayfasına dönüş kısayolu. */}
      {batchIdFilter ? (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent bg-accent-soft px-3 py-2 text-sm"
          data-testid="mj-batch-filter-banner"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Batch filter aktif:</span>
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">
              {batchIdFilter.slice(0, 12)}…
            </code>
            <span className="text-text-muted">
              ({recentJobs.length} job listede)
            </span>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/midjourney/batches/${batchIdFilter}`}
              className="text-xs text-accent underline hover:no-underline"
            >
              Batch detail →
            </Link>
            <Link
              href="/admin/midjourney"
              className="text-xs text-text-muted underline hover:text-text"
            >
              Filter&apos;ı temizle
            </Link>
          </div>
        </div>
      ) : null}

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
        <h2 className="text-lg font-semibold">
          Son 50 job
          {dayFilter !== "all" || keyword || statusFilter !== "all" ? (
            <span className="ml-2 text-xs font-normal text-text-muted">
              ({filteredJobs.length} sonuç · filtreli)
            </span>
          ) : null}
        </h2>
        <p className="text-xs text-text-muted">
          MJ jobs DB&apos;den; bridge çalışmıyor olsa bile geçmiş listelenir.
        </p>
      </div>

      {/* Pass 87 — Operator Control Center: Section A-D
          Operator günlük girişi: stats → quick actions → active ops →
          needs attention → recent templates. Hepsi server component,
          paralel fetch. */}
      <ControlCenterStats stats={ccStats} />
      <ControlCenterQuickActions />
      <ControlCenterActiveOps userId={userId} recentBatches={ccRecentBatches} />
      <ControlCenterAttention failedJobs={ccFailedJobs} />
      <ControlCenterTemplates templates={ccTemplates} />

      {/* Pass 87 — Advanced section (collapsed by default).
          TestRenderForm tek-shot + Preferences panel + ListBatchPanel
          (asset bulk export). Operatör Quick Actions + Batch Run akışıyla
          %90 işini halleder; bu drawer ileri seviye operasyonlar için. */}
      <details
        className="rounded-md border border-border bg-surface"
        data-testid="mj-advanced-drawer"
      >
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-text">
          Advanced (Test Render · Preferences · Bulk Export)
        </summary>
        <div className="flex flex-col gap-3 border-t border-border p-4">
          {/* Pass 64 — List-level asset batch panel. Görünen tüm asset'ler
              üzerinde akıllı seçim + bulk export ZIP. */}
          <ListBatchPanel visibleAssets={visibleAssets} />

          {/* Pass 50 — Test Render tek-shot tetikleyici. Bridge sağlıklı
              değilse form disabled ama görünür. */}
          <TestRenderForm
            bridgeOk={healthResult.ok}
            driverKind={healthResult.health?.driver}
          />

          {/* Pass 70 — MJ tercihleri (export format + strategy default + ...) */}
          <MidjourneyPreferencesPanel />
        </div>
      </details>

      {/* Pass 87 — Section E: All Recent Jobs (mevcut filter + table)
          Header + filter + table korundu; Pass 63/64 işlevselliği intact. */}
      <section data-testid="mj-cc-jobs-section" aria-label="Tüm jobs">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Tüm Jobs</h2>
          <span className="text-xs text-text-muted">
            (filtreler + arama aşağıda)
          </span>
        </div>
        {/* Pass 63/64 — Date + status chip + keyword arama (URL state). */}
        <JobListFilters />
      </section>

      <Table density="admin">
        <THead>
          <TR>
            <TH>Önizleme</TH>
            <TH>Tarih</TH>
            <TH>Kullanıcı</TH>
            <TH>Prompt</TH>
            <TH>State</TH>
            <TH>Sebep</TH>
            <TH>Asset</TH>
            {/* Pass 63 — Audit-derived: indirildi sayısı + Review sayısı. */}
            <TH>İndirme</TH>
            <TH>Review</TH>
            <TH>MJ Job ID</TH>
          </TR>
        </THead>
        <TBody>
          {filteredJobs.length === 0 ? (
            <TR>
              <TD colSpan={10} align="center" muted>
                {dayFilter !== "all" ||
                keyword ||
                statusFilter !== "all"
                  ? "Filtreye uyan MJ job yok."
                  : "Henüz MJ job yok."}
              </TD>
            </TR>
          ) : (
            filteredJobs.map((j) => {
              const firstAsset = j.generatedAssets[0];
              return (
                <TR key={j.id} title={`bridgeJobId: ${j.bridgeJobId}`}>
                  <TD className="w-12">
                    {firstAsset ? (
                      <Link
                        href={`/admin/midjourney/${j.id}`}
                        className="block w-10"
                      >
                        <AssetThumb
                          assetId={firstAsset.assetId}
                          alt={`MJ ${j.id} grid 0`}
                        />
                      </Link>
                    ) : (
                      <div
                        className="aspect-square w-10 rounded-md border border-border bg-surface-2"
                        title="Asset henüz yok"
                      />
                    )}
                  </TD>
                  <TD muted className="whitespace-nowrap">
                    <Link
                      href={`/admin/midjourney/${j.id}`}
                      className="hover:text-text"
                    >
                      {j.enqueuedAt.toLocaleString("tr-TR")}
                    </Link>
                  </TD>
                  <TD>{j.user?.email ?? "—"}</TD>
                  <TD className="max-w-md truncate text-xs">
                    <Link
                      href={`/admin/midjourney/${j.id}`}
                      className="hover:text-text"
                    >
                      {j.prompt}
                    </Link>
                  </TD>
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
                  {/* Pass 63 — Audit-derived export sayacı. */}
                  <TD className="text-xs">
                    {(() => {
                      const stat = jobExportSummary.get(j.id);
                      if (!stat || stat.totalExports === 0) {
                        return <span className="text-text-muted">—</span>;
                      }
                      return (
                        <span
                          className="rounded bg-accent-soft px-1.5 py-0.5 text-accent-text"
                          title={`${stat.downloadedAssetCount}/${j.generatedAssets.length} asset için ${stat.totalExports} format export edildi`}
                          data-testid={`mj-list-downloaded-${j.id}`}
                        >
                          ↓ {stat.totalExports}
                        </span>
                      );
                    })()}
                  </TD>
                  {/* Pass 63 — Review queue badge (generatedDesignId dolu sayısı). */}
                  <TD className="text-xs">
                    {(() => {
                      const promoted = j.generatedAssets.filter(
                        (a) => a.generatedDesignId !== null,
                      ).length;
                      if (promoted === 0) {
                        return <span className="text-text-muted">—</span>;
                      }
                      return (
                        <span
                          className="rounded bg-success-soft px-1.5 py-0.5 text-success"
                          title={`${promoted}/${j.generatedAssets.length} asset Review queue'da`}
                          data-testid={`mj-list-review-${j.id}`}
                        >
                          ✓ {promoted}
                        </span>
                      );
                    })()}
                  </TD>
                  <TD className="font-mono text-xs">{j.mjJobId ?? "—"}</TD>
                </TR>
              );
            })
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
      {health.browser.sessionProbe ? (
        <SessionWatchdogBadge probe={health.browser.sessionProbe} />
      ) : null}
    </div>
  );
}

// Pass 59 — Bridge session watchdog görüntüsü.
// Periyodik MJ login probe geçmişini sergiler; en son probe yaşı,
// başarısız probe sayısı, ve son N tick'in mini timeline'ı.
function SessionWatchdogBadge({
  probe,
}: {
  probe: NonNullable<BridgeHealth["browser"]["sessionProbe"]>;
}) {
  const last = probe.history[probe.history.length - 1];
  const lastAt = last ? new Date(last.at) : null;
  const ageSec = lastAt
    ? Math.round((Date.now() - lastAt.getTime()) / 1000)
    : null;
  // Stale = son probe son 2 interval'dan eski.
  const staleThresholdSec = (probe.intervalMs / 1000) * 2;
  const stale = ageSec !== null && ageSec > staleThresholdSec;
  const failedCount = probe.history.filter(
    (p) => !p.likelyLoggedIn || !p.selectorPromptInputFound,
  ).length;
  const tone =
    last === undefined
      ? "muted"
      : !last.likelyLoggedIn
        ? "warning"
        : stale
          ? "warning"
          : "ok";
  const cls =
    tone === "warning"
      ? "rounded-md border border-warning bg-warning-soft p-3 text-xs text-warning-text"
      : "rounded-md border border-border bg-surface-2 p-3 text-xs text-text-muted";

  return (
    <div className={cls} data-testid="bridge-session-watchdog">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Session watchdog</span>
        <span>
          interval: {Math.round(probe.intervalMs / 1000)}sn · {probe.probeCount}{" "}
          probe
        </span>
        {ageSec !== null ? (
          <span>
            son probe: <span className="font-mono">{ageSec}sn önce</span>
          </span>
        ) : null}
        {failedCount > 0 ? (
          <span data-testid="watchdog-failed-count">
            ⚠ son {probe.history.length}/{failedCount} probe başarısız
          </span>
        ) : null}
        {stale ? (
          <span data-testid="watchdog-stale">⚠ stale (probe geç)</span>
        ) : null}
      </div>
      {probe.history.length > 0 ? (
        <div
          className="mt-1 flex items-center gap-0.5"
          aria-label="probe history mini timeline"
          data-testid="watchdog-timeline"
        >
          {probe.history.map((p, i) => {
            const ok = p.likelyLoggedIn && p.selectorPromptInputFound;
            return (
              <span
                key={i}
                title={`${new Date(p.at).toLocaleTimeString("tr-TR")} · ${ok ? "OK" : "FAIL"}`}
                className={
                  "inline-block h-2 w-2 rounded-full " +
                  (ok ? "bg-success" : "bg-danger")
                }
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
