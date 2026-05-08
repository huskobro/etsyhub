"use client";

// Pass 81 — Batch Run form (client).
//
// Akış:
//   1. Template select (preselected destekli — querystring ?templateId=)
//   2. Variable Sets JSON textarea
//   3. JSON parse + variable mismatch detect (live)
//   4. Preview: ilk variable set ile expand göster
//   5. Aspect ratio + submitStrategy
//   6. Submit → POST /api/admin/midjourney/test-render-batch
//   7. Sonuç: totalSubmitted/totalFailed + her job'a link

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";

const ASPECT_RATIOS = ["1:1", "2:3", "3:2", "4:3", "3:4", "16:9", "9:16"] as const;
type AspectRatio = (typeof ASPECT_RATIOS)[number];

const SUBMIT_STRATEGIES = ["auto", "api-first", "dom-first"] as const;
type SubmitStrategy = (typeof SUBMIT_STRATEGIES)[number];

const VAR_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

function extractVars(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(VAR_PATTERN)) {
    if (m[1]) found.add(m[1]);
  }
  return Array.from(found);
}

function expandLocal(text: string, vars: Record<string, string>): string {
  return text.replace(VAR_PATTERN, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return vars[name] ?? "";
    }
    return match;
  });
}

type TemplateOpt = {
  id: string;
  name: string;
  promptTemplateText: string;
  templateVariables: string[];
  activeVersion: number | null;
};

type BatchRunFormProps = {
  templates: TemplateOpt[];
  preselectedTemplateId?: string;
};

const DEFAULT_VARIABLE_SETS = `[
  {
    "subject": "boho mandala wall art",
    "style": "watercolor",
    "mood": "calming"
  },
  {
    "subject": "boho mandala wall art",
    "style": "ink line",
    "mood": "minimal"
  }
]`;

type BatchResult = {
  ok: true;
  templateSnapshot: {
    promptTemplate: string;
    templateId?: string;
    versionId?: string;
    version?: number;
  };
  totalRequested: number;
  totalSubmitted: number;
  totalFailed: number;
  results: Array<
    | {
        ok: true;
        index: number;
        midjourneyJobId: string;
        jobId: string;
        bridgeJobId: string;
        expandedPrompt: string;
        variables: Record<string, string>;
      }
    | {
        ok: false;
        index: number;
        error: string;
        variables: Record<string, string>;
      }
  >;
};

