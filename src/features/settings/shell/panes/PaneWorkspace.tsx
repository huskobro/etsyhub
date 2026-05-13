/* eslint-disable no-restricted-syntax */
// PaneWorkspace — Kivasy Mini Wave D per-user override pane.
//
// AI Providers pane "WORKSPACE DEFAULTS" badge'iyle workspace-scope'u
// söylüyordu; Workspace pane operatörün kendi key'leriyle workspace
// default'larını override etmesini sağlar. Mevcut /api/settings/ai-mode
// endpoint'i (Phase 5) reuse edilir — yeni model yok.
//
// v6 sabitleri:
//  · max-w-[680px] pane container + text-[26px] k-display title
//  · text-[12.5px] / text-[11.5px] / text-[10.5px] yarı-piksel typography
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

interface WorkspaceOverride {
  hasUserKey: boolean;
  tail: string | null;
  activeFor: string[];
}

interface WorkspaceView {
  reviewProvider: "kie" | "google-gemini";
  overrides: {
    kie: WorkspaceOverride;
    gemini: WorkspaceOverride;
  };
}

interface AiModeMaskedSettings {
  kieApiKey: string | null;
  geminiApiKey: string | null;
  reviewProvider: "kie" | "google-gemini";
}

const PRESERVE_SENTINEL = "";

const TASK_LABEL: Record<string, string> = {
  variation: "Variation generation",
  review: "Quality review",
  listingCopy: "Listing copy",
  bgRemoval: "Background removal",
  mockup: "Mockup composition",
};

