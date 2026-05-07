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

const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "4:3", "3:4", "16:9", "9:16"] as const;
type AspectRatio = (typeof ASPECT_RATIOS)[number];

const DEFAULT_PROMPT = "abstract wall art test pattern minimalist orange beige";

type TestRenderFormProps = {
  /** Bridge erişilebilir mi (parent server-side fetchHealth sonucu). */
  bridgeOk: boolean;
  /** Driver kimliği (mock kullanıcıya bilgi olarak göster). */
  driverKind?: string;
};

type ReferenceOption = { id: string; label: string };

function extractList(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object" && "items" in json) {
    const items = (json as { items: unknown }).items;
    if (Array.isArray(items)) return items as Record<string, unknown>[];
  }
  return [];
}

export function TestRenderForm({ bridgeOk, driverKind }: TestRenderFormProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [referenceId, setReferenceId] = useState<string>("");
  const [refOptions, setRefOptions] = useState<ReferenceOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Pass 56 — Reference picker (opsiyonel; boş bırakılırsa eski davranış,
  // operatör detail page'den manuel promote eder. Seçilirse ingestOutputs
  // sonunda auto-promote → 4 GeneratedDesign Review queue'ya doğal akış).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/references?limit=50");
        const json: unknown = await res.json().catch(() => null);
        if (cancelled) return;
        const items = extractList(json);
        const mapped: ReferenceOption[] = items
          .map((r) => {
            const pt = r["productType"] as
              | { displayName?: string; key?: string }
              | undefined;
            const ptLabel = pt?.displayName ?? pt?.key ?? "?";
            const note =
              (r["notes"] as string | undefined)?.slice(0, 30) || "—";
            return {
              id: String(r["id"] ?? ""),
              label: `${ptLabel} · ${note}`,
            };
          })
          .filter((r) => r.id);
        setRefOptions(mapped);
      } catch {
        if (!cancelled) setRefOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/midjourney/test-render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            aspectRatio,
            ...(referenceId ? { referenceId } : {}),
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
        Mock driver'da fixture grid kullanılır.
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

        {/* Pass 56 — Reference seçilirse ingestOutputs sonunda
            auto-promote tetiklenir; boş bırakılırsa eski davranış. */}
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-muted">
            Reference (opsiyonel · auto-promote)
          </span>
          <select
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            disabled={disabled || !refOptions}
            className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs disabled:opacity-50"
            data-testid="mj-test-render-ref"
          >
            <option value="">— yok (manuel promote) —</option>
            {(refOptions ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

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
