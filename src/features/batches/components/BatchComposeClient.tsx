"use client";

/**
 * Phase 44 — Batch compose / launch surface.
 * Phase 45 — Wording shift: "Variations" → "Similar". Operatör Pool'da
 * queue/staging yapar; compose surface'i buradan açar. CTA artık
 * "Create Similar (N)" — Midjourney'in `vary subtle / vary strong`
 * dünyasıyla karışan "variation" dilinden kaçar; doğru anlam: bu
 * reference'lardan yola çıkarak benzer yeni üretimler.
 *
 * v4 A6 Create Variations spec'inin (docs/design-system/kivasy/ui_kits/
 * kivasy/v4/screens-a6-a7.jsx) page-form factor equivalent'i. v4 A6 daha
 * sade ve doğrudan launch'a odaklı — v7 d2a/d2b'nin advanced template
 * management territory'sinden (PromptPreviewSection + edit-as-override)
 * bu turda kaçınılır.
 *
 * Form sections (v4 A6 parity, Phase 45 wording):
 *   1. Aspect ratio  → 3-card grid (Square / Landscape / Portrait)
 *   2. Similarity    → 4-stop segmented (Close / Medium / Loose / Inspired)
 *                      [advisory only — backend henüz consume etmiyor;
 *                       Phase 45+ candidate: brief'e enjekte edilebilir]
 *   3. Similar generation count → 2/3/4/6 segmented (max 6 — schema cap)
 *   4. Prompt template → placeholder card (Phase 45+ template picker)
 *   5. Reference parameters → sref/oref/cref chips (advisory only)
 *
 * Footer:
 *   - Cancel (ghost) → /batches
 *   - Cost preview "~$N.NN · est. Nm" (k-mono)
 *   - Primary "Create Similar (N)" → POST /api/batches/[id]/launch
 *
 * Launch mutation:
 *   - Triggers createVariationJobs (existing pipeline) with real
 *     Batch.id as Job.metadata.batchId
 *   - Batch state DRAFT → QUEUED + launchedAt set
 *   - onSuccess → router.push(`/batches/[batchId]`) — operatör Batches
 *     hub'ında batch'ini görür, state değişimi UI'da live yansır
 *
 * Phase 44 scope kısıtı: count max 6 (CreateVariationsBody schema'sı).
 * Provider/aspect/quality form'dan seçilir; brief (style note) opsiyonel.
 *
 * Phase 44+ candidate'lar:
 *   - Multi-reference launch (her item için ayrı createVariationJobs)
 *   - Real Similarity → brief injection (currently advisory)
 *   - Reference parameters wiring (sref weight, oref/cref)
 *   - Prompt template picker (v7 PromptPreviewSection seviyesinde)
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Sparkles } from "lucide-react";
import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/cn";
import {
  PROVIDER_CAPABILITIES,
  getProviderCapability,
} from "@/features/variation-generation/provider-capabilities";

type BatchComposeData = {
  id: string;
  label: string | null;
  state: string;
  items: {
    id: string;
    position: number;
    reference: {
      id: string;
      asset: {
        id: string;
        width: number | null;
        height: number | null;
        sourceUrl: string | null;
      } | null;
      productType: { id: string; displayName: string } | null;
      bookmark: { title: string | null; sourceUrl: string | null } | null;
    };
  }[];
};

type AspectRatio = "1:1" | "2:3" | "3:2";
type Quality = "medium" | "high";

const SIMILARITY_STOPS = ["Close", "Medium", "Loose", "Inspired"] as const;
const SIMILARITY_HINTS = [
  "New designs will closely match composition + palette",
  "Generations diverge in detail but keep palette and subject",
  "Loose interpretation — palette held, composition free",
  "Subject-only inspiration — no compositional ties",
] as const;

// Phase 44 — provider call cost baseline (KIE midjourney). Matches
// VARIATION_CALL_COST_CENTS in ai-generation.service.ts (24 cents/call).
const COST_PER_VARIATION_CENTS = 24;

export function BatchComposeClient({
  batch,
  initialProviderId,
}: {
  batch: BatchComposeData;
  initialProviderId?: string;
}) {
  const router = useRouter();

  // Provider state — default from settings; fall back to first available.
  const defaultProviderId = useMemo(() => {
    if (initialProviderId) {
      const cap = getProviderCapability(initialProviderId);
      if (cap?.available) return initialProviderId;
    }
    const firstAvail = PROVIDER_CAPABILITIES.find((p) => p.available);
    return firstAvail?.id ?? "kie-gpt-image-1.5";
  }, [initialProviderId]);
  const [providerId, setProviderId] = useState(defaultProviderId);

  const [aspect, setAspect] = useState<AspectRatio>("2:3");
  const [similarity, setSimilarity] = useState<number>(1); // Medium
  const [count, setCount] = useState<number>(6);
  const [quality, setQuality] = useState<Quality>("medium");
  const [refParams, setRefParams] = useState({
    sref: true,
    oref: false,
    cref: false,
  });

  const providerCap = getProviderCapability(providerId);
  const supportsQuality = (providerCap?.supportedQualities.length ?? 0) > 0;

  // Cost + time preview (v4 A6 footer parity)
  const totalCostCents = COST_PER_VARIATION_CENTS * count;
  const totalCostUSD = (totalCostCents / 100).toFixed(2);
  const estMinutes = Math.max(1, Math.round(count * 0.5));

  // Phase 44 — Pool card "New Batch" tek-reference path canonical;
  // multi-reference Phase 44+ candidate. Eğer batch'te 0 item varsa
  // launch yapılamaz (service validation zaten enforce eder; UI ayrıca
  // disabled).
  const firstReference = batch.items[0]?.reference;
  const hasItems = batch.items.length > 0;
  const referenceUrl =
    firstReference?.asset?.sourceUrl ?? firstReference?.bookmark?.sourceUrl;
  const referenceHasPublicUrl = !!firstReference?.asset?.sourceUrl;

  const launchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/batches/${batch.id}/launch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId,
          aspectRatio: aspect,
          ...(supportsQuality ? { quality } : {}),
          count,
          // Phase 44 — Similarity hint advisory; ileride brief'e prefix
          // olarak enjekte edilebilir. Şu an pure client state.
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Failed to launch batch");
      }
      return (await res.json()) as {
        batchId: string;
        designIds: string[];
        failedDesignIds: string[];
        state: string;
      };
    },
    onSuccess: () => {
      // Operatör Batches hub'ında batch'i görsün; state badge canlı
      // güncellenecek (legacy Batches index'ten okuma yine
      // Job.metadata.batchId üzerinden — Batch.id ile aynı uzayda).
      router.push(`/batches/${batch.id}`);
    },
  });

  const launchDisabled =
    !hasItems ||
    !referenceHasPublicUrl ||
    !providerCap?.available ||
    launchMutation.isPending;

  return (
    <div
      className="flex h-full flex-col bg-paper"
      data-testid="batch-compose"
      data-batch-id={batch.id}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-line bg-paper px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/batches"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-k-bg hover:text-ink"
            aria-label="Back to Batches"
            data-testid="batch-compose-back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1
              className="truncate text-[16px] font-semibold text-ink"
              data-testid="batch-compose-title"
            >
              {batch.label ?? "Untitled batch"}
            </h1>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              <span data-testid="batch-compose-state">{batch.state}</span>
              <span aria-hidden>·</span>
              <span>BATCH {batch.id.slice(0, 8).toUpperCase()}</span>
              <span aria-hidden>·</span>
              <span data-testid="batch-compose-item-count">
                {batch.items.length} reference
                {batch.items.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Body — two-column split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Source reference rail (v4 A6 rail parity) */}
        <aside
          className="w-72 flex-shrink-0 overflow-y-auto border-r border-line-soft bg-k-bg-2/30 p-4"
          data-testid="batch-compose-rail"
        >
          <div className="mb-3 font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Source reference
          </div>
          {firstReference ? (
            <>
              <div className="k-thumb aspect-square w-full overflow-hidden rounded-lg">
                {firstReference.asset ? (
                  <AssetImage
                    assetId={firstReference.asset.id}
                    alt={firstReference.bookmark?.title ?? "Reference"}
                    frame={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[12px] text-ink-3">
                    No image
                  </div>
                )}
              </div>
              <h3 className="mt-3 truncate text-[14px] font-semibold leading-tight text-ink">
                {firstReference.bookmark?.title ?? "Untitled reference"}
              </h3>
              <dl className="mt-3 space-y-2 text-[12px]">
                {firstReference.productType ? (
                  <div className="flex justify-between">
                    <dt className="text-ink-3">Type</dt>
                    <dd className="text-ink">
                      {firstReference.productType.displayName}
                    </dd>
                  </div>
                ) : null}
                {firstReference.asset?.width && firstReference.asset?.height ? (
                  <div className="flex justify-between">
                    <dt className="text-ink-3">Resolution</dt>
                    <dd className="font-mono text-ink">
                      {firstReference.asset.width} ×{" "}
                      {firstReference.asset.height}
                    </dd>
                  </div>
                ) : null}
                {referenceUrl ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-3">Source</dt>
                    <dd className="max-w-[160px] truncate text-ink" title={referenceUrl}>
                      {new URL(referenceUrl).hostname.replace(/^www\./, "")}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {!referenceHasPublicUrl ? (
                <div
                  className="mt-4 rounded-md border border-warning bg-warning-soft/50 px-3 py-2 text-[11.5px] text-ink"
                  data-testid="batch-compose-no-url-warning"
                >
                  This reference has no public source URL — AI launch
                  requires URL-sourced references. Use Bookmark Inbox to
                  add a publicly accessible image.
                </div>
              ) : null}
              {batch.items.length > 1 ? (
                <div className="mt-4 rounded-md border border-line-soft bg-paper px-3 py-2 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                  +{batch.items.length - 1} more reference
                  {batch.items.length - 1 === 1 ? "" : "s"} · multi-launch
                  in a later phase
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-md border border-line-soft bg-paper px-3 py-4 text-[12px] text-ink-3">
              No references in this batch yet.
            </div>
          )}
        </aside>

        {/* Right: Compose form (v4 A6 sections parity) */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div
            className="mx-auto max-w-[640px] space-y-7"
            data-testid="batch-compose-form"
          >
            <Section label="Provider">
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="h-control-md w-full rounded-md border border-line bg-paper px-3 text-[13px] text-ink"
                data-testid="batch-compose-provider"
              >
                {PROVIDER_CAPABILITIES.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.available}>
                    {p.label}
                    {p.available ? "" : " — unavailable"}
                  </option>
                ))}
              </select>
              {!providerCap?.available && providerCap?.helperText ? (
                <p className="mt-1.5 text-[11.5px] text-ink-3">
                  {providerCap.helperText}
                </p>
              ) : null}
            </Section>

            <Section label="Aspect ratio">
              <div className="grid grid-cols-3 gap-3">
                <RatioCard
                  active={aspect === "1:1"}
                  onClick={() => setAspect("1:1")}
                  shape="square"
                  title="Square"
                  sub="1:1"
                />
                <RatioCard
                  active={aspect === "3:2"}
                  onClick={() => setAspect("3:2")}
                  shape="landscape"
                  title="Landscape"
                  sub="3:2"
                />
                <RatioCard
                  active={aspect === "2:3"}
                  onClick={() => setAspect("2:3")}
                  shape="portrait"
                  title="Portrait"
                  sub="2:3"
                />
              </div>
            </Section>

            <Section
              label="Similarity"
              hint={SIMILARITY_HINTS[similarity]}
            >
              <div className="flex">
                {SIMILARITY_STOPS.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSimilarity(i)}
                    className={cn(
                      "-ml-px h-10 flex-1 border border-line text-[12.5px] font-medium transition-colors first:ml-0 first:rounded-l-md last:rounded-r-md",
                      i === similarity
                        ? "z-10 relative border-k-orange bg-k-orange-soft text-k-orange-ink"
                        : "bg-paper text-ink-2 hover:border-line-strong",
                    )}
                    data-testid="batch-compose-similarity-stop"
                    data-active={i === similarity || undefined}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Section>

            <Section label="Similar generation count">
              <div className="flex">
                {[2, 3, 4, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={cn(
                      "-ml-px h-10 flex-1 border border-line text-[13px] font-semibold transition-colors first:ml-0 first:rounded-l-md last:rounded-r-md",
                      n === count
                        ? "z-10 relative border-k-orange bg-k-orange-soft text-k-orange-ink"
                        : "bg-paper text-ink-2 hover:border-line-strong",
                    )}
                    data-testid="batch-compose-count-stop"
                    data-active={n === count || undefined}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                Server cap: 6 per launch · larger batches Phase 44+
              </p>
            </Section>

            {supportsQuality ? (
              <Section label="Quality">
                <div className="flex">
                  {(["medium", "high"] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuality(q)}
                      className={cn(
                        "-ml-px h-10 flex-1 border border-line text-[13px] font-medium capitalize transition-colors first:ml-0 first:rounded-l-md last:rounded-r-md",
                        q === quality
                          ? "z-10 relative border-k-orange bg-k-orange-soft text-k-orange-ink"
                          : "bg-paper text-ink-2 hover:border-line-strong",
                      )}
                      data-testid="batch-compose-quality"
                      data-active={q === quality || undefined}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </Section>
            ) : null}

            <Section label="Prompt template">
              <button
                type="button"
                disabled
                className="flex h-11 w-full items-center gap-3 rounded-md border border-line bg-paper px-3 text-left opacity-60"
                title="Template picker is wired in a later phase. Active product type prompt is used by default."
                data-testid="batch-compose-prompt-template"
              >
                <div className="flex-1 text-[13.5px] font-medium text-ink-2">
                  Active product type prompt (default)
                </div>
                <span className="font-mono text-[11px] text-ink-3">auto</span>
              </button>
              <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                Template picker · next phase
              </p>
            </Section>

            <Section label="Reference parameters" hint="Optional · advisory">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { k: "sref", label: "--sref", desc: "Style reference" },
                    { k: "oref", label: "--oref", desc: "Object reference" },
                    { k: "cref", label: "--cref", desc: "Character reference" },
                  ] as const
                ).map(({ k, label, desc }) => {
                  const on = refParams[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() =>
                        setRefParams((s) => ({ ...s, [k]: !s[k] }))
                      }
                      className={cn(
                        "flex h-9 items-center gap-2 rounded-md border px-3 transition-all",
                        on
                          ? "border-k-orange bg-k-orange-soft"
                          : "border-line bg-paper hover:border-line-strong",
                      )}
                      data-testid="batch-compose-refparam"
                      data-key={k}
                      data-active={on || undefined}
                    >
                      <span
                        className={cn(
                          "font-mono text-[11.5px] font-semibold",
                          on ? "text-k-orange-ink" : "text-ink-2",
                        )}
                      >
                        {label}
                      </span>
                      <span
                        className={cn(
                          "text-[12px]",
                          on ? "text-k-orange-ink" : "text-ink-3",
                        )}
                      >
                        {desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                Provider wiring · next phase (advisory only for now)
              </p>
            </Section>

            {launchMutation.isError ? (
              <div
                role="alert"
                className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
                data-testid="batch-compose-error"
              >
                {(launchMutation.error as Error).message}
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Footer — v4 A6 cost preview parity */}
      <div className="flex items-center justify-between gap-3 border-t border-line bg-paper px-6 py-3.5">
        <Link
          href="/batches"
          className="k-btn k-btn--ghost"
          data-size="sm"
          data-testid="batch-compose-cancel"
        >
          Cancel
        </Link>
        <div className="flex items-center gap-4">
          <span
            className="font-mono text-[11px] text-ink-3"
            data-testid="batch-compose-cost"
          >
            ~${totalCostUSD} · est. {estMinutes}m
          </span>
          <button
            type="button"
            className="k-btn k-btn--primary"
            data-size="sm"
            disabled={launchDisabled}
            onClick={() => launchMutation.mutate()}
            data-testid="batch-compose-launch"
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            {launchMutation.isPending
              ? "Launching…"
              : `Create Similar (${count})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between">
        <label className="text-[13px] font-semibold text-ink">{label}</label>
        {hint ? (
          <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function RatioCard({
  active,
  onClick,
  shape,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  shape: "square" | "landscape" | "portrait";
  title: string;
  sub: string;
}) {
  // v4 A6 ratio thumbnail boxes — fixed Tailwind sizes per ratio.
  // Inline styles are forbidden (no-restricted-syntax rule); we use
  // arbitrary classes that Tailwind generates at build time. Color
  // toggles via active state; shape-specific dimensions match the
  // visual proportions in v4 A6 spec (56×56 / 72×48 / 48×72).
  const shapeClass =
    shape === "square"
      ? "h-[56px] w-[56px]"
      : shape === "landscape"
        ? "h-[48px] w-[72px]"
        : "h-[72px] w-[48px]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[120px] flex-col items-center justify-center gap-2 rounded-md border-2 transition-all",
        active
          ? "border-k-orange bg-k-orange-soft/30 shadow-[0_4px_12px_rgba(232,93,37,0.12)]"
          : "border-line bg-paper hover:border-line-strong",
      )}
      data-testid="batch-compose-aspect"
      data-aspect={sub}
      data-active={active || undefined}
    >
      <div
        className={cn(
          "rounded-sm",
          shapeClass,
          active ? "bg-k-orange" : "bg-line-strong",
        )}
      />
      <div className="text-center">
        <div className="text-[12.5px] font-semibold text-ink">{title}</div>
        <div className="font-mono text-[10.5px] text-ink-3">{sub}</div>
      </div>
    </button>
  );
}
