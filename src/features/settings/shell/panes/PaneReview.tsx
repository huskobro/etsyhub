/* eslint-disable no-restricted-syntax */
// PaneReview — IA Phase 16. Review scoring config snapshot pane.
//
// CLAUDE.md Madde N + Madde O ürün anayasası gereği review scoring
// parametreleri Settings Registry üzerinden yönetilir. Bu turun
// kapsamı: parametreleri operatör/admin'e **görünür** yap (read-only
// snapshot). Yazma yüzeyi (admin override, prompt-block CRUD) ayrı
// turda; pane ID'si + render slot + builtin source kalıcı.
//
// Visible parametreler:
//   • Provider snapshot (kullanıcının seçili provider'ı)
//   • Decision threshold'lar (low / high)
//   • Aktif kriter blokları (BUILTIN_CRITERIA)
//   • Compose token (audit drift göstergesi)
//
// v6 sabit boyutlar Settings shell whitelist'inde tanımlı.

"use client";

import { ShieldCheck } from "lucide-react";
import {
  BUILTIN_CRITERIA,
  composeVersionToken,
} from "@/providers/review/criteria";
import {
  REVIEW_THRESHOLD_HIGH,
  REVIEW_THRESHOLD_LOW,
} from "@/server/services/review/decision";

export function PaneReview() {
  // Compose token — wall_art (transparent değil) bağlamı default.
  // Admin cli'den farklı bağlam senaryolarını gözleyebilir; pane
  // tek bağlam yansıtır (referans değer).
  const sampleToken = composeVersionToken({
    productType: "wall_art",
    isTransparentTarget: false,
  });

  return (
    <div className="max-w-[680px] px-10 py-9">
      <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
        Review scoring
      </h2>
      <p className="mt-2 text-sm text-ink-2">
        AI kalite review sisteminin tetiklenmesi, threshold'ları ve
        kriter blokları. Yazma yüzeyi admin tarafına ileride; bu
        sayfa mevcut konfigürasyonu ve aktif builtin kriterleri
        görünür kılar.
      </p>

      {/* Provider + threshold snapshot */}
      <section className="mt-8" data-testid="review-pane-thresholds">
        <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          Decision rule
        </h3>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-3">Threshold low</dt>
          <dd className="font-mono text-ink">{REVIEW_THRESHOLD_LOW}/100</dd>
          <dt className="text-ink-3">Threshold high</dt>
          <dd className="font-mono text-ink">{REVIEW_THRESHOLD_HIGH}/100</dd>
          <dt className="text-ink-3">Mid-band default</dt>
          <dd className="text-ink">NEEDS_REVIEW (güvenli varsayılan)</dd>
          <dt className="text-ink-3">Risk → status</dt>
          <dd className="text-ink">
            riskFlags &gt; 0 ⇒ NEEDS_REVIEW (her durumda öncelikli)
          </dd>
        </dl>
        <p className="mt-3 text-xs text-ink-3">
          Bu sabitler hâlâ kod-level. Settings Registry'ye taşıma planlı
          (CLAUDE.md Madde M — Settings/admin yönelimi).
        </p>
      </section>

      {/* Cost discipline */}
      <section className="mt-8" data-testid="review-pane-cost">
        <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          Scoring cost disiplini
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-ink-2">
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-k-green" aria-hidden />
            <span>
              SYSTEM tarafından zaten skor verilmiş asset için tekrar
              Gemini çağrısı yapılmaz (already-scored guard).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-k-green" aria-hidden />
            <span>
              Operatör reset ederse (PATCH) snapshot temizlenir ve
              rerun enqueue olur.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 text-k-green" aria-hidden />
            <span>
              Image-content değişimi (background remove, crop, upscale,
              remaster, re-export, color edit) invalidation helper'ı
              tetikler — score reset + rerun.
            </span>
          </li>
        </ul>
      </section>

      {/* Criterion blocks */}
      <section className="mt-8" data-testid="review-pane-criteria">
        <div className="flex items-baseline justify-between">
          <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
            Kriter blokları
          </h3>
          <span className="font-mono text-[10px] tracking-wider text-ink-3">
            {BUILTIN_CRITERIA.filter((c) => c.active).length}/
            {BUILTIN_CRITERIA.length} active
          </span>
        </div>
        <ul className="mt-3 space-y-2.5">
          {BUILTIN_CRITERIA.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-line bg-paper p-3"
              data-testid="review-pane-criterion"
              data-active={c.active || undefined}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[12.5px] text-ink">
                    {c.id}
                  </span>
                  <span className="font-mono text-[10px] tracking-wider text-ink-3">
                    v{c.version}
                  </span>
                </div>
                <span
                  className={
                    c.active
                      ? "font-mono text-[10px] tracking-wider text-k-green"
                      : "font-mono text-[10px] tracking-wider text-ink-3"
                  }
                >
                  {c.active ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <div className="mt-1 text-sm text-ink-2">{c.label}</div>
              <div className="mt-1.5 text-xs text-ink-3">
                {c.blockText}
              </div>
              {c.productTypes ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.productTypes.map((p) => (
                    <span
                      key={p}
                      className="rounded-sm bg-ink/5 px-1.5 py-0.5 font-mono text-[10px] text-ink-2"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 font-mono text-[10px] text-ink-3">
                  Tüm ürün tiplerinde aktif
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Compose token (audit drift indicator) */}
      <section className="mt-8" data-testid="review-pane-compose-token">
        <h3 className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
          Compose token (sample · wall_art)
        </h3>
        <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-bg p-3 font-mono text-[11px] text-ink-2">
          {sampleToken}
        </pre>
        <p className="mt-2 text-xs text-ink-3">
          Bu token review snapshot'larında kayıtlı tutulur; audit drift
          tespiti için kullanılır (block id@version listesi).
        </p>
      </section>
    </div>
  );
}
