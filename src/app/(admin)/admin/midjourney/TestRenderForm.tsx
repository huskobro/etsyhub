"use client";

// Pass 50 — Admin "Test Render" tetikleyici formu.
//
// Operator yüzeyi: küçük prompt input + aspect ratio + Submit.
// POST /api/admin/midjourney/test-render → bridge enqueue + DB row +
// BullMQ poll. Server response sonrası router.refresh() ile sayfa
// reload (yeni job tabloda).
//
// UX kuralları:
//  • Bridge erişilemiyorsa form disabled (parent kontrol eder).
//  • Mock driver durumunda kullanıcıya açıkça "mock" notu gösterilir.
//  • Submit sırasında button loading; double-submit engelli.
//  • Bridge unreachable cevabı net mesajla gösterilir.

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ReferencePicker } from "./[id]/ReferencePicker";
import { useLocalStoragePref } from "./useLocalStoragePref";
import {
  isSubmitStrategy,
  MJ_PREFERENCE_DEFS,
  type SubmitStrategyPref,
} from "./preferences";

const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "4:3", "3:4", "16:9", "9:16"] as const;
type AspectRatio = (typeof ASPECT_RATIOS)[number];

const DEFAULT_PROMPT = "abstract wall art test pattern minimalist orange beige";

type TestRenderFormProps = {
  /** Bridge erişilebilir mi (parent server-side fetchHealth sonucu). */
  bridgeOk: boolean;
  /** Driver kimliği (mock kullanıcıya bilgi olarak göster). */
  driverKind?: string;
};

