/* eslint-disable no-restricted-syntax */
// PromptTemplateEditorModal — Kivasy v6 Templates editor; v6/v4 sabit
// boyutlar:
//  · Modal lg (max-w-[1100px]) + ModalSplit grid-cols-[340px_1fr]
//  · text-[12.5px] / text-[11.5px] / text-[10.5px] yarı-piksel labels
//  · max-h-[88vh] viewport limit (Modal canon)
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ProviderKind, PromptStatus } from "@prisma/client";
import {
  AlertTriangle,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Modal, ModalSplit } from "@/features/library/components/Modal";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

/**
 * PromptTemplateEditorModal — Templates Prompts CRUD modal.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a6-a7.jsx →
 * Modal split-modal + v6 Templates pattern.
 *
 * Modes:
 *   · "create" — yeni template (POST /api/templates/prompts)
 *   · "edit" — mevcut template (GET /api/templates/prompts/[id] +
 *     PATCH update + version history rollback)
 *
 * Boundary:
 *   Admin-only (server-side enforced). UI fail-closed: non-admin'ler
 *   modal'ı açan butonu görmezler (TemplatesIndexClient).
 */

type TemplateDetail = {
  id: string;
  name: string;
  taskType: string;
  productTypeKey: string | null;
  providerKind: ProviderKind;
  model: string | null;
  description: string | null;
  activeVersion: {
    id: string;
    version: number;
    systemPrompt: string;
    userPromptTemplate: string;
    changelog: string | null;
    createdAt: string;
  } | null;
  versions: Array<{
    id: string;
    version: number;
    status: PromptStatus;
    changelog: string | null;
    createdAt: string;
  }>;
};

interface Props {
  mode: "create" | "edit";
  templateId?: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
}

const TASK_TYPES = [
  "midjourney_generate",
  "image_review",
  "listing_copy",
  "background_removal",
  "mockup_compose",
];

