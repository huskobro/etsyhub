"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";

/**
 * Scraper provider adları — provider-config abstraction ile hizalı.
 * Runtime değer olarak da kullanıldığı için sabit bir array tutuyoruz.
 */
const SCRAPER_PROVIDERS = ["self-hosted", "apify", "firecrawl"] as const;
type ScraperProviderName = (typeof SCRAPER_PROVIDERS)[number];

type ConfigView = {
  activeProvider: ScraperProviderName;
  hasApifyKey: boolean;
  hasFirecrawlKey: boolean;
};

type PatchBody = {
  activeProvider?: ScraperProviderName;
  apiKeys?: {
    apify?: string | null;
    firecrawl?: string | null;
  };
};

async function fetchConfig(): Promise<ConfigView> {
  const res = await fetch("/api/admin/scraper-config", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Yapılandırma alınamadı");
  }
  return (await res.json()) as ConfigView;
}

async function patchConfig(body: PatchBody): Promise<ConfigView> {
  const res = await fetch("/api/admin/scraper-config", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error ?? "Güncelleme başarısız");
  }
  return (await res.json()) as ConfigView;
}

const PROVIDER_LABELS: Record<ScraperProviderName, string> = {
  "self-hosted": "Self-Hosted (Cheerio/fetch)",
  apify: "Apify",
  firecrawl: "Firecrawl",
};

const PROVIDER_HINTS: Record<ScraperProviderName, string> = {
  "self-hosted": "API anahtarı gerekmez. Hız/sınır düşük, local parser kullanır.",
  apify: "Apify API token gerektirir. Daha güvenilir, maliyetli.",
  firecrawl: "Firecrawl API anahtarı gerektirir. Alternatif SaaS scraper.",
};

export function ScraperConfigForm() {
  const qc = useQueryClient();
  const { confirm, close, run, state } = useConfirm();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "scraper-config"],
    queryFn: fetchConfig,
  });

  const mutation = useMutation({
    mutationFn: patchConfig,
    onSuccess: (fresh) => {
      qc.setQueryData(["admin", "scraper-config"], fresh);
      setApifyInput("");
      setFirecrawlInput("");
      setFeedback({ kind: "success", text: "Güncellendi" });
    },
    onError: (err: Error) => {
      setFeedback({ kind: "error", text: err.message });
    },
  });

  const [apifyInput, setApifyInput] = useState("");
  const [firecrawlInput, setFirecrawlInput] = useState("");
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  if (isLoading) {
    return <p className="text-sm text-text-muted">Yükleniyor…</p>;
  }
  if (error) {
    return <p className="text-sm text-danger">{(error as Error).message}</p>;
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      {feedback ? (
        <div
          role="status"
          className={
            "rounded-md border px-3 py-2 text-sm " +
            (feedback.kind === "success"
              ? "border-border bg-success/10 text-success"
              : "border-border bg-danger/10 text-danger")
          }
        >
          {feedback.text}
        </div>
      ) : null}

      {/* Active provider seçimi */}
      <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-card">
        <div>
          <h2 className="text-base font-semibold text-text">Aktif Sağlayıcı</h2>
          <p className="text-xs text-text-muted">
            Rakip tarama işlerinde kullanılacak scraper. Seçim tüm
            kullanıcıları etkiler.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {SCRAPER_PROVIDERS.map((p) => {
            const selected = data.activeProvider === p;
            return (
              <label
                key={p}
                className={
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3 " +
                  (selected
                    ? "border-accent bg-accent/5"
                    : "border-border hover:bg-surface-muted")
                }
              >
                <input
                  type="radio"
                  name="active-provider"
                  value={p}
                  checked={selected}
                  disabled={mutation.isPending}
                  onChange={() =>
                    mutation.mutate({ activeProvider: p })
                  }
                  className="mt-1"
                />
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-text">
                    {PROVIDER_LABELS[p]}
                  </span>
                  <span className="text-xs text-text-muted">
                    {PROVIDER_HINTS[p]}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* API key yönetimi */}
      <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4 shadow-card">
        <div>
          <h2 className="text-base font-semibold text-text">API Anahtarları</h2>
          <p className="text-xs text-text-muted">
            Anahtarlar AES-256-GCM ile şifrelenerek saklanır. Kaydedilen
            anahtar bir daha okunur metin olarak gösterilmez.
          </p>
        </div>

        <ApiKeyRow
          label="Apify"
          hasKey={data.hasApifyKey}
          value={apifyInput}
          onChange={setApifyInput}
          pending={mutation.isPending}
          onSave={() => {
            if (apifyInput.length < 10) {
              setFeedback({
                kind: "error",
                text: "Apify anahtarı en az 10 karakter olmalı",
              });
              return;
            }
            mutation.mutate({ apiKeys: { apify: apifyInput } });
          }}
          onDelete={() =>
            confirm(
              confirmPresets.deleteApiKey("Apify"),
              async () => {
                await mutation.mutateAsync({ apiKeys: { apify: null } });
              },
            )
          }
        />

        <ApiKeyRow
          label="Firecrawl"
          hasKey={data.hasFirecrawlKey}
          value={firecrawlInput}
          onChange={setFirecrawlInput}
          pending={mutation.isPending}
          onSave={() => {
            if (firecrawlInput.length < 10) {
              setFeedback({
                kind: "error",
                text: "Firecrawl anahtarı en az 10 karakter olmalı",
              });
              return;
            }
            mutation.mutate({ apiKeys: { firecrawl: firecrawlInput } });
          }}
          onDelete={() =>
            confirm(
              confirmPresets.deleteApiKey("Firecrawl"),
              async () => {
                await mutation.mutateAsync({ apiKeys: { firecrawl: null } });
              },
            )
          }
        />
      </section>

      {state.preset ? (
        <ConfirmDialog
          open={state.open}
          onOpenChange={(o) => {
            if (!o) close();
          }}
          {...state.preset}
          onConfirm={run}
          busy={state.busy}
          errorMessage={state.errorMessage}
        />
      ) : null}
    </div>
  );
}

function ApiKeyRow(props: {
  label: string;
  hasKey: boolean;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const { label, hasKey, value, onChange, onSave, onDelete, pending } = props;
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">
          {label} API Anahtarı
        </span>
        {hasKey ? (
          <span className="rounded-md bg-success-soft px-2 py-1 text-xs text-success">
            Mevcut
          </span>
        ) : (
          <span className="rounded-md bg-surface-muted px-2 py-1 text-xs text-text-muted">
            Ayarlanmamış
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="password"
          autoComplete="new-password"
          placeholder={hasKey ? "Yeni anahtar girerek değiştir" : "Anahtarı yapıştır"}
          value={value}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          disabled={pending || value.length === 0}
          onClick={onSave}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-50"
        >
          Kaydet
        </button>
        {hasKey ? (
          <button
            type="button"
            disabled={pending}
            onClick={onDelete}
            className="rounded-md border border-border px-3 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            Sil
          </button>
        ) : null}
      </div>
    </div>
  );
}
