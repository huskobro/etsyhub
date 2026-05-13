"use client";

/**
 * Phase 62 — BatchComposeSplitModal
 *
 * v4 A6 Create Variations split-modal compose surface. Phase 60-61'de
 * `BatchQueuePanel.ComposePanel` içinde 440px sağ-rail inline form vardı;
 * v4 A6 spec'i (`docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a6-a7.jsx`)
 * geniş split modal istiyor: source rail (sol, ~280px) + form body (sağ,
 * ~640px) + footer (cost + Launch CTA). Phase 62 bu spec'i ürünleştirir.
 *
 * Mode kararı (CLAUDE.md Madde A "single canonical surface"):
 *   - Queue panel **staging** (canlı, kanıtlanmış Phase 45+ baseline)
 *   - Modal **compose/launch** (v4 A6 canonical layout)
 *   - Kapatma → operatör Pool browse'a kesintisiz döner
 *
 * Provider-aware:
 *   - Midjourney: mode picker (3 prominent: sref/oref/cref + 3 advanced
 *     disclosure: imagine/image-prompt/describe), prompt field, bridge
 *     health badge
 *   - Kie: brief field, quality selector
 *
 * Bridge health probe:
 *   - Modal mount + provider===midjourney → GET /api/admin/midjourney/
 *     bridge/health
 *   - State badge: online/offline/session-required/degraded
 *   - Operator-actionable copy + Switch-to-Kie CTA
 *
 * Phase 62 tetiklenince BatchQueuePanel ComposePanel mode kaldırılır;
 * eski 440px inline form artık yok.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Loader2,
  Sparkles,
  X,
  WifiOff,
} from "lucide-react";
import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/cn";
import {
  PROVIDER_CAPABILITIES,
  getProviderCapability,
  resolveDefaultProvider,
  midjourneyModeRequirements,
  type ImageProviderUiId,
  type MidjourneyMode,
} from "@/features/variation-generation/provider-capabilities";

type DraftBatchItem = {
  id: string;
  position: number;
  reference: {
    id: string;
    asset: { id: string; sourceUrl: string | null } | null;
    bookmark: { title: string | null } | null;
    productType: { displayName: string } | null;
  };
};

type DraftBatch = {
  id: string;
  label: string | null;
  state: string;
  updatedAt: string;
  items: DraftBatchItem[];
};

type AspectRatio = "1:1" | "2:3" | "3:2";
type Quality = "medium" | "high";

const SIMILARITY_STOPS = ["Close", "Medium", "Loose", "Inspired"] as const;
const COST_PER_VARIATION_CENTS = 24;

/* Phase 62 — Mode hierarchy.
 * Reference-driven 3 mode operatör'ün canonical "similar generation"
 * intent'ine en uygun (sref/oref/cref); imagine/image-prompt/describe
 * advanced senaryolar (saf prompt-only, raw image-as-prompt, describe-
 * only). Default mode "sref" (Phase 60 baseline). */
const PROMINENT_MODES: ReadonlyArray<{
  id: MidjourneyMode;
  label: string;
  short: string;
}> = [
  { id: "sref", label: "Style reference", short: "--sref" },
  { id: "oref", label: "Object reference", short: "--oref" },
  { id: "cref", label: "Character reference", short: "--cref" },
];

const ADVANCED_MODES: ReadonlyArray<{
  id: MidjourneyMode;
  label: string;
  short: string;
}> = [
  { id: "imagine", label: "Pure /imagine", short: "/imagine" },
  { id: "image-prompt", label: "Image prompt", short: "Image prompt" },
  { id: "describe", label: "Describe (no generation)", short: "Describe" },
];

/* Bridge health typing (mirror of route response) */
type BridgeHealthState = "online" | "offline" | "session-required" | "degraded";
type BridgeHealthResponse = {
  ok: true;
  state: BridgeHealthState;
  summary: string;
  detail?: string;
  bridge: {
    version: string;
    driver: string;
    browserMode?: string;
    browserKind?: string;
    likelyLoggedIn: boolean;
    jobsQueued: number;
    jobsRunning: number;
    jobsBlocked: number;
  } | null;
};

