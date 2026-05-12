"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCreateVariations } from "../mutations/use-create-variations";
import { CostConfirmDialog } from "./cost-confirm-dialog";
import {
  PROVIDER_CAPABILITIES,
  getProviderCapability,
  resolveDefaultAspectRatio,
} from "../provider-capabilities";

// Q6 capability görünür: z-image (text-to-image) "Yakında" disabled — sessiz
// fallback YOK; provider yok ise UI açıkça reddeder.
//
// Batch-first Phase 8 fit-and-finish — provider-first dil + Midjourney
// destek (canonical default). Phase 7'de UserSetting.aiMode.
// defaultImageProvider field eklenmişti ama UI'da consume edilmiyordu;
// burada `initialProviderId` prop'u settings'ten gelir.
//
// Batch-first Phase 9 — provider capabilities registry tüketimi.
// Hardcoded MODELS array kaldırıldı; PROVIDER_CAPABILITIES tek doğruluk
// kaynağı. Aspect ratio + quality dropdown'ları provider'a göre dinamik.
//
// Midjourney pipeline'ı bu form'dan tetiklenmez (MJ bridge ayrı admin
// flow'u kullanır — `/api/admin/midjourney/variation`); seçili olsa
// bile "available: false" + helper text operatöre gerçek durumu söyler.

// CreateVariationsBody schema'sı "1:1" | "2:3" | "3:2" kabul ediyor;
// Z-Image (4:3, 16:9, ...) form'dan tetiklenmediği için (available:
// false) bu kısıt korunur. AspectRatio type'ı API contract'la senkron.
type AspectRatio = "1:1" | "2:3" | "3:2";
type Quality = "medium" | "high";

// R17.4 — count default 3, range 1..6.
const COUNT_MIN = 1;
const COUNT_MAX = 6;
const COUNT_DEFAULT = 3;
const BRIEF_MAX = 500;

function parseAspectRatio(v: string): AspectRatio {
  if (v === "1:1" || v === "2:3" || v === "3:2") return v;
  return "2:3";
}

function parseQuality(v: string): Quality {
  return v === "high" ? "high" : "medium";
}