export function BatchRunForm({ templates, preselectedTemplateId }: BatchRunFormProps) {
  // Selection
  const [templateId, setTemplateId] = useState<string>(
    preselectedTemplateId && templates.some((t) => t.id === preselectedTemplateId)
      ? preselectedTemplateId
      : templates[0]?.id ?? "",
  );
  const selected = templates.find((t) => t.id === templateId);

  // Variable sets — JSON textarea
  const [variableSetsRaw, setVariableSetsRaw] = useState<string>(
    DEFAULT_VARIABLE_SETS,
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [submitStrategy, setSubmitStrategy] =
    useState<SubmitStrategy>("api-first");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [pending, startTransition] = useTransition();

  // Live parse + validation
  const parsed = useMemo(() => {
    try {
      const v = JSON.parse(variableSetsRaw) as unknown;
      if (!Array.isArray(v)) {
        return { ok: false as const, error: "JSON bir array olmalı" };
      }
      if (v.length === 0) {
        return { ok: false as const, error: "En az 1 variable set gerek" };
      }
      if (v.length > 50) {
        return {
          ok: false as const,
          error: `Max 50 variable set (geçen: ${v.length})`,
        };
      }
      // Her entry object + string-only values
      for (let i = 0; i < v.length; i++) {
        const entry = v[i];
        if (
          typeof entry !== "object" ||
          entry === null ||
          Array.isArray(entry)
        ) {
          return {
            ok: false as const,
            error: `[${i}] entry object olmalı`,
          };
        }
        for (const [k, val] of Object.entries(entry as Record<string, unknown>)) {
          if (typeof val !== "string") {
            return {
              ok: false as const,
              error: `[${i}].${k} string olmalı (aldığı: ${typeof val})`,
            };
          }
          if (val.length > 200) {
            return {
              ok: false as const,
              error: `[${i}].${k} max 200 karakter`,
            };
          }
        }
      }
      return { ok: true as const, sets: v as Array<Record<string, string>> };
    } catch (e) {
      return {
        ok: false as const,
        error: `JSON parse hatası: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }, [variableSetsRaw]);

  // Variable mismatch detection
  const mismatch = useMemo(() => {
    if (!selected || !parsed.ok) return null;
    const tplVars = new Set(selected.templateVariables);
    const missingPerEntry: Array<{ index: number; missing: string[]; extra: string[] }> = [];
    for (let i = 0; i < parsed.sets.length; i++) {
      const entry = parsed.sets[i] ?? {};
      const entryKeys = new Set(Object.keys(entry));
      const missing: string[] = [];
      for (const v of tplVars) {
        if (!entryKeys.has(v)) missing.push(v);
      }
      const extra: string[] = [];
      for (const k of entryKeys) {
        if (!tplVars.has(k)) extra.push(k);
      }
      if (missing.length > 0 || extra.length > 0) {
        missingPerEntry.push({ index: i, missing, extra });
      }
    }
    return missingPerEntry;
  }, [selected, parsed]);

  // Preview: ilk entry ile expand
  const preview = useMemo(() => {
    if (!selected || !parsed.ok) return null;
    const first = parsed.sets[0];
    if (!first) return null;
    return expandLocal(selected.promptTemplateText, first);
  }, [selected, parsed]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 6000);
      return () => clearTimeout(t);
    }
  }, [success]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setResult(null);

    if (!selected) {
      setError("Template seçilmedi");
      return;
    }
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch(
          "/api/admin/midjourney/test-render-batch",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              templateId: selected.id,
              variableSets: parsed.sets,
              aspectRatio,
              submitStrategy,
            }),
          },
        );
        const json = (await res.json().catch(() => null)) as
          | (BatchResult & { ok: true })
          | { ok: false; error: string; code?: string }
          | null;
        if (!res.ok || !json || json.ok !== true) {
          const msg =
            (json && json.ok === false && json.error) ||
            `HTTP ${res.status}`;
          setError(msg);
          return;
        }
        setResult(json);
        setSuccess(
          `${json.totalSubmitted}/${json.totalRequested} job submit edildi${
            json.totalFailed > 0 ? ` (${json.totalFailed} fail)` : ""
          }`,
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Bilinmeyen istek hatası",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      data-testid="mj-batch-run-form"
    >
      {/* Template select */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-text-muted">Template</span>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          disabled={pending}
          className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm disabled:opacity-50"
          data-testid="mj-batch-run-template"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.activeVersion ? `(v${t.activeVersion})` : "(no active)"}
            </option>
          ))}
        </select>
        {selected ? (
          <span className="text-xs text-text-muted">
            Variables:{" "}
            {selected.templateVariables.length === 0
              ? "—"
              : selected.templateVariables.join(", ")}
          </span>
        ) : null}
      </label>

      {/* Template metni preview */}
      {selected ? (
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <span className="text-xs font-semibold text-text-muted">
            Template metni
          </span>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs">
            {selected.promptTemplateText}
          </pre>
        </div>
      ) : null}

      {/* Variable Sets JSON */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-text-muted">
          Variable Sets (JSON array, max 50)
        </span>
        <textarea
          value={variableSetsRaw}
          onChange={(e) => setVariableSetsRaw(e.target.value)}
          disabled={pending}
          rows={10}
          className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs disabled:opacity-50"
          data-testid="mj-batch-run-variable-sets"
        />
        {parsed.ok ? (
          <span className="text-xs text-text-muted">
            ✓ {parsed.sets.length} variable set
          </span>
        ) : (
          <span className="text-xs text-danger" data-testid="mj-batch-run-json-error">
            ✕ {parsed.error}
          </span>
        )}
      </label>

      {/* Variable mismatch warning */}
      {mismatch && mismatch.length > 0 ? (
        <div className="rounded-md border border-warning bg-warning-soft p-3 text-xs">
          <span className="font-semibold">Variable mismatch:</span>
          <ul className="mt-1 space-y-0.5">
            {mismatch.slice(0, 5).map((m) => (
              <li key={m.index}>
                <code>[{m.index}]</code>
                {m.missing.length > 0 ? (
                  <span className="ml-1 text-danger">
                    eksik: {m.missing.join(", ")}
                  </span>
                ) : null}
                {m.extra.length > 0 ? (
                  <span className="ml-1 text-text-muted">
                    fazlalık: {m.extra.join(", ")}
                  </span>
                ) : null}
              </li>
            ))}
            {mismatch.length > 5 ? (
              <li className="text-text-muted">+{mismatch.length - 5} daha</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* Preview */}
      {preview ? (
        <div
          className="rounded-md border border-border bg-surface p-3"
          data-testid="mj-batch-run-preview"
        >
          <span className="text-xs font-semibold text-text-muted">
            Preview (ilk variable set)
          </span>
          <p className="mt-1 font-mono text-xs">{preview}</p>
        </div>
      ) : null}

      {/* Aspect + Strategy */}
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-muted">Aspect Ratio</span>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
            disabled={pending}
            className="w-32 rounded-md border border-border bg-bg px-3 py-1.5 text-sm disabled:opacity-50"
            data-testid="mj-batch-run-aspect"
          >
            {ASPECT_RATIOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-muted">Submit Strategy</span>
          <select
            value={submitStrategy}
            onChange={(e) =>
              setSubmitStrategy(e.target.value as SubmitStrategy)
            }
            disabled={pending}
            className="w-44 rounded-md border border-border bg-bg px-3 py-1.5 text-sm disabled:opacity-50"
            data-testid="mj-batch-run-strategy"
          >
            {SUBMIT_STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Error / Success */}
      {error ? (
        <div
          className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
          data-testid="mj-batch-run-error"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          className="rounded-md border border-success bg-success-soft px-3 py-2 text-sm text-success"
          data-testid="mj-batch-run-success"
        >
          {success}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !parsed.ok || !selected}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          data-testid="mj-batch-run-submit"
        >
          {pending ? "Batch tetikleniyor…" : "Batch Run"}
        </button>
      </div>

      {/* Result summary */}
      {result ? (
        <div
          className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-surface p-4"
          data-testid="mj-batch-run-result"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Batch Sonucu</h3>
            <span className="text-xs text-text-muted">
              Template snapshot: v{result.templateSnapshot.version ?? "?"}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <span>
              <span className="text-text-muted">Requested:</span>{" "}
              <code className="font-mono">{result.totalRequested}</code>
            </span>
            <span>
              <span className="text-text-muted">Submitted:</span>{" "}
              <code className="font-mono text-success">
                {result.totalSubmitted}
              </code>
            </span>
            <span>
              <span className="text-text-muted">Failed:</span>{" "}
              <code className="font-mono text-danger">
                {result.totalFailed}
              </code>
            </span>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {result.results.map((r) =>
              r.ok ? (
                <li
                  key={r.index}
                  className="flex items-start gap-2 rounded border border-border bg-bg p-2"
                >
                  <span className="text-success">✓</span>
                  <span className="font-mono text-text-muted">
                    [{r.index}]
                  </span>
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <code className="break-words font-mono text-xs">
                      {r.expandedPrompt}
                    </code>
                    <Link
                      href={`/admin/midjourney/${r.midjourneyJobId}`}
                      className="text-accent underline"
                    >
                      Job: {r.midjourneyJobId.slice(0, 12)}…
                    </Link>
                  </div>
                </li>
              ) : (
                <li
                  key={r.index}
                  className="flex items-start gap-2 rounded border border-danger bg-danger-soft p-2"
                >
                  <span className="text-danger">✕</span>
                  <span className="font-mono text-text-muted">
                    [{r.index}]
                  </span>
                  <span className="flex-1 text-danger">{r.error}</span>
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
