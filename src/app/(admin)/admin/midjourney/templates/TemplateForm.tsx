"use client";

// Pass 81 — Template create/edit form.
//
// Tek client component; mode="new" veya "edit" ile davranış değişir:
//   - new: POST /api/admin/midjourney/templates → templateId döndü → /[id]
//   - edit: PATCH /api/admin/midjourney/templates/[id] → toast + refresh
//
// Variable extraction live: textarea değişince {{var}}'ları parse eder,
// kullanıcıya hangi variable'lar olduğunu gösterir.

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TemplateFormProps = {
  mode: "new" | "edit";
  initial?: {
    id: string;
    name: string;
    description: string | null;
    productTypeKey: string | null;
    promptTemplateText: string;
  };
};

const VAR_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;
const VAR_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function extractVars(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(VAR_PATTERN)) {
    if (m[1]) found.add(m[1]);
  }
  return Array.from(found);
}

const NAME_REGEX = /^[a-zA-Z0-9 _\-./]+$/;

export function TemplateForm({ mode, initial }: TemplateFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [productTypeKey, setProductTypeKey] = useState(
    initial?.productTypeKey ?? "",
  );
  const [promptTemplateText, setPromptTemplateText] = useState(
    initial?.promptTemplateText ?? "",
  );
  const [changelog, setChangelog] = useState(""); // sadece edit mode

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const variables = useMemo(
    () => extractVars(promptTemplateText),
    [promptTemplateText],
  );

  const nameValid = useMemo(() => {
    if (mode === "edit") return true; // edit'te name değişmez (Pass 81 V1)
    if (name.trim().length < 2) return false;
    if (name.trim().length > 120) return false;
    return NAME_REGEX.test(name);
  }, [mode, name]);

  // Variable adlarını valide et — invalid varsa uyar
  const invalidVars = useMemo(
    () => variables.filter((v) => !VAR_NAME_REGEX.test(v)),
    [variables],
  );

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!nameValid) {
      setError(
        "İsim geçersiz: 2-120 karakter, sadece harf+rakam+boşluk+`_-./`",
      );
      return;
    }
    if (promptTemplateText.trim().length < 3) {
      setError("Template metni en az 3 karakter olmalı");
      return;
    }
    if (promptTemplateText.length > 2000) {
      setError("Template metni en fazla 2000 karakter olabilir");
      return;
    }

    startTransition(async () => {
      try {
        if (mode === "new") {
          const res = await fetch("/api/admin/midjourney/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              description: description.trim() || undefined,
              productTypeKey: productTypeKey.trim() || undefined,
              promptTemplateText: promptTemplateText.trim(),
            }),
          });
          const json = (await res.json().catch(() => null)) as
            | { ok: true; template: { templateId: string } }
            | { ok: false; error: string }
            | null;
          if (!res.ok || !json || json.ok !== true) {
            const msg =
              (json && json.ok === false && json.error) || `HTTP ${res.status}`;
            setError(msg);
            return;
          }
          // Yeni template → edit sayfasına yönlendir
          router.push(`/admin/midjourney/templates/${json.template.templateId}`);
          router.refresh();
        } else {
          const res = await fetch(
            `/api/admin/midjourney/templates/${initial!.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                promptTemplateText: promptTemplateText.trim(),
                description: description.trim() || undefined,
                changelog: changelog.trim() || undefined,
              }),
            },
          );
          const json = (await res.json().catch(() => null)) as
            | { ok: true; template: { version: number } }
            | { ok: false; error: string }
            | null;
          if (!res.ok || !json || json.ok !== true) {
            const msg =
              (json && json.ok === false && json.error) || `HTTP ${res.status}`;
            setError(msg);
            return;
          }
          setSuccess(`Yeni version: v${json.template.version}`);
          setChangelog("");
          router.refresh();
        }
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
      className="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
      data-testid="mj-template-form"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          {mode === "new" ? "Yeni MJ Template" : "Template Düzenle"}
        </h2>
        {mode === "edit" ? (
          <span className="text-xs text-text-muted">
            ID:{" "}
            <code className="font-mono">{initial!.id.slice(0, 12)}…</code>
          </span>
        ) : null}
      </div>

      {error ? (
        <div
          className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
          data-testid="mj-template-form-error"
        >
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          className="rounded-md border border-success bg-success-soft px-3 py-2 text-sm text-success"
          data-testid="mj-template-form-success"
        >
          {success}
        </div>
      ) : null}

      {/* Name (edit mode'da disabled) */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-text-muted">
          İsim {mode === "new" ? "(2-120, harf+rakam+boşluk)" : "(değiştirilemez)"}
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={mode === "edit" || pending}
          minLength={2}
          maxLength={120}
          className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm disabled:opacity-50"
          placeholder="Boho Wall Art Set"
          data-testid="mj-template-name"
        />
      </label>

      {/* Description */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-text-muted">Açıklama (opsiyonel, max 500)</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={pending}
          maxLength={500}
          className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm disabled:opacity-50"
          placeholder="Kısa açıklama / kullanım notu"
          data-testid="mj-template-description"
        />
      </label>

      {/* productTypeKey (edit mode'da disabled — initial.productTypeKey değişmez Pass 81 V1) */}
      {mode === "new" ? (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-muted">
            Product Type Key (opsiyonel — örn. wall_art, clipart)
          </span>
          <input
            type="text"
            value={productTypeKey}
            onChange={(e) => setProductTypeKey(e.target.value)}
            disabled={pending}
            maxLength={60}
            className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm disabled:opacity-50"
            placeholder="wall_art"
            data-testid="mj-template-product-type"
          />
        </label>
      ) : null}

      {/* Template text */}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-text-muted">
          Template Metni (Mustache <code className="font-mono">{"{{var}}"}</code>{" "}
          syntax · 3-2000 karakter)
        </span>
        <textarea
          value={promptTemplateText}
          onChange={(e) => setPromptTemplateText(e.target.value)}
          disabled={pending}
          minLength={3}
          maxLength={2000}
          rows={5}
          className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs disabled:opacity-50"
          placeholder="{{subject}} in {{style}} style, {{mood}} atmosphere"
          data-testid="mj-template-text"
        />
        <span className="text-xs text-text-muted">
          {promptTemplateText.length} / 2000 karakter
        </span>
      </label>

      {/* Variables auto-detected */}
      <div
        className="rounded-md border border-border bg-bg p-3"
        data-testid="mj-template-vars"
      >
        <span className="text-xs font-semibold text-text-muted">
          Tespit edilen variable&apos;lar:
        </span>
        {variables.length === 0 ? (
          <p className="mt-1 text-xs text-text-muted">
            Henüz <code className="font-mono">{"{{name}}"}</code> yok. (Variables&apos;sız
            template de geçerli.)
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1">
            {variables.map((v) => (
              <code
                key={v}
                className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs"
              >
                {v}
              </code>
            ))}
          </div>
        )}
        {invalidVars.length > 0 ? (
          <p className="mt-2 text-xs text-danger">
            Geçersiz variable adları: {invalidVars.join(", ")} (sadece
            harf+rakam+underscore, harfle başlamalı)
          </p>
        ) : null}
      </div>

      {/* Changelog (sadece edit) */}
      {mode === "edit" ? (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-text-muted">
            Changelog (opsiyonel, version notu)
          </span>
          <input
            type="text"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            disabled={pending}
            maxLength={500}
            className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm disabled:opacity-50"
            placeholder="ör. style varyantları eklendi"
            data-testid="mj-template-changelog"
          />
        </label>
      ) : null}

      {/* Submit */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending || !nameValid || promptTemplateText.trim().length < 3 || invalidVars.length > 0}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          data-testid="mj-template-form-submit"
        >
          {pending
            ? "Kaydediliyor…"
            : mode === "new"
              ? "Template Oluştur"
              : "Yeni Version Kaydet"}
        </button>
      </div>
    </form>
  );
}