export function AiModeForm({
  referenceId,
  disabled,
  initialProviderId,
}: {
  referenceId: string;
  disabled: boolean;
  /**
   * Batch-first Phase 8 fit-and-finish — server-side resolved default
   * provider (UserSetting.aiMode.defaultImageProvider). Settings'te
   * Midjourney default; batch bazında dropdown override eder. Eğer
   * default id MODELS listesinde değilse veya available=false ise
   * UI fallback olarak ilk available provider'a düşer (dürüst —
   * kullanıcı yine de dropdown'da hangi default olduğunu görür).
   */
  initialProviderId?: string;
}) {
  // Phase 9 — Default resolve: settings'ten gelen id PROVIDER_CAPABILITIES'te
  // varsa onu kullan; aksi halde ilk available provider'a düş.
  const defaultId = (() => {
    const fromSettings = initialProviderId
      ? getProviderCapability(initialProviderId)
      : null;
    if (fromSettings) return initialProviderId!;
    const firstAvail = PROVIDER_CAPABILITIES.find((p) => p.available);
    return firstAvail?.id ?? "kie-gpt-image-1.5";
  })();
  const [providerId, setProviderId] = useState(defaultId);
  // Phase 9 — Aspect ratio + quality state'leri provider'a göre ilkleştirilir
  // ve provider değişikliğinde validate edilir.
  const initialCap = getProviderCapability(defaultId);
  const [aspectRatio, setAspect] = useState<AspectRatio>(
    (initialCap?.supportedAspectRatios.find(
      (r): r is AspectRatio => r === "1:1" || r === "2:3" || r === "3:2",
    ) ??
      "2:3") as AspectRatio,
  );
  const [quality, setQuality] = useState<Quality>(
    (initialCap?.supportedQualities[0] ?? "medium") as Quality,
  );

  // Phase 9 — Provider değişikliğinde aspect/quality state'lerini validate
  // et: yeni provider eski değeri desteklemiyorsa fallback uygula.
  function handleProviderChange(nextId: string) {
    setProviderId(nextId);
    const nextCap = getProviderCapability(nextId);
    if (!nextCap) return;
    // Aspect ratio fallback
    const nextAspect = resolveDefaultAspectRatio(nextId, aspectRatio);
    if (nextAspect !== aspectRatio) {
      // Yeni provider tarafından desteklenen ilk "1:1"|"2:3"|"3:2"
      const valid = nextCap.supportedAspectRatios.find(
        (r): r is AspectRatio => r === "1:1" || r === "2:3" || r === "3:2",
      );
      setAspect((valid ?? "2:3") as AspectRatio);
    }
    // Quality fallback — provider quality desteklemiyorsa eski state korunur
    // (API'ye gönderilirken filtrelenir; UI dropdown'u disabled gösterir).
    if (nextCap.supportedQualities.length > 0) {
      if (!nextCap.supportedQualities.includes(quality)) {
        setQuality(nextCap.supportedQualities[0] as Quality);
      }
    }
  }
  const [brief, setBrief] = useState("");
  const [count, setCount] = useState(COUNT_DEFAULT);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [partialNotice, setPartialNotice] = useState<string | null>(null);
  // Batch-first Phase 2 — submit sonrası batch handoff state.
  // Variation submit başarılı olduğunda batchId yüzeye çıkar; UI "View Batch"
  // CTA'sı render eder. Kullanıcı bağlamı reference'tan batch'e taşınır.
  const [lastBatch, setLastBatch] = useState<{
    batchId: string;
    requestedCount: number;
    successCount: number;
  } | null>(null);
  const create = useCreateVariations();

  async function onConfirm() {
    setPartialNotice(null);
    // Phase 9 — provider quality desteklemiyorsa payload'a koyma.
    // CreateVariationsBody.quality optional; server-side type-safe.
    const cap = getProviderCapability(providerId);
    const supportsQuality = (cap?.supportedQualities.length ?? 0) > 0;
    const out = await create.mutateAsync({
      referenceId,
      providerId,
      aspectRatio,
      ...(supportsQuality ? { quality } : {}),
      brief: brief.trim() || undefined,
      count,
    });
    setConfirmOpen(false);
    if (out.failedDesignIds && out.failedDesignIds.length > 0) {
      setPartialNotice(
        `${out.failedDesignIds.length}/${count} kuyruk başarısız oldu (${out.designIds.length} başarılı). Failed design'ları FAIL listesinden tekrar deneyebilirsin.`,
      );
    }
    if (out.batchId && out.designIds.length > 0) {
      setLastBatch({
        batchId: out.batchId,
        requestedCount: count,
        successCount: out.designIds.length,
      });
    }
  }

  return (
    <fieldset
      disabled={disabled}
      className="rounded-md border border-border bg-surface p-4 disabled:opacity-50"
    >
      <legend className="px-2 text-sm font-medium text-text">
        AI mode formu
      </legend>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-text">
          Provider
          <select
            value={providerId}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="h-control-md rounded-md border border-border bg-bg px-3 text-sm text-text"
            data-testid="ai-mode-provider-select"
          >
            {PROVIDER_CAPABILITIES.map((p) => {
              const capabilityHint =
                p.capabilities.length === 1
                  ? p.capabilities[0] === "image-to-image"
                    ? " (image-to-image)"
                    : " (text-to-image)"
                  : "";
              const suffix = p.available
                ? capabilityHint
                : p.id === "kie-z-image"
                  ? " (text-to-image) — coming soon"
                  : "";
              return (
                <option key={p.id} value={p.id} disabled={!p.available}>
                  {p.label}
                  {suffix}
                </option>
              );
            })}
          </select>
          {/* Phase 8/9 — provider-aware helper text. Seçili provider
           * available değilse operatöre nedenini söyler (Midjourney
           * separate flow, Z-Image coming soon). */}
          {(() => {
            const cap = getProviderCapability(providerId);
            if (!cap) return null;
            if (cap.available) return null;
            return (
              <span
                className="text-xs text-text-muted"
                data-testid="ai-mode-provider-helper"
              >
                {cap.helperText ??
                  "This provider is not yet available — pick an available provider above."}
              </span>
            );
          })()}
        </label>
        <label className="flex flex-col gap-1 text-sm text-text">
          Aspect ratio
          <select
            value={aspectRatio}
            onChange={(e) => setAspect(parseAspectRatio(e.target.value))}
            className="h-control-md rounded-md border border-border bg-bg px-3 text-sm text-text"
            data-testid="ai-mode-aspect-select"
          >
            {/* Phase 9 — provider-aware aspect ratio options.
             * `CreateVariationsBody.aspectRatio` schema sözleşmesi
             * "1:1" | "2:3" | "3:2" — Z-Image kümesi (4:3, 16:9, ...)
             * şu an form'dan tetiklenmediği için (available: false)
             * sözleşme korunur. Provider değişikliğinde
             * `handleProviderChange` state'i validate eder. */}
            {(() => {
              const cap = getProviderCapability(providerId);
              const allowed = (cap?.supportedAspectRatios ?? []).filter(
                (r): r is AspectRatio =>
                  r === "1:1" || r === "2:3" || r === "3:2",
              );
              const opts = allowed.length > 0 ? allowed : (["2:3"] as AspectRatio[]);
              return opts.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ));
            })()}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-text">
          Kalite
          {/* Phase 9 — provider-aware quality. Provider quality
           * desteklemiyorsa dropdown disabled + helper text. */}
          {(() => {
            const cap = getProviderCapability(providerId);
            const hasQuality = (cap?.supportedQualities.length ?? 0) > 0;
            return (
              <>
                <select
                  value={quality}
                  onChange={(e) => setQuality(parseQuality(e.target.value))}
                  disabled={!hasQuality}
                  className="h-control-md rounded-md border border-border bg-bg px-3 text-sm text-text disabled:opacity-60"
                  data-testid="ai-mode-quality-select"
                >
                  {hasQuality
                    ? cap!.supportedQualities.map((q) => (
                        <option key={q} value={q}>
                          {q}
                        </option>
                      ))
                    : (
                        <option value="medium">— not supported</option>
                      )}
                </select>
                {!hasQuality ? (
                  <span
                    className="text-xs text-text-muted"
                    data-testid="ai-mode-quality-helper"
                  >
                    Quality parameter is not supported by this provider.
                  </span>
                ) : null}
              </>
            );
          })()}
        </label>
        <label className="flex flex-col gap-1 text-sm text-text">
          Görsel sayısı: <span className="font-medium">{count}</span>
          <input
            type="range"
            min={COUNT_MIN}
            max={COUNT_MAX}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="accent-accent"
          />
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-sm text-text">
        Style note / ek yönlendirme (opsiyonel)
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value.slice(0, BRIEF_MAX))}
          maxLength={BRIEF_MAX}
          rows={3}
          className="rounded-md border border-border bg-bg p-2 text-sm text-text"
          placeholder="e.g. pastel tones, no text, soft watercolor"
        />
        <span className="text-xs text-text-muted">
          Appended to the system prompt, doesn&apos;t replace it. {brief.length}/{BRIEF_MAX}
        </span>
      </label>
      {partialNotice ? (
        <div
          role="alert"
          className="mt-3 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm text-text"
        >
          {partialNotice}
        </div>
      ) : null}
      {/* Batch-first Phase 2 — submit sonrası batch handoff banner.
       * Kullanıcı "üretim başlattım, şimdi hangi batch'e bakıyorum?"
       * sorusunda kaybolmasın diye batchId görünür ve clickable hale gelir.
       * Variations grid aşağıda canlı güncellenmeye devam eder; bu CTA
       * kullanıcıya batch detail'e geçme opsiyonu sunar. */}
      {lastBatch ? (
        <div
          role="status"
          className="mt-3 flex items-center justify-between gap-3 rounded-md border border-success bg-success-soft px-3 py-2"
          data-testid="ai-mode-batch-handoff"
        >
          <div className="flex-1">
            <div className="text-[13px] font-medium text-ink">
              Batch started · {lastBatch.successCount}/{lastBatch.requestedCount} queued
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              BATCH {lastBatch.batchId.slice(0, 12).toUpperCase()}
            </div>
          </div>
          <Link
            href={`/batches/${lastBatch.batchId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-success bg-paper px-3 text-xs font-medium text-success hover:bg-success-soft"
            data-testid="ai-mode-view-batch"
          >
            View Batch
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      ) : null}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={disabled}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          Generate
        </button>
      </div>

      <CostConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={count}
        busy={create.isPending}
        errorMessage={create.error?.message ?? null}
        onConfirm={onConfirm}
      />
    </fieldset>
  );
}
