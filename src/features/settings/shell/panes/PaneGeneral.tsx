/* eslint-disable no-restricted-syntax */
// PaneGeneral — Kivasy v6 C2 PaneGeneral. v6 sabit boyutlar:
//  · max-w-[680px] pane container (canon)
//  · text-[26px] pane title + text-[13.5px] / text-[12px] / text-[11px]
//    setting row typography
//  · k-segment cosmetics — controlled component, no-op persist (R7+)
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Grid3x3, List as ListIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * PaneGeneral — defaults applied across the cockpit.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v6/screens-c2.jsx →
 * PaneGeneral.
 *
 * Density / Theme / Language / Date format. R6'da UI seviyesinde toggle
 * çalışır ama persist deferred (R7+ user setting registry expansion).
 * Theme dark variant disabled (Wave D'de gelir).
 */

type Density = "comfortable" | "dense";
type Theme = "light" | "dark";
type Language = "en-US" | "tr" | "de";
type DateFormat = "relative" | "iso";

interface GeneralSettingsView {
  density: Density;
  language: Language;
  dateFormat: DateFormat;
  theme: Theme;
}

const QUERY_KEY = ["settings", "general"] as const;

export function PaneGeneral() {
  const qc = useQueryClient();

  const query = useQuery<{ settings: GeneralSettingsView }>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/settings/general");
      if (!r.ok) throw new Error("General settings yüklenemedi");
      return r.json();
    },
  });

  const mutation = useMutation<
    { settings: GeneralSettingsView },
    Error,
    Partial<GeneralSettingsView>
  >({
    mutationFn: async (patch) => {
      const r = await fetch("/api/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: (data) => {
      qc.setQueryData(QUERY_KEY, data);
    },
  });

  const remote = query.data?.settings;
  const [density, setDensity] = useState<Density>("comfortable");
  const [theme] = useState<Theme>("light");
  const [language, setLanguage] = useState<Language>("en-US");
  const [dateFormat, setDateFormat] = useState<DateFormat>("relative");

  useEffect(() => {
    if (!remote) return;
    setDensity(remote.density);
    setLanguage(remote.language);
    setDateFormat(remote.dateFormat);
  }, [remote]);

  function persist(patch: Partial<GeneralSettingsView>) {
    mutation.mutate(patch);
  }

  return (
    <div className="max-w-[680px] px-10 py-9">
      <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
        General
      </h2>
      <p className="mt-1 mb-7 text-[13px] text-ink-2">
        Defaults applied across the cockpit. Per-surface overrides live in
        their own headers.
      </p>

      <SettingRow
        label="Default density"
        hint="Comfortable shows more breathing room; Dense fits more rows on screen."
      >
        <Segment>
          <SegmentButton
            active={density === "comfortable"}
            onClick={() => {
              setDensity("comfortable");
              persist({ density: "comfortable" });
            }}
          >
            <Grid3x3 className="h-3 w-3" aria-hidden />
            Comfortable
          </SegmentButton>
          <SegmentButton
            active={density === "dense"}
            onClick={() => {
              setDensity("dense");
              persist({ density: "dense" });
            }}
          >
            <ListIcon className="h-3 w-3" aria-hidden />
            Dense
          </SegmentButton>
        </Segment>
      </SettingRow>

      <SettingRow label="Theme" hint="Dark theme arrives in a later wave.">
        <Segment>
          <SegmentButton active={theme === "light"} onClick={() => {}}>
            Light
          </SegmentButton>
          <SegmentButton
            active={false}
            disabled
            onClick={() => {}}
            title="Dark theme is on the post-MVP backlog. Light theme is the only option for now."
          >
            Dark · Soon
          </SegmentButton>
        </Segment>
      </SettingRow>

      <SettingRow
        label="Language"
        hint="UI strings only — generated listing copy follows your style profile."
      >
        <select
          value={language}
          onChange={(e) => {
            const v = e.target.value as Language;
            setLanguage(v);
            persist({ language: v });
          }}
          className="h-9 w-[280px] rounded-md border border-line bg-paper px-3 text-sm text-ink focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
          data-testid="settings-general-language"
        >
          <option value="en-US">English (en-US)</option>
          <option value="tr">Türkçe (tr)</option>
          <option value="de">Deutsch (de)</option>
        </select>
      </SettingRow>

      <SettingRow
        label="Date / time format"
        hint="Affects timestamps on Activity log and Audit pane."
      >
        <Segment>
          <SegmentButton
            active={dateFormat === "relative"}
            onClick={() => {
              setDateFormat("relative");
              persist({ dateFormat: "relative" });
            }}
          >
            Relative
          </SegmentButton>
          <SegmentButton
            active={dateFormat === "iso"}
            onClick={() => {
              setDateFormat("iso");
              persist({ dateFormat: "iso" });
            }}
          >
            ISO 8601
          </SegmentButton>
        </Segment>
      </SettingRow>

      <div className="mt-8 border-t border-line-soft pt-5">
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-50"
          disabled={mutation.isPending}
          onClick={() =>
            persist({
              density: "comfortable",
              language: "en-US",
              dateFormat: "relative",
              theme: "light",
            })
          }
          data-testid="settings-general-reset"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : null}
          Reset to defaults
        </button>
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
          {mutation.isError
            ? `Save failed: ${mutation.error?.message}`
            : mutation.isSuccess
              ? "Saved · synced via UserSetting key=general"
              : query.isLoading
                ? "Loading…"
                : "Toggle to persist instantly · synced via UserSetting key=general"}
        </p>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 border-b border-line-soft py-4 md:grid-cols-[220px_1fr] md:items-start">
      <div>
        <div className="text-[13.5px] font-medium text-ink">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-[12px] leading-snug text-ink-3">
            {hint}
          </div>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Segment({ children }: { children: ReactNode }) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-md border border-line bg-k-bg-2 p-0.5"
      role="group"
    >
      {children}
    </div>
  );
}

function SegmentButton({
  active,
  disabled,
  onClick,
  children,
  title,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Optional tooltip — recommended for disabled segments to make the
   * reason visible on hover (R11.14.7 audit clarity). */
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
        active
          ? "bg-paper text-ink shadow-card"
          : "text-ink-3 hover:text-ink-2",
        disabled && "opacity-45 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}