export function TestRenderForm({ bridgeOk, driverKind }: TestRenderFormProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [referenceId, setReferenceId] = useState<string>("");
  // Pass 65 — Image-prompt URL'leri (HTTPS). Newline-separated input,
  // submit'te split + filter. Frontend pre-validation: HTTPS-only,
  // max 10 URL (server-side z.array().max(10) ile çift kontrol).
  const [referenceUrlsRaw, setReferenceUrlsRaw] = useState<string>("");
  // Pass 71 — Style reference (--sref) URL'leri. HTTPS, max 5.
  // Prompt-string flag (AutoSail audit kanıtı), ayrı endpoint yok.
  const [styleRefUrlsRaw, setStyleRefUrlsRaw] = useState<string>("");
  // Pass 75.1 — Global style weight (--sw N). Per-URL `URL ::N` ile
  // ortogonal. MJ UI'da "Style Weight" etiketi bunu yansıtır. Boş bırakılırsa
  // gönderilmez (MJ default 100).
  const [styleWeightRaw, setStyleWeightRaw] = useState<string>("");
  // Pass 71 — Omni reference (--oref) tek URL + omni weight (0-1000).
  const [omniRefUrl, setOmniRefUrl] = useState<string>("");
  const [omniWeightRaw, setOmniWeightRaw] = useState<string>("");
  // Pass 73 — Character reference (--cref) V6-only. URL list, weight YOK.
  // oref ile mutually-exclusive (service-level guard + UI-level uyarı).
  const [characterRefUrlsRaw, setCharacterRefUrlsRaw] = useState<string>("");
  // Pass 75 — Submit strategy: global default (preferences) + per-job
  // override. Pass 74'te yalnızca per-job vardı; Pass 75'te preferences
  // panel'i baz alır, kullanıcı override edebilir.
  const submitStrategyDef = MJ_PREFERENCE_DEFS.defaultSubmitStrategy;
  const [defaultSubmitStrategy] = useLocalStoragePref<SubmitStrategyPref>(
    submitStrategyDef.storageKey,
    submitStrategyDef.default,
    isSubmitStrategy,
  );
  // Per-job override (form state) — preferences default'tan başlar.
  const [submitStrategy, setSubmitStrategy] =
    useState<SubmitStrategyPref>(defaultSubmitStrategy);
  // Cross-tab sync: preferences değişirse form reset (ama kullanıcı
  // bilinçli override etmediyse). Pratikte: Preferences panel'de değişince
  // TestRenderForm'da default da güncellenir; aktif override sürer.
  useEffect(() => {
    setSubmitStrategy(defaultSubmitStrategy);
  }, [defaultSubmitStrategy]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Pass 56-58 — Reference picker (opsiyonel; boş bırakılırsa eski
  // davranış, operatör detail page'den manuel promote eder. Seçilirse
  // ingestOutputs sonunda auto-promote → 4 GeneratedDesign Review queue'ya
  // doğal akış). Pass 58: arama destekli ReferencePicker.

  const disabled = !bridgeOk || pending;

  // Pass 51 — submit success sonrası tabloyu auto-refresh et.
  // Server component sayfa state-driven olduğu için router.refresh()
  // tablo'yu yeniden render eder. 90sn boyunca her 4sn refresh; süre
  // dolduğunda durur (operatör manuel reload yapabilir). Mock driver'da
  // job 5sn'de complete olabilir; real driver'da 30-90sn.
  useEffect(() => {
    if (!success) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - startedAt > 90_000) {
        window.clearInterval(id);
        return;
      }
      router.refresh();
    }, 4000);
    return () => window.clearInterval(id);
  }, [success, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Pass 65 — Image-prompt URL parse + frontend pre-validation
    const referenceUrls = referenceUrlsRaw
      .split(/\s*\n\s*/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (referenceUrls.length > 10) {
      setError(
        `Referans URL maksimum 10 (geçen: ${referenceUrls.length}). Gerekirse iki ayrı job çalıştır.`,
      );
      return;
    }
    const nonHttps = referenceUrls.find((u) => !u.startsWith("https://"));
    if (nonHttps) {
      setError(
        `Referans URL'leri SADECE HTTPS olabilir (R17.2). Hatalı: ${nonHttps.slice(0, 60)}…`,
      );
      return;
    }

    // Pass 71/75 — Style reference (--sref). Pass 75: weight format
    //   "https://...::200" → { url, weight: 200 }
    //   "https://..."      → string (default weight=1)
    // Bridge buildMJPromptString iki tipi de handle eder.
    const styleRefLines = styleRefUrlsRaw
      .split(/\s*\n\s*/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (styleRefLines.length > 5) {
      setError(
        `Style reference URL maksimum 5 (geçen: ${styleRefLines.length}).`,
      );
      return;
    }
    const styleReferenceUrls: Array<string | { url: string; weight: number }> =
      [];
    for (const line of styleRefLines) {
      // Pass 75 — `URL::N` parse. URL https:// ile başlamak zorunda;
      // sonrasındaki `::N` opsiyonel weight (0-1000 integer).
      const sepIdx = line.lastIndexOf("::");
      if (sepIdx > 8 /* "https://" minimum */) {
        const candidateUrl = line.slice(0, sepIdx);
        const weightRaw = line.slice(sepIdx + 2);
        if (/^\d+$/.test(weightRaw) && candidateUrl.startsWith("https://")) {
          const weight = Number(weightRaw);
          if (weight < 0 || weight > 1000) {
            setError(
              `Style reference weight 0-1000 arası tam sayı olmalı (geçen: ${weight}).`,
            );
            return;
          }
          styleReferenceUrls.push({ url: candidateUrl, weight });
          continue;
        }
      }
      if (!line.startsWith("https://")) {
        setError(
          `Style reference URL'leri SADECE HTTPS (R17.2). Hatalı: ${line.slice(0, 60)}…`,
        );
        return;
      }
      styleReferenceUrls.push(line);
    }
    // Pass 71 — Omni reference (--oref) tek URL.
    const omniRefTrim = omniRefUrl.trim();
    if (omniRefTrim.length > 0 && !omniRefTrim.startsWith("https://")) {
      setError(`Omni reference SADECE HTTPS (R17.2).`);
      return;
    }
    const omniWeightTrim = omniWeightRaw.trim();
    let omniWeight: number | undefined;
    if (omniWeightTrim.length > 0) {
      const parsed = Number(omniWeightTrim);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000) {
        setError("Omni weight 0-1000 arası tam sayı olmalı.");
        return;
      }
      omniWeight = parsed;
    }
    // Pass 75.1 — Global style weight (--sw N).
    const styleWeightTrim = styleWeightRaw.trim();
    let styleWeight: number | undefined;
    if (styleWeightTrim.length > 0) {
      const parsedSw = Number(styleWeightTrim);
      if (!Number.isInteger(parsedSw) || parsedSw < 0 || parsedSw > 1000) {
        setError("Style weight (--sw) 0-1000 arası tam sayı olmalı.");
        return;
      }
      styleWeight = parsedSw;
    }

    // Pass 73 — Character reference (--cref) V6-only URL list.
    const characterReferenceUrls = characterRefUrlsRaw
      .split(/\s*\n\s*/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (characterReferenceUrls.length > 5) {
      setError(
        `Character reference URL maksimum 5 (geçen: ${characterReferenceUrls.length}).`,
      );
      return;
    }
    const cNonHttps = characterReferenceUrls.find(
      (u) => !u.startsWith("https://"),
    );
    if (cNonHttps) {
      setError(
        `Character reference URL'leri SADECE HTTPS (R17.2). Hatalı: ${cNonHttps.slice(0, 60)}…`,
      );
      return;
    }
    // cref/oref mutually-exclusive (V6 vs V7+) frontend pre-check.
    if (characterReferenceUrls.length > 0 && omniRefTrim.length > 0) {
      setError(
        "--cref (V6) ve --oref (V7+) birlikte gönderilemez. İkisinden birini seç.",
      );
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/midjourney/test-render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            aspectRatio,
            ...(referenceId ? { referenceId } : {}),
            ...(referenceUrls.length > 0 ? { referenceUrls } : {}),
            ...(styleReferenceUrls.length > 0 ? { styleReferenceUrls } : {}),
            ...(styleWeight !== undefined ? { styleWeight } : {}),
            ...(omniRefTrim.length > 0 ? { omniReferenceUrl: omniRefTrim } : {}),
            ...(omniWeight !== undefined ? { omniWeight } : {}),
            ...(characterReferenceUrls.length > 0
              ? { characterReferenceUrls }
              : {}),
            // Pass 75 — submitStrategy her zaman gönder (auto dahil) —
            // service tarafı default mapping'i yapar; metadata'da
            // kullanıcının istediği vs gerçek submitMethod ayrı görünür.
            submitStrategy,
          }),
        });
        const json = (await res.json().catch(() => null)) as
          | {
              ok: true;
              jobId: string;
              midjourneyJobId: string;
              bridgeJobId: string;
            }
          | { ok: false; error: string; code?: string }
          | null;
        if (!res.ok || !json || json.ok !== true) {
          const msg =
            (json && json.ok === false && json.error) ||
            `HTTP ${res.status}`;
          setError(msg);
          return;
        }
        setSuccess(
          `Job tetiklendi · midjourneyJobId=${json.midjourneyJobId.slice(0, 8)}…`,
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bilinmeyen hata");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4"
      data-testid="mj-test-render-form"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Test Render</h2>
        <span className="text-xs text-text-muted">
          Driver: <span className="font-mono">{driverKind ?? "—"}</span>
        </span>
      </div>

      <p className="text-xs text-text-muted">
        Bridge enqueue + worker poll + ingest zincirini canlı koşturur. Bu
        operatör tetikleyicisi MJ credit harcayabilir (gerçek driver).
        Mock driver&apos;da fixture grid kullanılır.
      </p>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-text-muted">Prompt</span>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={disabled}
          minLength={3}
          maxLength={800}
          required
          className="rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-xs disabled:opacity-50"
          placeholder="abstract wall art..."
        />
      </label>

      {/* Pass 65 — Image-prompt URL alanı (HTTPS, max 10).
          Bridge "Add Images → Image Prompts" popover'ından file input'a
          upload eder. URL paste-as-image-prompt MJ V8 web'de çalışmıyor;
          gerçek upload ile yapılır. */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-text-muted">
          Referans URL&apos;leri (opsiyonel · HTTPS · satır başına 1)
        </span>
        <textarea
          value={referenceUrlsRaw}
          onChange={(e) => setReferenceUrlsRaw(e.target.value)}
          disabled={disabled}
          rows={3}
          maxLength={4000}
          className="rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-xs disabled:opacity-50"
          placeholder={
            "https://upload.wikimedia.org/.../example1.png\nhttps://.../example2.jpg"
          }
          data-testid="mj-test-render-reference-urls"
        />
        <span className="text-text-muted">
          MJ V8 &quot;Add Images → Image Prompts&quot; üzerinden upload edilir.
          Public erişilebilir HTTPS URL gerek (R17.2). Max 10 URL.
        </span>
      </label>

      {/* Pass 71/75/75.1 — Style reference (--sref). AutoSail main.js
          literal kanıt: per-URL weight syntax `URL ::N` (BOŞLUKLU). Pass
          75 V0 boşluksuz `URL::N` üretiyordu, MJ UI etiket düşmedi; Pass
          75.1'de düzeltildi. Satır başına 1 URL; opsiyonel `::N`. Max 5. */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-text-muted">
          Style reference URL&apos;leri (--sref · opsiyonel · HTTPS · max 5)
        </span>
        <textarea
          value={styleRefUrlsRaw}
          onChange={(e) => setStyleRefUrlsRaw(e.target.value)}
          disabled={disabled}
          rows={2}
          maxLength={2000}
          className="rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-xs disabled:opacity-50"
          placeholder={"https://.../style-ref-1.png\nhttps://.../style-ref-2.png::200"}
          data-testid="mj-test-render-style-ref-urls"
        />
        <span className="text-text-muted">
          Format: <code>https://...</code> (default weight) veya{" "}
          <code>https://...::N</code> (weight 0-1000, per-URL — AutoSail
          pattern, MJ render flag&apos;e <code>URL ::N</code> boşluklu çevrilir).
          Global tüm sref+oref için ayrıca aşağıdaki <code>--sw</code>
          alanı kullanılır.
        </span>
      </label>

      {/* Pass 75.1 — Global style weight (--sw N). AutoSail main.js
          known-flag listesi: ["ow","sw","cw","chaos","stylize","weird","sv"].
          Per-URL `::N` ile ortogonal — MJ UI'da "Style Weight" etiketi.
          Boş bırakılırsa MJ default (V7+ 100). */}
      <label className="flex flex-col gap-1 text-xs" data-testid="mj-test-render-style-weight-row">
        <span className="text-text-muted">
          Global style weight (--sw · 0-1000 · opsiyonel)
        </span>
        <input
          type="number"
          value={styleWeightRaw}
          onChange={(e) => setStyleWeightRaw(e.target.value)}
          disabled={disabled}
          min={0}
          max={1000}
          className="w-32 rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-xs disabled:opacity-50"
          placeholder="ör. 250"
          data-testid="mj-test-render-style-weight"
        />
        <span className="text-text-muted">
          Tüm sref+oref karışımına global style etkisi (MJ UI: &quot;Style
          Weight&quot; rozeti). Per-URL <code>::N</code> ile farklı amaç.
        </span>
      </label>

      {/* Pass 71 — Omni reference (--oref --ow N). V7+ premium feature.
          Tek URL + opsiyonel weight (0-1000). */}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-text-muted">
            Omni reference URL (--oref · V7+ · opsiyonel)
          </span>
          <input
            type="text"
            value={omniRefUrl}
            onChange={(e) => setOmniRefUrl(e.target.value)}
            disabled={disabled}
            maxLength={500}
            className="rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-xs disabled:opacity-50"
            placeholder="https://.../character-ref.png"
            data-testid="mj-test-render-omni-ref-url"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-muted">--ow (0-1000)</span>
          <input
            type="number"
            value={omniWeightRaw}
            onChange={(e) => setOmniWeightRaw(e.target.value)}
            disabled={disabled}
            min={0}
            max={1000}
            className="w-24 rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-xs disabled:opacity-50"
            data-testid="mj-test-render-omni-weight"
          />
        </label>
      </div>

      {/* Pass 73 — Character reference (--cref) V6-only URL list.
          AutoSail audit: weight desteği yok, oref ile mutually-exclusive
          (V6 vs V7+). Service tarafı redundant check. */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-text-muted">
          Character reference URL&apos;leri (--cref · V6 only · max 5)
        </span>
        <textarea
          value={characterRefUrlsRaw}
          onChange={(e) => setCharacterRefUrlsRaw(e.target.value)}
          disabled={disabled}
          rows={2}
          maxLength={2000}
          className="rounded-md border border-border bg-bg px-3 py-1.5 font-mono text-xs disabled:opacity-50"
          placeholder={"https://.../character-ref-1.png"}
          data-testid="mj-test-render-character-ref-urls"
        />
        <span className="text-text-muted">
          --cref V6 modeli ile çalışır. --oref ile birlikte gönderilemez
          (V6 vs V7+). Weight desteği yok (URL listesi space-separated).
        </span>
      </label>

      {/* Pass 74 — Submit strategy selector (auto / api-first / dom-first).
          Pass 71'in `preferApiSubmit` checkbox'ı genişletildi. "auto"
          bridge'de capability bazında en sağlam yolu seçer; Pass 74
          sonrası image-prompt da API-first uyumlu (storage-upload-file
          + prompt ön-eki). */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-text">Submit strategy</span>
          <span
            className="rounded bg-bg px-1.5 py-0.5 text-text-muted"
            data-testid="mj-test-render-strategy-default"
            title="Preferences panel'inde değiştirilebilir."
          >
            varsayılan: <code>{defaultSubmitStrategy}</code>
          </span>
        </span>
        <select
          value={submitStrategy}
          onChange={(e) =>
            setSubmitStrategy(e.target.value as SubmitStrategyPref)
          }
          disabled={disabled}
          className="rounded-md border border-border bg-bg px-2 py-1 disabled:opacity-50"
          data-testid="mj-test-render-submit-strategy"
        >
          <option value="auto">Auto (önerilen)</option>
          <option value="api-first">API-first</option>
          <option value="dom-first">DOM-first</option>
        </select>
        <span className="text-text-muted">
          <strong>Auto</strong>: bridge en sağlam yolu seçer (Pass 74
          sonrası image-prompt dahil API). <strong>API-first</strong>:
          POST /api/submit-jobs → DOM yok (görünmez, hızlı). Fail →
          DOM fallback. <strong>DOM-first</strong>: Pass 49 typing +
          submit; sayfada görünür akış (manuel takip).
        </span>
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-muted">Aspect ratio</span>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
            disabled={disabled}
            className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {ASPECT_RATIOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        {/* Pass 56-58 — Reference seçilirse ingestOutputs sonunda
            auto-promote tetiklenir; boş bırakılırsa eski davranış.
            Pass 58: arama destekli ReferencePicker. */}
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-text-muted">
            Reference (opsiyonel · auto-promote)
          </span>
          <ReferencePicker
            value={referenceId}
            onChange={(id) => setReferenceId(id)}
            allowEmpty
            disabled={disabled}
            testIdPrefix="mj-test-render-ref"
          />
        </div>

        <button
          type="submit"
          disabled={disabled}
          className="rounded-md border border-accent bg-accent px-4 py-1.5 text-xs font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-40"
          data-testid="mj-test-render-submit"
        >
          {pending ? "Tetikleniyor…" : "Test Render Tetikle"}
        </button>
      </div>

      {!bridgeOk ? (
        <p className="text-xs text-text-muted">
          ⓘ Bridge erişilebilir değil. Önce kurulum ipucundaki adımları
          tamamlayın, sonra sayfayı yenileyin.
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-danger" data-testid="mj-test-render-error">
          ⚠ {error}
        </p>
      ) : null}
      {success ? (
        <p
          className="text-xs text-success"
          data-testid="mj-test-render-success"
        >
          ✓ {success}
        </p>
      ) : null}
    </form>
  );
}
