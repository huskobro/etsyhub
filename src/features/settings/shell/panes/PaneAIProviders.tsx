/* eslint-disable no-restricted-syntax */
// PaneAIProviders — Kivasy v7 D1 AI Providers pane. v7/v6 sabit boyutlar:
//  · max-w-[920px] pane container
//  · k-display text-[26px] pane title + ADMIN · WORKSPACE DEFAULTS badge
//  · 4-column stat row (DAILY/MONTHLY/ACTIVE/FAILED) + provider card list
//  · Provider card: 40px mono badge + status badge + masked key + collapsible
//    task defaults + spend limits.
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

/**
 * PaneAIProviders — D1 surface (workspace AI provider config).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v7/screens-d.jsx →
 * D1Providers + PaneAIProviders + ProviderCard.
 *
 * Status (R10):
 *   - KIE + Gemini key persistence: live (UserSetting key=aiMode encrypted).
 *   - Cost summary: live (CostUsage aggregation; daily/monthly/active/
 *     failed24h).
 *   - Spend limits: persisted (UserSetting key=aiProviders) AND enforced
 *     in variation + listing-copy call paths via assertWithinBudget.
 *   - Task assignments: persisted; resolveTaskModel feeds variation
 *     pipeline pre-flight (worker call still uses providerKey, model
 *     selection lands in R12 provider registry granularity).
 *   - OpenAI / Fal.ai / Replicate / Recraft: schema not yet wired
 *     (R12 provider integration pass).
 *
 * Boundary discipline:
 *   Per-user key override caption visible (workspace defaults first
 *   principle); admin-scope writes for taskAssignments / spendLimits.
 */

interface AiModeMaskedSettings {
  kieApiKey: string | null;
  geminiApiKey: string | null;
  reviewProvider: "kie" | "google-gemini";
}

type ProviderTone = "warm" | "blue" | "ink" | "purple";
type StatusTone = "success" | "warning" | "danger";

type DefaultsMap = Partial<{
  variation: { model: string; cost: string };
  review: { model: string; cost: string };
  listingCopy: { model: string; cost: string };
  bgRemoval: { model: string; cost: string };
  mockup: { model: string; cost: string };
}>;

interface ProviderRow {
  id: string;
  name: string;
  mono: string;
  tone: ProviderTone;
  status: { tone: StatusTone; label: string };
  keyMasked: string;
  keyEmptyHint?: string;
  lastSuccess: string | null;
  lastError: string | null;
  defaults: DefaultsMap | null;
  partial?: boolean;
  authFailed?: boolean;
  dailyLimit: number;
  monthlyLimit: number;
}

const QUERY_KEY = ["settings", "ai-mode"] as const;

interface CostSummaryView {
  dailySpendCents: number;
  monthlySpendCents: number;
  activeProviderCount: number;
  failedCalls24h: number;
}

type TaskKey =
  | "variation"
  | "review"
  | "listingCopy"
  | "bgRemoval"
  | "mockup";

interface ProviderSpendLimit {
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
}

interface AdminProvidersSettings {
  spendLimits: Record<string, ProviderSpendLimit>;
  taskAssignments: Record<TaskKey, string>;
}

const DEFAULT_ADMIN_SETTINGS: AdminProvidersSettings = {
  spendLimits: {
    kie: { dailyLimitUsd: 50, monthlyLimitUsd: 800 },
    gemini: { dailyLimitUsd: 30, monthlyLimitUsd: 400 },
  },
  taskAssignments: {
    variation: "kie/midjourney-v7",
    review: "kie/qc-vision-2",
    listingCopy: "kie/copy-flash",
    bgRemoval: "kie/cutout-v2",
    mockup: "kie/compose-pro",
  },
};