export function PaneWorkspace() {
  const qc = useQueryClient();

  const overrideQuery = useQuery<WorkspaceView>({
    queryKey: ["settings", "workspace"],
    queryFn: async () => {
      const r = await fetch("/api/settings/workspace");
      if (!r.ok) throw new Error("Could not load workspace");
      return r.json();
    },
  });

  const aiModeQuery = useQuery<{ settings: AiModeMaskedSettings }>({
    queryKey: ["settings", "ai-mode"],
    queryFn: async () => {
      const r = await fetch("/api/settings/ai-mode");
      if (!r.ok) throw new Error("Could not load AI mode");
      return r.json();
    },
  });

  const [kieKey, setKieKey] = useState(PRESERVE_SENTINEL);
  const [geminiKey, setGeminiKey] = useState(PRESERVE_SENTINEL);
  const [reviewProvider, setReviewProvider] =
    useState<"kie" | "google-gemini">("kie");
  const [revealKie, setRevealKie] = useState(false);
  const [revealGemini, setRevealGemini] = useState(false);

  useEffect(() => {
    const remote = aiModeQuery.data?.settings;
    if (!remote) return;
    setReviewProvider(remote.reviewProvider);
  }, [aiModeQuery.data]);

  const saveMutation = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const remote = aiModeQuery.data?.settings;
      const r = await fetch("/api/settings/ai-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Boş = preserve (mevcut servis kontratı)
          kieApiKey: kieKey === PRESERVE_SENTINEL ? remote?.kieApiKey ?? null : kieKey,
          geminiApiKey:
            geminiKey === PRESERVE_SENTINEL
              ? remote?.geminiApiKey ?? null
              : geminiKey,
          reviewProvider,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "ai-mode"] });
      qc.invalidateQueries({ queryKey: ["settings", "workspace"] });
      setKieKey(PRESERVE_SENTINEL);
      setGeminiKey(PRESERVE_SENTINEL);
    },
  });

  const overrides = overrideQuery.data?.overrides ?? null;

  const hasAnyOverride = useMemo(() => {
    return (
      (overrides?.kie.hasUserKey ?? false) ||
      (overrides?.gemini.hasUserKey ?? false)
    );
  }, [overrides]);

  if (overrideQuery.isLoading || aiModeQuery.isLoading) {
    return (
      <div className="max-w-[680px] px-10 py-9">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          Workspace
        </h2>
        <div className="mt-8 flex items-center gap-2 text-sm text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading workspace overrides…
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[680px] px-10 py-9">
      <div className="flex items-start justify-between gap-3">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          Workspace
        </h2>
        <Badge tone="info">YOUR OVERRIDES</Badge>
      </div>
      <p className="mt-1 mb-2 text-[13px] text-ink-2">
        Personal AI provider keys override the workspace defaults shown in{" "}
        <Link
          href="/settings?pane=providers"
          className="text-info underline-offset-2 hover:underline"
        >
          AI Providers
        </Link>
        .
      </p>
      <p className="mb-7 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        {hasAnyOverride
          ? "At least one task is currently routed through your personal key"
          : "All tasks fall back to workspace defaults"}
      </p>

      {/* Active override summary */}
      <div className="mb-7 rounded-md border border-line bg-paper">
        <div className="border-b border-line-soft px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          Active override per task
        </div>
        <div className="divide-y divide-line-soft">
          {(["variation", "review", "listingCopy", "bgRemoval", "mockup"] as const).map(
            (task) => {
              const usingKie = overrides?.kie.activeFor.includes(task);
              const usingGemini = overrides?.gemini.activeFor.includes(task);
              return (
                <div
                  key={task}
                  className="flex items-center gap-3 px-4 py-2.5"
                  data-testid="workspace-override-row"
                  data-task={task}
                >
                  <span className="flex-1 text-[12.5px] text-ink">
                    {TASK_LABEL[task]}
                  </span>
                  {usingKie || usingGemini ? (
                    <Badge tone="info">
                      Personal · {usingKie ? "KIE" : "Gemini"}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Workspace default</Badge>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>

      {/* KIE override */}
      <Section
        title="KIE personal key"
        hint={
          overrides?.kie.hasUserKey
            ? `Active · ending ${overrides.kie.tail}`
            : "No personal key — falls back to workspace KIE"
        }
      >
        <KeyInput
          placeholder="kie_••••… paste to override workspace default"
          value={kieKey}
          onChange={setKieKey}
          revealed={revealKie}
          onToggleReveal={() => setRevealKie((v) => !v)}
        />
      </Section>

      {/* Gemini override + review provider toggle */}
      <Section
        title="Google Gemini personal key"
        hint={
          overrides?.gemini.hasUserKey
            ? `Active · ending ${overrides.gemini.tail}`
            : "No personal key — review falls back to workspace KIE"
        }
      >
        <KeyInput
          placeholder="AIza… paste to enable Gemini review override"
          value={geminiKey}
          onChange={setGeminiKey}
          revealed={revealGemini}
          onToggleReveal={() => setRevealGemini((v) => !v)}
        />
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setReviewProvider("kie")}
            className={cn(
              "rounded-md border px-3 py-2 text-left text-[12.5px] transition-colors",
              reviewProvider === "kie"
                ? "border-k-orange bg-k-orange-soft text-ink"
                : "border-line bg-paper text-ink-2 hover:border-line-strong",
            )}
          >
            <div className="font-medium">Review via KIE</div>
            <div className="font-mono text-[10.5px] tracking-wider text-ink-3">
              kie/qc-vision-2
            </div>
          </button>
          <button
            type="button"
            onClick={() => setReviewProvider("google-gemini")}
            className={cn(
              "rounded-md border px-3 py-2 text-left text-[12.5px] transition-colors",
              reviewProvider === "google-gemini"
                ? "border-k-orange bg-k-orange-soft text-ink"
                : "border-line bg-paper text-ink-2 hover:border-line-strong",
            )}
          >
            <div className="font-medium">Review via Gemini</div>
            <div className="font-mono text-[10.5px] tracking-wider text-ink-3">
              google/gemini-2.0-flash
            </div>
          </button>
        </div>
      </Section>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          data-size="sm"
          className="k-btn k-btn--primary"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          data-testid="workspace-save"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden />
          )}
          Save overrides
        </button>
        {saveMutation.error ? (
          <span className="font-mono text-[11px] text-danger">
            <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />
            {saveMutation.error.message}
          </span>
        ) : saveMutation.isSuccess ? (
          <span className="font-mono text-[11px] text-success">
            Saved · workspace overrides synced
          </span>
        ) : null}
      </div>

      <Link
        href="/settings?pane=providers"
        className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink"
      >
        View workspace defaults
        <ArrowRight className="h-3 w-3" aria-hidden />
      </Link>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="mb-2">
        <div className="text-[12.5px] font-semibold text-ink">{title}</div>
        <div className="mt-0.5 font-mono text-[10.5px] tracking-wider text-ink-3">
          {hint}
        </div>
      </div>
      {children}
    </div>
  );
}

function KeyInput({
  placeholder,
  value,
  onChange,
  revealed,
  onToggleReveal,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  return (
    <div className="flex max-w-[520px] items-center gap-2">
      <input
        type={revealed ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 flex-1 rounded-md border border-line bg-paper px-3 font-mono text-[12px] text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
      />
      <button
        type="button"
        onClick={onToggleReveal}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper text-ink-3 hover:text-ink"
        aria-label={revealed ? "Hide key" : "Reveal key"}
      >
        {revealed ? (
          <EyeOff className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Eye className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}
