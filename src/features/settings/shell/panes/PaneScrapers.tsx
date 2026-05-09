/* eslint-disable no-restricted-syntax */
// PaneScrapers — R8: Apify + Firecrawl token + rate-limit ayarı.
// (UserSetting key="scrapers", admin scope, encrypted at rest).
//
// v6 sabit boyutlar (max-w-[680px] + text-[26px] k-display + yarı-piksel)
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

interface ScrapersView {
  apifyToken: string | null;
  firecrawlToken: string | null;
  hasApifyToken: boolean;
  hasFirecrawlToken: boolean;
  maxConcurrency: number;
  hourlyRateLimit: number;
}

const QUERY_KEY = ["settings", "scrapers"] as const;
const PRESERVE = "";

export function PaneScrapers() {
  const qc = useQueryClient();
  const query = useQuery<{ settings: ScrapersView }>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/settings/scrapers");
      if (r.status === 403) {
        throw new Error("Admin scope required");
      }
      if (!r.ok) throw new Error("Scrapers settings yüklenemedi");
      return r.json();
    },
    retry: false,
  });

  const [apify, setApify] = useState(PRESERVE);
  const [firecrawl, setFirecrawl] = useState(PRESERVE);
  const [revealApify, setRevealApify] = useState(false);
  const [revealFire, setRevealFire] = useState(false);

  const remote = query.data?.settings;

  const mutation = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (apify !== PRESERVE) body.apifyToken = apify || null;
      if (firecrawl !== PRESERVE) body.firecrawlToken = firecrawl || null;
      if (Object.keys(body).length === 0) {
        // Sadece concurrency/limit değiştiyse ya da kullanıcı no-op tıkladıysa
        return null;
      }
      const r = await fetch("/api/settings/scrapers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      setApify(PRESERVE);
      setFirecrawl(PRESERVE);
    },
  });

  const numberMutation = useMutation<
    { settings: ScrapersView },
    Error,
    Partial<{ maxConcurrency: number; hourlyRateLimit: number }>
  >({
    mutationFn: async (patch) => {
      const r = await fetch("/api/settings/scrapers", {
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
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  if (query.isLoading) {
    return (
      <div className="max-w-[680px] px-10 py-9">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          Scrapers
        </h2>
        <div className="mt-8 flex items-center gap-2 text-sm text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading scraper config…
        </div>
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="max-w-[680px] px-10 py-9">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          Scrapers
        </h2>
        <div className="mt-8 rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden />
          {(query.error as Error).message ??
            "Scrapers ayarları admin scope gerektirir"}
        </div>
      </div>
    );
  }

  if (!remote) return null;

  return (
    <div className="max-w-[680px] px-10 py-9">
      <div className="flex items-start justify-between gap-3">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          Scrapers
        </h2>
        <Badge tone="warning">ADMIN</Badge>
      </div>
      <p className="mt-1 mb-7 text-[13px] text-ink-2">
        Apify and Firecrawl provider tokens. Stored encrypted at rest. Rate
        limits apply workspace-wide and protect competitor stores from over-
        scraping.
      </p>

      <Section
        title="Apify token"
        hint={
          remote.hasApifyToken
            ? `Active · ending ${remote.apifyToken}`
            : "No token configured — competitor scrape disabled"
        }
      >
        <KeyInput
          placeholder="apify_api_xxx … paste to set or update"
          value={apify}
          onChange={setApify}
          revealed={revealApify}
          onToggleReveal={() => setRevealApify((v) => !v)}
        />
      </Section>

      <Section
        title="Firecrawl token"
        hint={
          remote.hasFirecrawlToken
            ? `Active · ending ${remote.firecrawlToken}`
            : "No token configured — Firecrawl scrape disabled"
        }
      >
        <KeyInput
          placeholder="fc-xxx … paste to set or update"
          value={firecrawl}
          onChange={setFirecrawl}
          revealed={revealFire}
          onToggleReveal={() => setRevealFire((v) => !v)}
        />
      </Section>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          data-size="sm"
          className="k-btn k-btn--primary"
          disabled={
            mutation.isPending ||
            (apify === PRESERVE && firecrawl === PRESERVE)
          }
          onClick={() => mutation.mutate()}
          data-testid="scrapers-save-tokens"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden />
          )}
          Save tokens
        </button>
        {mutation.error ? (
          <span className="font-mono text-[11px] text-danger">
            {mutation.error.message}
          </span>
        ) : mutation.isSuccess ? (
          <span className="font-mono text-[11px] text-success">
            Tokens saved · encrypted at rest
          </span>
        ) : null}
      </div>

      <div className="mt-7 grid grid-cols-1 gap-6 border-t border-line-soft pt-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-ink">
            Max concurrency
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={remote.maxConcurrency}
            onChange={(e) =>
              numberMutation.mutate({
                maxConcurrency: parseInt(e.target.value || "1", 10),
              })
            }
            className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm tabular-nums text-ink focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
          />
          <div className="mt-1 font-mono text-[10.5px] tracking-wider text-ink-3">
            Concurrent scrape jobs (1–10)
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[12.5px] font-semibold text-ink">
            Hourly rate limit
          </label>
          <input
            type="number"
            min={10}
            max={2000}
            value={remote.hourlyRateLimit}
            onChange={(e) =>
              numberMutation.mutate({
                hourlyRateLimit: parseInt(e.target.value || "10", 10),
              })
            }
            className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm tabular-nums text-ink focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
          />
          <div className="mt-1 font-mono text-[10.5px] tracking-wider text-ink-3">
            Requests / hour cap (10–2000)
          </div>
        </div>
      </div>

      <p className="mt-6 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
        Scraper tokens + rate limits persist via UserSetting
        key=scrapers · full job orchestration lands post-MVP
      </p>
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
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper text-ink-3 hover:text-ink",
        )}
        aria-label={revealed ? "Hide token" : "Reveal token"}
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