// Per-task model options — UI dropdown için.
const TASK_MODEL_OPTIONS: Record<TaskKey, string[]> = {
  variation: [
    "kie/midjourney-v7",
    "fal-ai/flux-pro-1.1",
    "openai/gpt-image-1",
    "replicate/sdxl",
  ],
  review: [
    "kie/qc-vision-2",
    "google/gemini-2.0-flash",
    "openai/gpt-4o-mini",
  ],
  listingCopy: [
    "kie/copy-flash",
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
  ],
  bgRemoval: [
    "kie/cutout-v2",
    "replicate/rembg-v2",
    "fal-ai/birefnet",
  ],
  mockup: [
    "kie/compose-pro",
    "replicate/sdxl-controlnet",
    "fal-ai/flux-canny",
  ],
};

export function PaneAIProviders() {
  // R11.5 — explicit staleTime + retry sınırları: query takılmasını engeller,
  // dev HMR sırasında stale cache fetch loop'unu açıkça kapatır.
  const aiModeQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<{ settings: AiModeMaskedSettings }> => {
      const r = await fetch("/api/settings/ai-mode");
      if (!r.ok) throw new Error("AI Providers settings yüklenemedi");
      return r.json();
    },
    staleTime: 30 * 1000,
    retry: 1,
  });

  const costQuery = useQuery<{ summary: CostSummaryView }>({
    queryKey: ["settings", "cost-summary"],
    queryFn: async () => {
      const r = await fetch("/api/settings/cost-summary");
      if (!r.ok) throw new Error("Cost summary yüklenemedi");
      return r.json();
    },
    staleTime: 60 * 1000,
    retry: 1,
  });

  // R8 — admin scope spend limits + task assignments
  const adminQuery = useQuery<{ settings: AdminProvidersSettings }>({
    queryKey: ["settings", "ai-providers"],
    queryFn: async () => {
      const r = await fetch("/api/settings/ai-providers");
      if (r.status === 403) {
        // Non-admin user → silent fallback to defaults
        return { settings: DEFAULT_ADMIN_SETTINGS };
      }
      if (!r.ok) throw new Error("Admin AI providers settings yüklenemedi");
      return r.json();
    },
    staleTime: 30 * 1000,
    retry: false,
  });

  const qc = useQueryClient();
  const adminMutation = useMutation<
    { settings: AdminProvidersSettings },
    Error,
    Partial<AdminProvidersSettings>
  >({
    mutationFn: async (patch) => {
      const r = await fetch("/api/settings/ai-providers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "ai-providers"] });
    },
  });

  const adminSettings = adminQuery.data?.settings ?? DEFAULT_ADMIN_SETTINGS;

  const providers = useMemo<ProviderRow[]>(() => {
    const masked = aiModeQuery.data?.settings;
    const kieKey = masked?.kieApiKey;
    const geminiKey = masked?.geminiApiKey;
    const reviewProvider = masked?.reviewProvider ?? "kie";
    const limits = adminSettings.spendLimits;

    const rows: ProviderRow[] = [
      {
        id: "kie",
        name: "KIE",
        mono: "K",
        tone: "warm",
        status: kieKey
          ? { tone: "success", label: "CONNECTED" }
          : { tone: "warning", label: "KEY MISSING" },
        keyMasked: kieKey ?? "",
        keyEmptyHint: kieKey
          ? undefined
          : "Add an API key to enable KIE for variation + review",
        lastSuccess: kieKey ? "minutes ago" : null,
        lastError: null,
        defaults: kieKey
          ? {
              variation: { model: "kie/midjourney-v7", cost: "$0.024" },
              review:
                reviewProvider === "kie"
                  ? { model: "kie/qc-vision-2", cost: "$0.008" }
                  : { model: "—", cost: "—" },
              listingCopy: { model: "kie/copy-flash", cost: "$0.002" },
              bgRemoval: { model: "kie/cutout-v2", cost: "$0.004" },
              mockup: { model: "kie/compose-pro", cost: "$0.012" },
            }
          : null,
        dailyLimit: limits.kie?.dailyLimitUsd ?? 50,
        monthlyLimit: limits.kie?.monthlyLimitUsd ?? 800,
      },
      {
        id: "gemini",
        name: "Google Gemini",
        mono: "G",
        tone: "blue",
        status: geminiKey
          ? { tone: "success", label: "CONNECTED" }
          : { tone: "warning", label: "KEY MISSING" },
        keyMasked: geminiKey ?? "",
        keyEmptyHint: geminiKey
          ? undefined
          : "Add an API key to use Google Gemini for review or copy",
        lastSuccess:
          geminiKey && reviewProvider === "google-gemini" ? "5m ago" : null,
        lastError: null,
        defaults:
          geminiKey && reviewProvider === "google-gemini"
            ? {
                review: { model: "google/gemini-2.0-flash", cost: "$0.001" },
              }
            : null,
        partial: !!geminiKey && reviewProvider !== "google-gemini",
        dailyLimit: limits.gemini?.dailyLimitUsd ?? 30,
        monthlyLimit: limits.gemini?.monthlyLimitUsd ?? 400,
      },
      {
        id: "openai",
        name: "OpenAI",
        mono: "O",
        tone: "ink",
        status: { tone: "warning", label: "KEY MISSING" },
        keyMasked: "",
        keyEmptyHint:
          "OpenAI provider integration ships in R12",
        lastSuccess: null,
        lastError: null,
        defaults: null,
        dailyLimit: 0,
        monthlyLimit: 0,
      },
      {
        id: "fal",
        name: "Fal.ai",
        mono: "F",
        tone: "blue",
        status: { tone: "warning", label: "KEY MISSING" },
        keyMasked: "",
        keyEmptyHint: "Fal.ai integration ships in R12",
        lastSuccess: null,
        lastError: null,
        defaults: null,
        dailyLimit: 0,
        monthlyLimit: 0,
      },
      {
        id: "replicate",
        name: "Replicate",
        mono: "R",
        tone: "ink",
        status: { tone: "warning", label: "KEY MISSING" },
        keyMasked: "",
        keyEmptyHint: "Replicate integration ships in R12",
        lastSuccess: null,
        lastError: null,
        defaults: null,
        dailyLimit: 0,
        monthlyLimit: 0,
      },
      {
        id: "recraft",
        name: "Recraft",
        mono: "Rc",
        tone: "purple",
        status: { tone: "warning", label: "KEY MISSING" },
        keyMasked: "",
        keyEmptyHint: "Recraft integration ships in R12",
        lastSuccess: null,
        lastError: null,
        defaults: null,
        dailyLimit: 0,
        monthlyLimit: 0,
      },
    ];
    return rows;
  }, [aiModeQuery.data, adminSettings]);

  const activeCount = providers.filter(
    (p) => p.status.label === "CONNECTED",
  ).length;
  const totalCount = providers.length;

  // R11.5 — loading watchdog: 8s'den uzun süredir fetching ise kullanıcıya
  // retry CTA göster. Loading state sonsuz takılmasın; pane "ölü" hissetmesin.
  const isInitialLoad = aiModeQuery.isLoading && !aiModeQuery.data;
  const [showRetry, setShowRetry] = useState(false);
  useEffect(() => {
    if (!isInitialLoad) {
      setShowRetry(false);
      return;
    }
    const t = setTimeout(() => setShowRetry(true), 8000);
    return () => clearTimeout(t);
  }, [isInitialLoad]);

  if (aiModeQuery.error) {
    return (
      <div className="max-w-[920px] px-10 py-9">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          AI Providers
        </h2>
        <div
          role="alert"
          className="mt-8 rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden />
          {(aiModeQuery.error as Error).message ??
            "AI provider settings yüklenemedi"}
          <button
            type="button"
            onClick={() => aiModeQuery.refetch()}
            className="ml-3 inline-flex h-6 items-center rounded-md border border-danger bg-paper px-2 text-[11px] font-medium text-danger hover:bg-danger-soft"
          >
            <RotateCw className="mr-1 h-3 w-3" aria-hidden />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isInitialLoad) {
    return (
      <div className="max-w-[920px] px-10 py-9">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          AI Providers
        </h2>
        <div className="mt-8 flex items-center gap-2 text-sm text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading provider settings…
        </div>
        {showRetry ? (
          <div className="mt-3 rounded-md border border-line bg-paper px-4 py-3 text-[12px] text-ink-2">
            Still loading after a few seconds — the API may be slow or
            offline.
            <button
              type="button"
              onClick={() => aiModeQuery.refetch()}
              className="ml-3 inline-flex h-7 items-center rounded-md border border-line bg-paper px-2 text-[11px] font-medium text-ink hover:border-line-strong"
              data-testid="ai-providers-loading-retry"
            >
              <RotateCw className="mr-1 h-3 w-3" aria-hidden />
              Retry
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-[920px] px-10 py-9">
      {/* Header */}
      <div className="mb-1 flex items-start justify-between gap-4">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          AI Providers
        </h2>
        <Badge tone="warning">ADMIN · WORKSPACE DEFAULTS</Badge>
      </div>
      <p className="mb-2 text-[13px] text-ink-2">
        Provider keys, default models per task type, and spend ceilings.
        Applies workspace-wide.
      </p>
      <p className="mb-7 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        Per-user keys override workspace defaults · Manage your personal keys
        in Preferences → Workspace (live)
      </p>

      {/* 4-column stat row — R7 real backing via /api/settings/cost-summary */}
      <div className="mb-7 grid grid-cols-2 divide-line-soft rounded-md border border-line bg-paper md:grid-cols-4 md:divide-x">
        <Stat
          label="DAILY SPEND"
          value={dollar(costQuery.data?.summary.dailySpendCents)}
          meta="of $50 limit"
          pct={(costQuery.data?.summary.dailySpendCents ?? 0) / 100 / 50}
        />
        <Stat
          label="MONTHLY SPEND"
          value={dollar(costQuery.data?.summary.monthlySpendCents)}
          meta="of $800 limit"
          pct={(costQuery.data?.summary.monthlySpendCents ?? 0) / 100 / 800}
        />
        <Stat
          label="ACTIVE PROVIDERS"
          value={String(costQuery.data?.summary.activeProviderCount ?? activeCount)}
          meta={`of ${totalCount}`}
        />
        <Stat
          label="FAILED CALLS · 24H"
          value={String(costQuery.data?.summary.failedCalls24h ?? 0)}
          meta={
            costQuery.data?.summary.failedCalls24h
              ? "FAILED job count last 24h"
              : "no failures in 24h"
          }
          tone={
            (costQuery.data?.summary.failedCalls24h ?? 0) > 0 ? "danger" : "ink"
          }
        />
      </div>

      <div className="space-y-3" data-testid="ai-providers-list">
        {providers.map((p) => (
          <ProviderCard key={p.id} provider={p} />
        ))}
      </div>

      {/* R8 — workspace task assignments + spend limits persist */}
      <div className="mt-7 overflow-hidden rounded-md border border-line bg-paper">
        <div className="border-b border-line-soft px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          Workspace task assignments (admin · persisted)
        </div>
        <div className="divide-y divide-line-soft">
          {(["variation", "review", "listingCopy", "bgRemoval", "mockup"] as const).map(
            (task) => {
              const current = adminSettings.taskAssignments[task];
              const options = TASK_MODEL_OPTIONS[task];
              return (
                <div
                  key={task}
                  className="flex items-center gap-3 px-4 py-3"
                  data-testid="ai-providers-task-assignment"
                  data-task={task}
                >
                  <span className="flex-1 text-[12.5px] text-ink">
                    {TASK_LABEL_MAP[task]}
                  </span>
                  <select
                    value={current}
                    onChange={(e) =>
                      adminMutation.mutate({
                        taskAssignments: {
                          ...adminSettings.taskAssignments,
                          [task]: e.target.value,
                        },
                      })
                    }
                    className="h-8 w-[260px] rounded-md border border-line bg-paper px-2 font-mono text-[11.5px] text-ink-2 focus:border-k-orange focus:outline-none focus:ring-1 focus:ring-k-orange-soft"
                  >
                    {options.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    {!options.includes(current) ? (
                      <option value={current}>{current} (custom)</option>
                    ) : null}
                  </select>
                </div>
              );
            },
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 border-t border-line-soft px-4 py-3 md:grid-cols-2">
          <SpendLimitsRow
            providerId="kie"
            label="KIE limits (USD)"
            current={
              adminSettings.spendLimits.kie ?? {
                dailyLimitUsd: 50,
                monthlyLimitUsd: 800,
              }
            }
            onSave={(v) =>
              adminMutation.mutate({
                spendLimits: { ...adminSettings.spendLimits, kie: v },
              })
            }
          />
          <SpendLimitsRow
            providerId="gemini"
            label="Gemini limits (USD)"
            current={
              adminSettings.spendLimits.gemini ?? {
                dailyLimitUsd: 30,
                monthlyLimitUsd: 400,
              }
            }
            onSave={(v) =>
              adminMutation.mutate({
                spendLimits: { ...adminSettings.spendLimits, gemini: v },
              })
            }
          />
        </div>
      </div>

      <p className="mt-4 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        {adminMutation.isPending
          ? "Saving assignments…"
          : adminMutation.isError
            ? `Save failed: ${adminMutation.error?.message}`
            : adminQuery.isFetching && !adminQuery.data
              ? "Loading workspace assignments…"
              : "Assignments persist via UserSetting key=aiProviders · variation+listingCopy enforcement live"}
      </p>
    </div>
  );
}

const TASK_LABEL_MAP: Record<TaskKey, string> = {
  variation: "Variation generation",
  review: "Quality review",
  listingCopy: "Listing copy generation",
  bgRemoval: "Background removal",
  mockup: "Mockup composition",
};

function SpendLimitsRow({
  providerId,
  label,
  current,
  onSave,
}: {
  providerId: string;
  label: string;
  current: ProviderSpendLimit;
  onSave: (v: ProviderSpendLimit) => void;
}) {
  const [daily, setDaily] = useState(current.dailyLimitUsd);
  const [monthly, setMonthly] = useState(current.monthlyLimitUsd);
  return (
    <div data-testid="ai-providers-spend-limits" data-provider={providerId}>
      <div className="mb-1 text-[12px] font-medium text-ink">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={2000}
          value={daily}
          onChange={(e) => setDaily(parseInt(e.target.value || "0", 10))}
          onBlur={() => onSave({ dailyLimitUsd: daily, monthlyLimitUsd: monthly })}
          className="h-8 w-20 rounded-md border border-line bg-paper px-2 text-xs tabular-nums text-ink"
        />
        <span className="font-mono text-[10.5px] text-ink-3">/ day</span>
        <input
          type="number"
          min={0}
          max={20000}
          value={monthly}
          onChange={(e) => setMonthly(parseInt(e.target.value || "0", 10))}
          onBlur={() => onSave({ dailyLimitUsd: daily, monthlyLimitUsd: monthly })}
          className="h-8 w-24 rounded-md border border-line bg-paper px-2 text-xs tabular-nums text-ink"
        />
        <span className="font-mono text-[10.5px] text-ink-3">/ month</span>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  meta,
  pct,
  tone = "ink",
}: {
  label: string;
  value: string;
  meta: string;
  pct?: number;
  tone?: "ink" | "danger";
}) {
  return (
    <div className="px-5 py-4">
      <div className="font-mono text-[9.5px] uppercase tracking-meta text-ink-3">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={cn(
            "text-[20px] font-semibold tabular-nums",
            tone === "danger" ? "text-k-red" : "text-ink",
          )}
        >
          {value}
        </span>
        <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
          {meta}
        </span>
      </div>
      {pct !== undefined ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line-soft">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct > 0.8 ? "bg-k-red" : "bg-k-orange",
            )}
            style={{ width: `${Math.max(2, Math.min(100, pct * 100))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

const TONE_GRADIENT: Record<ProviderTone, string> = {
  warm: "bg-gradient-to-br from-[#E89B5B] to-[#8E3A12]",
  blue: "bg-gradient-to-br from-[#5B9BD5] to-[#1E4F7B]",
  ink: "bg-gradient-to-br from-[#4A4640] to-[#16130F]",
  purple: "bg-gradient-to-br from-[#8A60C9] to-[#4A2E7A]",
};

function ProviderCard({ provider: p }: { provider: ProviderRow }) {
  const [revealKey, setRevealKey] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(p.id === "kie");
  // R11.6 — KIE + Gemini gerçek provider'lar (key persistence + disconnect
  // canlı). Diğer 4 provider hâlâ R12 scope'unda; placeholder davranışta kalır.
  const isEditable = p.id === "kie" || p.id === "gemini";
  const [keyDraft, setKeyDraft] = useState("");
  const qc = useQueryClient();
  const keyMutation = useMutation<
    { settings: AiModeMaskedSettings },
    Error,
    "save" | "disconnect"
  >({
    mutationFn: async (action) => {
      const field = p.id === "kie" ? "kieApiKey" : "geminiApiKey";
      const otherField = p.id === "kie" ? "geminiApiKey" : "kieApiKey";
      const body: Record<string, unknown> = {
        [otherField]: "", // boş string = preserve diğer key'i
      };
      if (action === "save") {
        if (!keyDraft.trim()) {
          throw new Error("API key boş olamaz");
        }
        body[field] = keyDraft.trim();
      } else {
        // disconnect → null sentinel (backend explicit clear)
        body[field] = null;
      }
      const r = await fetch("/api/settings/ai-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      setKeyDraft("");
      // Üst seviye query'i invalide et — R8'de QUERY_KEY=["settings","ai-mode"]
      qc.invalidateQueries({ queryKey: ["settings", "ai-mode"] });
    },
  });
  const isMissing = p.status.label === "KEY MISSING";
  const isFailed = !!p.authFailed;

  return (
    <div
      className="overflow-hidden rounded-md border border-line bg-paper"
      data-testid="ai-provider-card"
      data-provider-id={p.id}
      data-provider-status={p.status.label}
    >
      {/* Header row */}
      <div className="flex items-center gap-4 border-b border-line-soft p-5">
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-semibold text-white",
            TONE_GRADIENT[p.tone],
          )}
          aria-hidden
        >
          {p.mono}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <div className="text-[15px] font-semibold tracking-tight text-ink">
              {p.name}
            </div>
            <Badge tone={p.status.tone} dot>
              {p.status.label}
            </Badge>
            {p.partial ? (
              <span className="font-mono text-[9.5px] uppercase tracking-meta text-ink-3">
                PARTIAL DEFAULTS
              </span>
            ) : null}
          </div>
          <div className="font-mono text-[11px] tracking-wider text-ink-3">
            {isMissing
              ? "no key configured"
              : p.lastSuccess
                ? `last success ${p.lastSuccess}`
                : "no recent activity"}
            {p.lastError ? (
              <span className="ml-2 text-k-red">
                · last error: {p.lastError}
              </span>
            ) : null}
          </div>
        </div>
        {isFailed ? (
          <button
            type="button"
            data-size="sm"
            className="k-btn k-btn--primary"
            disabled
            title="Re-authenticate ships in R12"
          >
            <RotateCw className="h-3 w-3" aria-hidden />
            Re-authenticate
          </button>
        ) : !isMissing && isEditable ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`${p.name} API key'i kaldırılsın mı?`)) {
                keyMutation.mutate("disconnect");
              }
            }}
            disabled={keyMutation.isPending}
            className="inline-flex h-7 items-center rounded-md border border-line px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50"
            data-testid="ai-provider-disconnect"
          >
            {keyMutation.isPending && keyMutation.variables === "disconnect"
              ? "Disconnecting…"
              : "Disconnect"}
          </button>
        ) : !isMissing ? (
          <button
            type="button"
            className="inline-flex h-7 items-center rounded-md px-3 text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-50"
            disabled
            title="Disconnect ships in R12"
          >
            Disconnect
          </button>
        ) : null}
      </div>

      {/* Body */}
      <div className="space-y-5 p-5">
        {/* API key row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr] md:items-start md:gap-6">
          <div>
            <div className="text-[13px] font-medium text-ink">API key</div>
            <div className="mt-0.5 text-[11.5px] text-ink-3">
              Stored encrypted at rest
            </div>
          </div>
          <div>
            {isMissing && isEditable ? (
              <div>
                <div className="flex max-w-[520px] items-center gap-2">
                  <input
                    type={revealKey ? "text" : "password"}
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && keyDraft.trim()) {
                        keyMutation.mutate("save");
                      }
                    }}
                    placeholder={`Paste your ${p.name} API key`}
                    autoComplete="off"
                    spellCheck={false}
                    data-testid="ai-provider-key-input"
                    className="h-9 flex-1 rounded-md border border-line bg-paper px-3 font-mono text-[12px] text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
                  />
                  <button
                    type="button"
                    onClick={() => setRevealKey((v) => !v)}
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper text-ink-3 hover:text-ink",
                      revealKey && "text-k-orange",
                    )}
                    aria-label={revealKey ? "Hide key" : "Reveal key"}
                  >
                    {revealKey ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => keyMutation.mutate("save")}
                    disabled={!keyDraft.trim() || keyMutation.isPending}
                    className="k-btn k-btn--primary"
                    data-size="sm"
                    data-testid="ai-provider-key-save"
                  >
                    {keyMutation.isPending &&
                    keyMutation.variables === "save"
                      ? "Saving…"
                      : "Save"}
                  </button>
                </div>
                {p.keyEmptyHint ? (
                  <div className="mt-1.5 font-mono text-[10.5px] tracking-wider text-ink-3">
                    {p.keyEmptyHint}
                  </div>
                ) : null}
                {keyMutation.isError ? (
                  <div className="mt-1.5 text-[11.5px] text-danger">
                    {(keyMutation.error as Error).message}
                  </div>
                ) : null}
              </div>
            ) : isMissing ? (
              <div>
                <input
                  type="text"
                  placeholder="Add API key in Settings → Workspace (per-user override)"
                  disabled
                  className="h-9 w-full max-w-[480px] rounded-md border border-line bg-k-bg-2 px-3 text-sm text-ink-3 placeholder:text-ink-3"
                />
                {p.keyEmptyHint ? (
                  <div className="mt-1.5 font-mono text-[10.5px] tracking-wider text-ink-3">
                    {p.keyEmptyHint}
                  </div>
                ) : null}
              </div>
            ) : (
              <div>
                <div className="flex max-w-[520px] items-center gap-2">
                  <div className="flex h-9 flex-1 items-center rounded-md border border-line bg-k-bg-2 px-3 font-mono text-[12px] text-ink-2">
                    {revealKey ? p.keyMasked : maskKey(p.keyMasked)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRevealKey((v) => !v)}
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper text-ink-3 hover:text-ink",
                      revealKey && "text-k-orange",
                    )}
                    aria-label={revealKey ? "Hide key" : "Reveal key"}
                  >
                    {revealKey ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper text-ink-3 hover:text-ink disabled:opacity-50"
                    aria-label="Copy key"
                    disabled
                    title="Copy-to-clipboard for API keys is intentionally blocked for security. Reveal + manual copy is the safe path."
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                {isEditable ? (
                  <div className="mt-2 flex max-w-[520px] items-center gap-2">
                    <input
                      type={revealKey ? "text" : "password"}
                      value={keyDraft}
                      onChange={(e) => setKeyDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && keyDraft.trim()) {
                          keyMutation.mutate("save");
                        }
                      }}
                      placeholder="Paste new key to replace"
                      autoComplete="off"
                      spellCheck={false}
                      data-testid="ai-provider-key-replace-input"
                      className="h-8 flex-1 rounded-md border border-line bg-paper px-3 font-mono text-[12px] text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
                    />
                    <button
                      type="button"
                      onClick={() => keyMutation.mutate("save")}
                      disabled={!keyDraft.trim() || keyMutation.isPending}
                      className="inline-flex h-8 items-center rounded-md border border-line px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50"
                      data-testid="ai-provider-key-replace-save"
                    >
                      {keyMutation.isPending &&
                      keyMutation.variables === "save"
                        ? "Saving…"
                        : "Replace"}
                    </button>
                  </div>
                ) : null}
                {keyMutation.isError ? (
                  <div className="mt-1.5 text-[11.5px] text-danger">
                    {(keyMutation.error as Error).message}
                  </div>
                ) : null}
                {keyMutation.isSuccess ? (
                  <div className="mt-1.5 font-mono text-[10.5px] uppercase tracking-meta text-k-green">
                    Saved
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Default models — collapsible */}
        {!isMissing && p.defaults ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr] md:items-start md:gap-6">
            <div>
              <div className="text-[13px] font-medium text-ink">
                Default models
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-3">
                Used unless a batch overrides
              </div>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setDefaultsOpen((v) => !v)}
                className="mb-2 flex items-center gap-2 text-[12.5px] text-ink-2 hover:text-ink"
                data-testid="ai-provider-defaults-toggle"
              >
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    !defaultsOpen && "-rotate-90",
                  )}
                  aria-hidden
                />
                <span>{Object.keys(p.defaults).length} task types</span>
                <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
                  · {Object.keys(p.defaults).length} assigned
                </span>
              </button>
              {defaultsOpen ? (
                <div className="overflow-hidden rounded-md border border-line bg-k-bg-2/60">
                  {Object.entries(p.defaults).map(([k, v], i, arr) => (
                    <div
                      key={k}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5",
                        i < arr.length - 1 && "border-b border-line-soft",
                      )}
                    >
                      <span className="min-w-0 flex-1 text-[12.5px] text-ink">
                        {TASK_LABELS[k as keyof typeof TASK_LABELS] ?? k}
                      </span>
                      <span className="font-mono text-[11.5px] text-ink-2">
                        {v.model}
                      </span>
                      <span className="w-[64px] text-right font-mono text-[10.5px] tabular-nums tracking-wider text-ink-3">
                        {v.cost}/call
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Spend limits — only if connected */}
        {!isMissing ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr] md:items-start md:gap-6">
            <div>
              <div className="text-[13px] font-medium text-ink">
                Spend limits
              </div>
              <div className="mt-0.5 text-[11.5px] text-ink-3">
                Hard ceiling — variation + listing-copy paths block at limit (R10 enforcement live)
              </div>
            </div>
            <div className="flex max-w-[420px] items-center gap-3">
              <div className="flex-1">
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-meta text-ink-3">
                  Daily · USD
                </label>
                <input
                  type="number"
                  defaultValue={p.dailyLimit}
                  disabled
                  className="h-8 w-full rounded-md border border-line bg-k-bg-2 px-3 text-sm tabular-nums text-ink-2"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-meta text-ink-3">
                  Monthly · USD
                </label>
                <input
                  type="number"
                  defaultValue={p.monthlyLimit}
                  disabled
                  className="h-8 w-full rounded-md border border-line bg-k-bg-2 px-3 text-sm tabular-nums text-ink-2"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const TASK_LABELS = {
  variation: "Variation generation",
  review: "Quality review",
  listingCopy: "Listing copy generation",
  bgRemoval: "Background removal",
  mockup: "Mockup composition",
} as const;

function maskKey(key: string): string {
  if (!key || key.length < 8) return "•••••";
  return `${key.slice(0, 4)}${"•".repeat(Math.min(20, key.length - 8))}${key.slice(-4)}`;
}

function dollar(cents: number | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}