interface BatchComposeSplitModalProps {
  batch: DraftBatch;
  open: boolean;
  onClose: () => void;
  onLaunchSuccess: (batchId: string) => void;
}

export function BatchComposeSplitModal({
  batch,
  open,
  onClose,
  onLaunchSuccess,
}: BatchComposeSplitModalProps) {
  const [providerId, setProviderId] = useState<ImageProviderUiId>(() =>
    resolveDefaultProvider(),
  );
  const [aspect, setAspect] = useState<AspectRatio>("2:3");
  const [similarity, setSimilarity] = useState<number>(1);
  const [count, setCount] = useState<number>(6);
  const [quality, setQuality] = useState<Quality>("medium");
  const [brief, setBrief] = useState<string>("");
  const [mjMode, setMjMode] = useState<MidjourneyMode>("sref");
  const [mjPrompt, setMjPrompt] = useState<string>("");
  const [showAdvancedModes, setShowAdvancedModes] = useState<boolean>(false);

  /* Phase 62 — Bridge health probe state */
  const [bridgeHealth, setBridgeHealth] =
    useState<BridgeHealthResponse | null>(null);
  const [bridgeHealthLoading, setBridgeHealthLoading] = useState<boolean>(false);

  const providerCap = getProviderCapability(providerId);
  const formFields = providerCap?.formFields;
  const supportsQuality =
    formFields?.showQuality === true &&
    (providerCap?.supportedQualities.length ?? 0) > 0;
  const isMidjourney = providerId === "midjourney";
  const mjReq = isMidjourney ? midjourneyModeRequirements(mjMode) : null;

  // Reference data
  const refCount = batch.items.length;
  const referencesWithoutPublicUrl = batch.items.filter(
    (item) => !item.reference.asset?.sourceUrl,
  ).length;
  const someReferencesUnreachable = referencesWithoutPublicUrl > 0;

  // Cost (Phase 61 baseline — describe ignores count, MJ bridge free)
  const isDescribe = isMidjourney && mjMode === "describe";
  const effectiveCount = isDescribe ? 1 : count;
  const totalGenerations = refCount * effectiveCount;
  const totalCostCents = isMidjourney
    ? 0
    : COST_PER_VARIATION_CENTS * totalGenerations;
  const totalCostUSD = (totalCostCents / 100).toFixed(2);
  const estMinutes = Math.max(1, Math.round(totalGenerations * 0.5));

  /* Bridge health fetch — only when MJ is selected, modal open. */
  useEffect(() => {
    if (!open || !isMidjourney) {
      setBridgeHealth(null);
      return;
    }
    let cancelled = false;
    setBridgeHealthLoading(true);
    fetch("/api/admin/midjourney/bridge/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: BridgeHealthResponse) => {
        if (!cancelled) setBridgeHealth(j);
      })
      .catch(() => {
        if (!cancelled) {
          setBridgeHealth({
            ok: true,
            state: "offline",
            summary: "Bridge probe failed",
            bridge: null,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setBridgeHealthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isMidjourney]);

  /* Escape close + focus management */
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !launchMutation.isPending) onClose();
    };
    window.addEventListener("keydown", handler);
    closeBtnRef.current?.focus();
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
          ...(brief.trim() ? { brief: brief.trim() } : {}),
          ...(isMidjourney
            ? {
                mjMode,
                ...(mjPrompt.trim() && mjMode !== "describe"
                  ? { mjPrompt: mjPrompt.trim() }
                  : {}),
              }
            : {}),
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
        state: string;
        designIds: string[];
        failedDesignIds: string[];
        perReference: Array<{
          referenceId: string;
          designIds: string[];
          failedDesignIds: string[];
          error?: string;
        }>;
      };
    },
    onSuccess: (result) => {
      // Phase 49 — sessionStorage one-shot launch outcome
      try {
        const successRefs = result.perReference.filter(
          (r) => r.designIds.length > 0,
        ).length;
        const skippedRefs = result.perReference.filter(
          (r) => r.error && r.designIds.length === 0,
        ).length;
        const failedRefs = result.perReference.filter(
          (r) => r.error || r.failedDesignIds.length > 0,
        ).length;
        window.sessionStorage.setItem(
          `kivasy.launchOutcome.${result.batchId}`,
          JSON.stringify({
            ts: Date.now(),
            state: result.state,
            totalRefs: result.perReference.length,
            totalDesigns: result.designIds.length,
            totalFailed: result.failedDesignIds.length,
            successRefs,
            skippedRefs,
            failedRefs,
            perReference: result.perReference,
            composeParams: {
              count,
              aspectRatio: aspect,
              quality: supportsQuality ? quality : null,
              providerId,
              ...(isMidjourney ? { mjMode, mjPrompt } : {}),
            },
          }),
        );
      } catch {
        /* sessionStorage disabled — silent */
      }
      onLaunchSuccess(result.batchId);
    },
  });

  const hasItems = batch.items.length > 0;
  const launchDisabled =
    !hasItems ||
    someReferencesUnreachable ||
    !providerCap?.available ||
    launchMutation.isPending;

  if (!open) return null;

  // Mode for active picker (auto-toggle advanced if mjMode is in advanced set)
  const modeIsInAdvanced = ADVANCED_MODES.some((m) => m.id === mjMode);
  const advancedExpanded = showAdvancedModes || modeIsInAdvanced;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-compose-modal-title"
      data-testid="batch-compose-split-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !launchMutation.isPending) {
          onClose();
        }
      }}
    >
      <div
        className="flex max-h-[820px] w-full max-w-[1080px] flex-col overflow-hidden rounded-xl border border-line bg-paper shadow-popover"
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-line bg-paper px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2
              id="batch-compose-modal-title"
              className="truncate text-[16px] font-semibold text-ink"
            >
              Create Similar
            </h2>
            <p className="mt-0.5 truncate font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              Draft · {batch.label ?? "Untitled batch"} · {refCount}{" "}
              reference{refCount === 1 ? "" : "s"}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            disabled={launchMutation.isPending}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-k-bg hover:text-ink disabled:opacity-50"
            aria-label="Close compose"
            data-testid="batch-compose-modal-close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        {/* Body — split: rail (left) + form (right) */}
        <div className="flex flex-1 overflow-hidden">
          {/* Source reference rail */}
          <aside
            className="w-72 flex-shrink-0 overflow-y-auto border-r border-line-soft bg-k-bg-2/30 p-4"
            data-testid="batch-compose-modal-rail"
          >
            <div className="mb-3 font-mono text-[10px] uppercase tracking-meta text-ink-3">
              Source references
            </div>
            <ul className="flex flex-col gap-2">
              {batch.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-md border border-line-soft bg-paper p-2"
                  data-testid="batch-compose-modal-rail-item"
                  data-reference-id={item.reference.id}
                >
                  <div className="k-thumb !aspect-square !w-12 flex-shrink-0 overflow-hidden rounded-md">
                    {item.reference.asset ? (
                      <AssetImage
                        assetId={item.reference.asset.id}
                        alt={item.reference.bookmark?.title ?? "Reference"}
                        frame={false}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-3">
                        —
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium leading-tight text-ink">
                      {item.reference.bookmark?.title ?? "Untitled"}
                    </div>
                    {item.reference.productType ? (
                      <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-meta text-ink-3">
                        {item.reference.productType.displayName}
                      </div>
                    ) : null}
                    {!item.reference.asset?.sourceUrl ? (
                      <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-meta text-k-amber">
                        <AlertTriangle className="h-2 w-2" aria-hidden />
                        local-only
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          {/* Form body */}
          <div
            className="flex-1 overflow-y-auto px-6 py-5"
            data-testid="batch-compose-modal-form"
          >
            <div className="space-y-6">
              {/* Provider */}
              <Section label="Provider">
                <select
                  value={providerId}
                  onChange={(e) =>
                    setProviderId(e.target.value as ImageProviderUiId)
                  }
                  className="h-9 w-full rounded-md border border-line bg-paper px-3 text-[13px] text-ink"
                  data-testid="batch-compose-modal-provider"
                  data-provider={providerId}
                >
                  {PROVIDER_CAPABILITIES.map((p) => (
                    <option key={p.id} value={p.id} disabled={!p.available}>
                      {p.label}
                      {p.available ? "" : " — coming soon"}
                    </option>
                  ))}
                </select>
                {/* Phase 62 — Bridge health badge for Midjourney */}
                {isMidjourney ? (
                  <BridgeHealthBadge
                    loading={bridgeHealthLoading}
                    health={bridgeHealth}
                    onSwitchToKie={() => setProviderId("kie-gpt-image-1.5")}
                  />
                ) : null}
              </Section>

              {/* Phase 62 — Mode picker with hierarchy (Midjourney only) */}
              {isMidjourney && formFields?.showModeSelector ? (
                <Section
                  label="Generation mode"
                  hint={mjReq?.hint}
                >
                  <div
                    className="k-segment"
                    role="group"
                    aria-label="Reference-driven mode"
                    data-testid="batch-compose-modal-mj-prominent"
                  >
                    {PROMINENT_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={mjMode === m.id}
                        onClick={() => setMjMode(m.id)}
                        data-testid="batch-compose-modal-mj-mode"
                        data-mode={m.id}
                        data-tier="prominent"
                      >
                        {m.short}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedModes((s) => !s)}
                    className="mt-2 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-meta text-ink-3 transition-colors hover:text-ink-2"
                    data-testid="batch-compose-modal-mj-advanced-toggle"
                    aria-expanded={advancedExpanded}
                  >
                    {advancedExpanded ? (
                      <ChevronUp className="h-3 w-3" aria-hidden />
                    ) : (
                      <ChevronDown className="h-3 w-3" aria-hidden />
                    )}
                    {advancedExpanded ? "Hide advanced" : "More modes"}
                  </button>
                  {advancedExpanded ? (
                    <div
                      className="k-segment mt-2"
                      role="group"
                      aria-label="Advanced mode"
                      data-testid="batch-compose-modal-mj-advanced"
                    >
                      {ADVANCED_MODES.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          aria-pressed={mjMode === m.id}
                          onClick={() => setMjMode(m.id)}
                          data-testid="batch-compose-modal-mj-mode"
                          data-mode={m.id}
                          data-tier="advanced"
                        >
                          {m.short}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </Section>
              ) : null}

              {/* Prompt — Midjourney-aware */}
              {isMidjourney && formFields?.showPrompt ? (
                <Section
                  label="Prompt"
                  hint={
                    mjReq?.promptDisabled
                      ? "Disabled in describe mode"
                      : mjReq?.promptRequired
                        ? "Required"
                        : "Optional · recommended"
                  }
                >
                  <textarea
                    value={mjPrompt}
                    onChange={(e) =>
                      setMjPrompt(e.target.value.slice(0, 800))
                    }
                    rows={3}
                    disabled={mjReq?.promptDisabled === true}
                    placeholder={
                      mjMode === "describe"
                        ? "Describe doesn't take a prompt — only the reference is sent."
                        : mjMode === "sref" || mjMode === "oref" || mjMode === "cref"
                          ? "e.g., 'soft floral wreath, nursery wall art, watercolor'"
                          : "e.g., 'boho line art bundle, beige palette, minimalist'"
                    }
                    className={cn(
                      "w-full resize-none rounded-md border border-line bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-3",
                      mjReq?.promptDisabled && "opacity-50",
                    )}
                    data-testid="batch-compose-modal-mj-prompt"
                  />
                </Section>
              ) : null}

              {/* Aspect ratio */}
              <Section label="Aspect ratio">
                <div className="flex gap-2">
                  {(["1:1", "3:2", "2:3"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAspect(a)}
                      className={cn(
                        "h-10 flex-1 rounded-md border text-[12.5px] font-medium transition-colors",
                        aspect === a
                          ? "border-k-orange bg-k-orange-soft text-k-orange-ink"
                          : "border-line bg-paper text-ink-2 hover:border-line-strong",
                      )}
                      data-testid="batch-compose-modal-aspect"
                      data-aspect={a}
                      data-active={aspect === a || undefined}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Similarity */}
              <Section label="Similarity" hint={SIMILARITY_STOPS[similarity]}>
                <div className="flex">
                  {SIMILARITY_STOPS.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSimilarity(i)}
                      className={cn(
                        "-ml-px h-10 flex-1 border border-line text-[12px] font-medium transition-colors first:ml-0 first:rounded-l-md last:rounded-r-md",
                        i === similarity
                          ? "z-10 relative border-k-orange bg-k-orange-soft text-k-orange-ink"
                          : "bg-paper text-ink-2 hover:border-line-strong",
                      )}
                      data-testid="batch-compose-modal-similarity"
                      data-active={i === similarity || undefined}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Count */}
              {formFields?.showCount && !isDescribe ? (
                <Section label="Count">
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
                        data-testid="batch-compose-modal-count-stop"
                        data-active={n === count || undefined}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </Section>
              ) : null}

              {/* Quality */}
              {supportsQuality ? (
                <Section label="Quality">
                  <div className="flex">
                    {(["medium", "high"] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuality(q)}
                        className={cn(
                          "-ml-px h-10 flex-1 border border-line text-[12.5px] font-medium capitalize transition-colors first:ml-0 first:rounded-l-md last:rounded-r-md",
                          q === quality
                            ? "z-10 relative border-k-orange bg-k-orange-soft text-k-orange-ink"
                            : "bg-paper text-ink-2 hover:border-line-strong",
                        )}
                        data-testid="batch-compose-modal-quality"
                        data-active={q === quality || undefined}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </Section>
              ) : null}

              {/* Brief (Kie) */}
              {formFields?.showBrief ? (
                <Section label="Brief" hint="Optional · max 500 chars">
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value.slice(0, 500))}
                    rows={3}
                    placeholder="Optional style note — e.g., 'soft pastel palette' or 'add line art accents'"
                    className="w-full resize-none rounded-md border border-line bg-paper px-3 py-2 text-[13px] text-ink placeholder:text-ink-3"
                    data-testid="batch-compose-modal-brief"
                  />
                </Section>
              ) : null}

              {someReferencesUnreachable ? (
                <div
                  className="flex items-start gap-2 rounded-md border border-line-soft bg-k-bg-2/40 px-3 py-2 text-[12px] text-ink"
                  data-testid="batch-compose-modal-url-warning"
                >
                  <span
                    className="mt-1 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-k-amber"
                    aria-hidden
                  />
                  <span className="text-ink-2">
                    {referencesWithoutPublicUrl === refCount
                      ? "All "
                      : `${referencesWithoutPublicUrl} of ${refCount} `}
                    {referencesWithoutPublicUrl === 1 && refCount !== 1
                      ? "reference is"
                      : "references are"}{" "}
                    local-only. AI launch needs URL-sourced references —{" "}
                    remove the local items from the draft to launch the rest.
                  </span>
                </div>
              ) : null}

              {launchMutation.isError ? (
                <div
                  role="alert"
                  className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-[12.5px] text-danger"
                  data-testid="batch-compose-modal-error"
                >
                  {(launchMutation.error as Error).message}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 border-t border-line bg-paper px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={launchMutation.isPending}
            className="k-btn k-btn--ghost"
            data-size="sm"
            data-testid="batch-compose-modal-cancel"
          >
            Cancel
          </button>
          <div className="flex items-center gap-4">
            <span
              className="font-mono text-[11px] text-ink-3"
              data-testid="batch-compose-modal-cost"
            >
              {isMidjourney
                ? isDescribe
                  ? `${refCount} describe${refCount === 1 ? "" : "s"} · bridge (free)`
                  : `${totalGenerations} gen${totalGenerations === 1 ? "" : "s"} · bridge (free) · est. ${estMinutes}m`
                : `${refCount > 1 ? `${totalGenerations} gens · ` : ""}~$${totalCostUSD} · est. ${estMinutes}m`}
            </span>
            <button
              type="button"
              className="k-btn k-btn--primary"
              data-size="sm"
              disabled={launchDisabled}
              onClick={() => launchMutation.mutate()}
              data-testid="batch-compose-modal-launch"
              title={
                isDescribe
                  ? "Describe pipeline returns prompt suggestions (no generation)."
                  : undefined
              }
            >
              <Sparkles className="h-3 w-3" aria-hidden />
              {launchMutation.isPending
                ? "Launching…"
                : isDescribe
                  ? `Describe ${refCount} reference${refCount === 1 ? "" : "s"}`
                  : refCount > 1
                    ? `Create Similar · ${refCount} × ${count}`
                    : `Create Similar · ${count}`}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ---------------- Bridge health badge ---------------- */

function BridgeHealthBadge({
  loading,
  health,
  onSwitchToKie,
}: {
  loading: boolean;
  health: BridgeHealthResponse | null;
  onSwitchToKie: () => void;
}) {
  if (loading) {
    return (
      <div
        className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-k-bg-2/40 px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3"
        data-testid="batch-compose-modal-bridge-health"
        data-state="loading"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Probing bridge…
      </div>
    );
  }
  if (!health) return null;

  const tone =
    health.state === "online"
      ? "success"
      : health.state === "degraded"
        ? "warning"
        : health.state === "session-required"
          ? "warning"
          : "danger";
  const Icon =
    health.state === "online"
      ? CircleCheck
      : health.state === "offline"
        ? WifiOff
        : CircleAlert;

  const showSwitch = health.state !== "online";

  return (
    <div
      className={cn(
        "mt-2 rounded-md border px-3 py-2 text-[12px]",
        tone === "success" && "border-success/40 bg-success-soft",
        tone === "warning" && "border-warning/40 bg-warning-soft/40",
        tone === "danger" && "border-danger/40 bg-danger/5",
      )}
      data-testid="batch-compose-modal-bridge-health"
      data-state={health.state}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            tone === "success" && "text-success",
            tone === "warning" && "text-warning",
            tone === "danger" && "text-danger",
          )}
          aria-hidden
        />
        <span
          className={cn(
            "font-mono text-[10.5px] font-semibold uppercase tracking-meta",
            tone === "success" && "text-success",
            tone === "warning" && "text-warning",
            tone === "danger" && "text-danger",
          )}
        >
          {health.summary}
        </span>
      </div>
      {health.detail ? (
        <p className="mt-1 text-[11.5px] leading-snug text-ink-2">
          {health.detail}
        </p>
      ) : null}
      {showSwitch ? (
        <button
          type="button"
          onClick={onSwitchToKie}
          className="mt-1.5 inline-flex h-6 items-center gap-1 rounded-md border border-line bg-paper px-2 font-mono text-[10px] uppercase tracking-meta text-ink-2 hover:border-line-strong hover:text-ink"
          data-testid="batch-compose-modal-bridge-switch-kie"
        >
          Switch to Kie · GPT Image 1.5 →
        </button>
      ) : null}
    </div>
  );
}

/* ---------------- Section primitive (v4 A6 parity) ---------------- */

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
      <div className="mb-2 flex items-baseline justify-between gap-3">
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