export function PromptTemplateEditorModal({
  mode,
  templateId,
  onClose,
  onSaved,
}: Props) {
  const qc = useQueryClient();
  const detailQuery = useQuery<{ template: TemplateDetail }>({
    queryKey: ["templates", "prompts", templateId ?? "new"],
    enabled: mode === "edit" && !!templateId,
    queryFn: async () => {
      const r = await fetch(`/api/templates/prompts/${templateId}`);
      if (!r.ok) throw new Error("Could not load template");
      return r.json();
    },
  });

  const tpl = detailQuery.data?.template ?? null;

  const [name, setName] = useState("");
  const [taskType, setTaskType] = useState<string>("midjourney_generate");
  const [productTypeKey, setProductTypeKey] = useState("");
  const [providerKind, setProviderKind] = useState<ProviderKind>(
    ProviderKind.AI,
  );
  const [model, setModel] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPromptTemplate, setUserPromptTemplate] = useState("");
  const [changelog, setChangelog] = useState("");
  const [testValues, setTestValues] = useState<Record<string, string>>({});

  // edit modu — template yüklendiğinde formu doldur
  useEffect(() => {
    if (mode !== "edit" || !tpl) return;
    setName(tpl.name);
    setTaskType(tpl.taskType);
    setProductTypeKey(tpl.productTypeKey ?? "");
    setProviderKind(tpl.providerKind);
    setModel(tpl.model ?? "");
    setDescription(tpl.description ?? "");
    setSystemPrompt(tpl.activeVersion?.systemPrompt ?? "");
    setUserPromptTemplate(tpl.activeVersion?.userPromptTemplate ?? "");
    setChangelog("");
  }, [mode, tpl]);

  const variables = useMemo(() => {
    const matches = userPromptTemplate.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
    if (!matches) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of matches) {
      const v = m.replace(/[{}\s]/g, "");
      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
    return out;
  }, [userPromptTemplate]);

  const expandedPreview = useMemo(() => {
    return userPromptTemplate.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_match, key) => testValues[key] ?? `{{${key}}}`,
    );
  }, [userPromptTemplate, testValues]);

  const createMutation = useMutation<{ template: TemplateDetail }, Error, void>(
    {
      mutationFn: async () => {
        const r = await fetch("/api/templates/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            taskType,
            productTypeKey: productTypeKey || null,
            providerKind,
            model: model || null,
            description: description || null,
            systemPrompt: systemPrompt || undefined,
            userPromptTemplate,
          }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      },
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: ["templates"] });
        onSaved?.(data.template.id);
        onClose();
      },
    },
  );

  const updateMutation = useMutation<{ template: TemplateDetail }, Error, void>(
    {
      mutationFn: async () => {
        if (!templateId) throw new Error("templateId yok");
        const r = await fetch(`/api/templates/prompts/${templateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: description || null,
            productTypeKey: productTypeKey || null,
            model: model || null,
            systemPrompt,
            userPromptTemplate,
            changelog: changelog || null,
          }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      },
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: ["templates"] });
        qc.invalidateQueries({
          queryKey: ["templates", "prompts", templateId],
        });
        onSaved?.(data.template.id);
      },
    },
  );

  const activateMutation = useMutation<
    { template: TemplateDetail },
    Error,
    string
  >({
    mutationFn: async (versionId) => {
      if (!templateId) throw new Error("templateId yok");
      const r = await fetch(
        `/api/templates/prompts/${templateId}/versions/${versionId}/activate`,
        { method: "POST" },
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      qc.invalidateQueries({ queryKey: ["templates", "prompts", templateId] });
    },
  });

  const isCreate = mode === "create";
  const saving = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error ?? updateMutation.error ?? null;

  const canSave = name.trim().length > 0 && userPromptTemplate.trim().length > 0;

  return (
    <Modal
      title={isCreate ? "New Prompt Template" : `Edit · ${tpl?.name ?? "Loading"}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
          <div className="ml-auto flex items-center gap-3">
            {error ? (
              <span className="font-mono text-[11px] text-danger">
                {error.message}
              </span>
            ) : null}
            <button
              type="button"
              data-size="sm"
              className="k-btn k-btn--primary"
              disabled={!canSave || saving}
              onClick={() => {
                if (isCreate) createMutation.mutate();
                else updateMutation.mutate();
              }}
              data-testid="prompt-template-save"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3 w-3" aria-hidden />
              )}
              {isCreate ? "Create Template" : "Save new version"}
            </button>
          </div>
        </>
      }
    >
      {detailQuery.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-k-orange" aria-hidden />
        </div>
      ) : (
        <ModalSplit
          rail={
            <div className="space-y-5">
              <div>
                <div className="mb-1.5 font-mono text-[10px] uppercase tracking-meta text-ink-3">
                  Identity
                </div>
                <label className="mb-1 block text-[11.5px] font-medium text-ink">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Boho line wall art · neutral"
                  disabled={!isCreate}
                  className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-ink">
                  Task type
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  disabled={!isCreate}
                  className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft disabled:opacity-60"
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-ink">
                  Provider kind
                </label>
                <select
                  value={providerKind}
                  onChange={(e) => setProviderKind(e.target.value as ProviderKind)}
                  disabled={!isCreate}
                  className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft disabled:opacity-60"
                >
                  {Object.values(ProviderKind).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-ink">
                  Model
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. kie/midjourney-v7"
                  className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-ink">
                  Product type key (opt.)
                </label>
                <input
                  type="text"
                  value={productTypeKey}
                  onChange={(e) => setProductTypeKey(e.target.value)}
                  placeholder="wall_art / clipart / sticker"
                  className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11.5px] font-medium text-ink">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Operator note — when to use this template"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
                />
              </div>

              {!isCreate && tpl ? (
                <div>
                  <div className="mb-1.5 font-mono text-[10px] uppercase tracking-meta text-ink-3">
                    Versions
                  </div>
                  <div className="space-y-1">
                    {tpl.versions.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded border border-line-soft bg-paper px-2 py-1.5 text-[12px]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-ink">v{v.version}</span>
                          <Badge
                            tone={
                              v.status === "ACTIVE"
                                ? "success"
                                : v.status === "DRAFT"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {v.status}
                          </Badge>
                        </div>
                        {v.status !== "ACTIVE" ? (
                          <button
                            type="button"
                            onClick={() => activateMutation.mutate(v.id)}
                            disabled={activateMutation.isPending}
                            className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-ink-2 hover:text-ink"
                            title="Rollback to this version"
                          >
                            <RotateCcw className="h-3 w-3" aria-hidden />
                            Activate
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          }
        >
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-[12.5px] font-semibold text-ink">
                System prompt (optional)
              </label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="System instruction (LLM tasks). Boş bırakılabilir — image gen task'larında kullanılmaz."
                className="w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
              />
            </div>

            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <label className="text-[12.5px] font-semibold text-ink">
                  User prompt template
                </label>
                <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                  Mustache · {"{{var}}"}
                </span>
              </div>
              <textarea
                rows={6}
                value={userPromptTemplate}
                onChange={(e) => setUserPromptTemplate(e.target.value)}
                placeholder="{{subject}} in {{style}} style, {{mood}} atmosphere"
                className="w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
                data-testid="prompt-template-body"
              />
              {variables.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                    Variables:
                  </span>
                  {variables.map((v) => (
                    <span
                      key={v}
                      className="rounded bg-k-bg-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {!isCreate ? (
              <div>
                <label className="mb-1 block text-[12.5px] font-semibold text-ink">
                  Changelog (optional)
                </label>
                <input
                  type="text"
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder="Why this revision?"
                  className="h-9 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
                />
              </div>
            ) : null}

            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <label className="text-[12.5px] font-semibold text-ink">
                  Test playground
                </label>
                <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
                  Local expand · no API call
                </span>
              </div>
              {variables.length === 0 ? (
                <div className="rounded border border-dashed border-line-soft bg-k-bg-2/40 px-3 py-2 text-[12px] text-ink-3">
                  Add a {"{{variable}}"} to enable the playground.
                </div>
              ) : (
                <div className="space-y-2">
                  {variables.map((v) => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="w-24 font-mono text-[11px] text-ink-2">
                        {v}
                      </span>
                      <input
                        type="text"
                        value={testValues[v] ?? ""}
                        onChange={(e) =>
                          setTestValues((p) => ({ ...p, [v]: e.target.value }))
                        }
                        placeholder="(empty)"
                        className="h-7 flex-1 rounded-md border border-line bg-paper px-2 text-xs text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-1 focus:ring-k-orange-soft"
                      />
                    </div>
                  ))}
                </div>
              )}
              {expandedPreview ? (
                <div
                  className={cn(
                    "mt-3 rounded-md border bg-k-bg-2/60 px-3 py-2 font-mono text-[12px] leading-relaxed text-ink-2",
                    "border-line-soft",
                  )}
                  data-testid="prompt-template-preview"
                >
                  {expandedPreview}
                </div>
              ) : null}
            </div>

            {detailQuery.error ? (
              <div className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
                <AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden />
                {(detailQuery.error as Error).message}
              </div>
            ) : null}
          </div>
        </ModalSplit>
      )}
    </Modal>
  );
}
