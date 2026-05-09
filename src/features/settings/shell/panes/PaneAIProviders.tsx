/* eslint-disable no-restricted-syntax */
// PaneAIProviders — Kivasy v7 D1 AI Providers pane. v7/v6 sabit boyutlar:
//  · max-w-[920px] pane container
//  · k-display text-[26px] pane title + ADMIN · WORKSPACE DEFAULTS badge
//  · 4-column stat row (DAILY/MONTHLY/ACTIVE/FAILED) + provider card list
//  · Provider card: 40px mono badge + status badge + masked key + collapsible
//    task defaults + spend limits.
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

/**
 * PaneAIProviders — D1 surface (workspace AI provider config).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v7/screens-d.jsx →
 * D1Providers + PaneAIProviders + ProviderCard.
 *
 * Data:
 *   - Connected providers (KIE + Google Gemini) are read from existing
 *     /api/settings/ai-mode endpoint (Phase 5 / Phase 6).
 *   - Other providers (OpenAI / Fal.ai / Replicate / Recraft) render as
 *     "KEY MISSING" placeholders — schema/CRUD ships in R7.
 *   - Spend stats use static defaults (cost-usage aggregator R7+).
 *
 * Boundary discipline:
 *   Read-only display in R6; key reveal/copy and re-authenticate buttons
 *   ship in R7+. Per-user key override caption visible (workspace defaults
 *   first principle).
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

export function PaneAIProviders() {
  const aiModeQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<{ settings: AiModeMaskedSettings }> => {
      const r = await fetch("/api/settings/ai-mode");
      if (!r.ok) throw new Error("AI Providers settings yüklenemedi");
      return r.json();
    },
  });

  const providers = useMemo<ProviderRow[]>(() => {
    const masked = aiModeQuery.data?.settings;
    const kieKey = masked?.kieApiKey;
    const geminiKey = masked?.geminiApiKey;
    const reviewProvider = masked?.reviewProvider ?? "kie";

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
        dailyLimit: 50,
        monthlyLimit: 800,
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
        dailyLimit: 30,
        monthlyLimit: 400,
      },
      {
        id: "openai",
        name: "OpenAI",
        mono: "O",
        tone: "ink",
        status: { tone: "warning", label: "KEY MISSING" },
        keyMasked: "",
        keyEmptyHint:
          "Add an API key to enable OpenAI for any task — schema lands in R7",
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
        keyEmptyHint: "R7 — Fal.ai integration ships next rollout",
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
        keyEmptyHint: "R7 — Replicate integration ships next rollout",
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
        keyEmptyHint: "R7 — Recraft integration ships next rollout",
        lastSuccess: null,
        lastError: null,
        defaults: null,
        dailyLimit: 0,
        monthlyLimit: 0,
      },
    ];
    return rows;
  }, [aiModeQuery.data]);

  const activeCount = providers.filter(
    (p) => p.status.label === "CONNECTED",
  ).length;
  const totalCount = providers.length;

  if (aiModeQuery.isLoading) {
    return (
      <div className="max-w-[920px] px-10 py-9">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          AI Providers
        </h2>
        <div className="mt-8 flex items-center gap-2 text-sm text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading provider settings…
        </div>
      </div>
    );
  }

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
        </div>
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
        in Preferences → Workspace (R7)
      </p>

      {/* 4-column stat row */}
      <div className="mb-7 grid grid-cols-2 divide-line-soft rounded-md border border-line bg-paper md:grid-cols-4 md:divide-x">
        <Stat
          label="DAILY SPEND"
          value="$3.42"
          meta="of $50 limit"
          pct={3.42 / 50}
        />
        <Stat
          label="MONTHLY SPEND"
          value="$48.90"
          meta="of $800 limit"
          pct={48.9 / 800}
        />
        <Stat
          label="ACTIVE PROVIDERS"
          value={String(activeCount)}
          meta={`of ${totalCount}`}
        />
        <Stat
          label="FAILED CALLS · 24H"
          value="0"
          meta="cost-usage aggregator R7"
          tone="ink"
        />
      </div>

      <div className="space-y-3" data-testid="ai-providers-list">
        {providers.map((p) => (
          <ProviderCard key={p.id} provider={p} />
        ))}
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
            title="Re-authenticate ships in R7"
          >
            <RotateCw className="h-3 w-3" aria-hidden />
            Re-authenticate
          </button>
        ) : !isMissing ? (
          <button
            type="button"
            className="inline-flex h-7 items-center rounded-md px-3 text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-50"
            disabled
            title="Disconnect ships in R7"
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
            {isMissing ? (
              <div>
                <input
                  type="text"
                  placeholder="Add API key in Settings → AI Mode (R7 unification)"
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
                  title="Copy ships in R7"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </button>
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
                Hard ceiling — calls fail past limit (R7 enforcement)
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
