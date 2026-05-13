"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AssetUploadField } from "./asset-upload-field";
import { LocalSharpConfigEditor } from "./local-sharp-config-editor";

type LocalSharpEditorConfig = {
  providerId?: "local-sharp";
  baseAssetKey: string;
  baseDimensions: { w: number; h: number };
  safeArea:
    | { type: "rect"; x: number; y: number; w: number; h: number; rotation?: number }
    | {
        type: "perspective";
        corners: [
          [number, number],
          [number, number],
          [number, number],
          [number, number],
        ];
      };
  recipe: {
    blendMode: "normal" | "multiply" | "screen";
    shadow?: { offsetX: number; offsetY: number; blur: number; opacity: number };
  };
  coverPriority: number;
};

function defaultLocalSharpConfig(aspectCsv: string, baseAssetKey: string): LocalSharpEditorConfig {
  const ar = aspectCsv.split(",")[0]?.trim() ?? "3:4";
  const h = ar === "3:4" ? 1600 : ar === "2:3" ? 1800 : 1200;
  return {
    baseAssetKey,
    baseDimensions: { w: 1200, h },
    safeArea: { type: "rect", x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    recipe: { blendMode: "normal" },
    coverPriority: 50,
  };
}

/**
 * Admin · MockupTemplate detay/edit sayfası (V2 admin authoring).
 *
 * Bölümler:
 * - Header: ad + status badge + breadcrumb
 * - Metadata edit form: name, thumbKey, aspectRatios, tags, estimatedRenderMs
 *   (categoryId immutable — değişirse render snapshot'lar yanıltıcı olur)
 * - Status transition CTA'ları (DRAFT/ACTIVE/ARCHIVED)
 * - Bindings tablosu: list + new + edit/archive/delete (per-row)
 *
 * Endpoint'ler:
 * - GET /api/admin/mockup-templates → ilgili row'u bul (list path; detail
 *   endpoint sub-route ile karışmasın diye ayrı yapmadık)
 * - PATCH /api/admin/mockup-templates/[id] → metadata + status transition
 * - GET /api/admin/mockup-templates/[id]/bindings → list
 * - POST /api/admin/mockup-templates/[id]/bindings → create
 * - PATCH /api/admin/mockup-templates/[id]/bindings/[bindingId] → status + config
 * - DELETE /api/admin/mockup-templates/[id]/bindings/[bindingId]
 */

type MockupTemplateRow = {
  id: string;
  categoryId: string;
  name: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  thumbKey: string;
  aspectRatios: string[];
  tags: string[];
  estimatedRenderMs: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

type MockupTemplateBindingRow = {
  id: string;
  templateId: string;
  providerId: "LOCAL_SHARP" | "DYNAMIC_MOCKUPS";
  version: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  config: unknown;
  estimatedRenderMs: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

async function fetchAllTemplates(): Promise<MockupTemplateRow[]> {
  const res = await fetch("/api/admin/mockup-templates", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load list");
  return ((await res.json()) as { items: MockupTemplateRow[] }).items;
}

async function fetchBindings(templateId: string): Promise<MockupTemplateBindingRow[]> {
  const res = await fetch(`/api/admin/mockup-templates/${templateId}/bindings`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load binding list");
  return ((await res.json()) as { items: MockupTemplateBindingRow[] }).items;
}

async function patchTemplate(input: {
  id: string;
  body: Partial<{
    status: "DRAFT" | "ACTIVE" | "ARCHIVED";
    name: string;
    tags: string[];
    thumbKey: string;
    aspectRatios: string[];
    estimatedRenderMs: number;
  }>;
}) {
  const res = await fetch(`/api/admin/mockup-templates/${input.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input.body),
  });
  if (!res.ok) {
    throw new Error((await res.json()).error ?? "Güncelleme başarısız");
  }
  return res.json();
}

async function createBinding(input: {
  templateId: string;
  providerId: "LOCAL_SHARP" | "DYNAMIC_MOCKUPS";
  config: object;
  estimatedRenderMs: number;
}) {
  const res = await fetch(
    `/api/admin/mockup-templates/${input.templateId}/bindings`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        providerId: input.providerId,
        config: input.config,
        estimatedRenderMs: input.estimatedRenderMs,
      }),
    },
  );
  if (!res.ok) {
    throw new Error((await res.json()).error ?? "Binding oluşturma başarısız");
  }
  return res.json();
}

async function patchBinding(input: {
  templateId: string;
  bindingId: string;
  body: {
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
    estimatedRenderMs?: number;
    config?: object;
  };
}) {
  const res = await fetch(
    `/api/admin/mockup-templates/${input.templateId}/bindings/${input.bindingId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.body),
    },
  );
  if (!res.ok) {
    throw new Error((await res.json()).error ?? "Binding güncelleme başarısız");
  }
  return res.json();
}

async function deleteBinding(input: { templateId: string; bindingId: string }) {
  const res = await fetch(
    `/api/admin/mockup-templates/${input.templateId}/bindings/${input.bindingId}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    throw new Error((await res.json()).error ?? "Binding silme başarısız");
  }
  return res.json();
}

function statusBadgeTone(s: "DRAFT" | "ACTIVE" | "ARCHIVED"): "success" | "neutral" | "warning" {
  if (s === "ACTIVE") return "success";
  if (s === "ARCHIVED") return "neutral";
  return "warning";
}

function statusLabel(s: "DRAFT" | "ACTIVE" | "ARCHIVED"): string {
  if (s === "ACTIVE") return "Aktif";
  if (s === "ARCHIVED") return "Arşivli";
  return "Taslak";
}

export function TemplateDetailView({ templateId }: { templateId: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const tplsQuery = useQuery({
    queryKey: ["admin", "mockup-templates"],
    queryFn: fetchAllTemplates,
  });
  const template = tplsQuery.data?.find((t) => t.id === templateId);

  const bindingsQuery = useQuery({
    queryKey: ["admin", "mockup-templates", templateId, "bindings"],
    queryFn: () => fetchBindings(templateId),
    enabled: !!template,
  });

  // Metadata form local state — template yüklendiğinde sync
  const [name, setName] = useState("");
  const [thumbKey, setThumbKey] = useState("");
  const [aspectRatiosCsv, setAspectRatiosCsv] = useState("");
  const [tagsCsv, setTagsCsv] = useState("");
  const [estimatedRenderMs, setEstimatedRenderMs] = useState(2000);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setThumbKey(template.thumbKey);
      setAspectRatiosCsv(template.aspectRatios.join(", "));
      setTagsCsv(template.tags.join(", "));
      setEstimatedRenderMs(template.estimatedRenderMs);
    }
  }, [template?.id, template?.updatedAt, template]);

  const patchMutation = useMutation({
    mutationFn: patchTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "mockup-templates"] });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    },
  });

  const createBindingMutation = useMutation({
    mutationFn: createBinding,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin", "mockup-templates", templateId, "bindings"],
      }),
  });

  const patchBindingMutation = useMutation({
    mutationFn: patchBinding,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin", "mockup-templates", templateId, "bindings"],
      }),
  });

  const deleteBindingMutation = useMutation({
    mutationFn: deleteBinding,
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["admin", "mockup-templates", templateId, "bindings"],
      }),
  });

  // Binding create form local state
  const [bindingFormOpen, setBindingFormOpen] = useState(false);
  const [bindingProvider, setBindingProvider] = useState<"LOCAL_SHARP" | "DYNAMIC_MOCKUPS">("LOCAL_SHARP");
  const [bindingConfigJson, setBindingConfigJson] = useState("");
  const [bindingEstimatedMs, setBindingEstimatedMs] = useState(2000);
  const [bindingError, setBindingError] = useState<string | null>(null);
  // V2 Phase 8 (Pass 14) — LOCAL_SHARP structured editor state.
  // DYNAMIC_MOCKUPS path'i hâlâ JSON textarea kullanıyor (stub provider,
  // tek alan: externalTemplateId).
  const [bindingLocalConfig, setBindingLocalConfig] = useState<LocalSharpEditorConfig>(
    () => defaultLocalSharpConfig(aspectRatiosCsv, ""),
  );

  // Binding edit mode (per-row inline editor)
  const [editingBindingId, setEditingBindingId] = useState<string | null>(null);
  const [editLocalConfig, setEditLocalConfig] = useState<LocalSharpEditorConfig | null>(null);
  const [editDynamicJson, setEditDynamicJson] = useState<string>("");
  const [editEstimatedMs, setEditEstimatedMs] = useState<number>(2000);
  const [editError, setEditError] = useState<string | null>(null);

  if (tplsQuery.isLoading) {
    return <p className="text-sm text-text-muted">Yükleniyor…</p>;
  }
  if (tplsQuery.error) {
    return <p className="text-sm text-danger">{(tplsQuery.error as Error).message}</p>;
  }
  if (!template) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-danger">Template bulunamadı.</p>
        <Button variant="ghost" onClick={() => router.push("/admin/mockup-templates")}>
          ← Listeye dön
        </Button>
      </div>
    );
  }

  const onMetadataSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const aspectRatios = aspectRatiosCsv
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (aspectRatios.length === 0) return;
    patchMutation.mutate({
      id: template.id,
      body: {
        name: name.trim(),
        thumbKey: thumbKey.trim(),
        aspectRatios,
        tags: tagsCsv
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0),
        estimatedRenderMs,
      },
    });
  };

  const onTransition = (next: "DRAFT" | "ACTIVE" | "ARCHIVED") => {
    patchMutation.mutate({ id: template.id, body: { status: next } });
  };

  const onBindingCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setBindingError(null);
    let cfg: unknown;
    if (bindingProvider === "LOCAL_SHARP") {
      // Structured editor — direkt object, JSON parse yok
      if (!bindingLocalConfig.baseAssetKey || bindingLocalConfig.baseAssetKey.trim().length === 0) {
        setBindingError("baseAssetKey zorunlu — base asset upload edin.");
        return;
      }
      cfg = bindingLocalConfig;
    } else {
      // DYNAMIC_MOCKUPS — JSON textarea path (stub provider, tek alan)
      try {
        cfg = JSON.parse(bindingConfigJson);
      } catch {
        setBindingError("Config geçerli JSON değil");
        return;
      }
      if (!cfg || typeof cfg !== "object") {
        setBindingError("Config bir object olmalı");
        return;
      }
    }
    createBindingMutation.mutate(
      {
        templateId: template.id,
        providerId: bindingProvider,
        config: cfg as object,
        estimatedRenderMs: bindingEstimatedMs,
      },
      {
        onSuccess: () => {
          setBindingFormOpen(false);
          setBindingConfigJson("");
          setBindingLocalConfig(defaultLocalSharpConfig(aspectRatiosCsv, ""));
        },
        onError: (err) => setBindingError((err as Error).message),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb + header */}
      <div className="flex flex-col gap-2">
        <a
          href="/admin/mockup-templates"
          className="text-sm text-text-muted hover:text-text"
        >
          ← Mockup Template&apos;leri
        </a>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{template.name}</h1>
          <Badge tone={statusBadgeTone(template.status)}>
            {statusLabel(template.status)}
          </Badge>
        </div>
        <p className="text-xs text-text-muted">
          Kategori: <span className="font-mono">{template.categoryId}</span> · ID:{" "}
          <span className="font-mono">{template.id}</span>
        </p>

        {/* Pass 15 — Readiness banner: ACTIVE template + 0 ACTIVE binding sessiz fail önler */}
        <ReadinessBanner
          status={template.status}
          activeBindingCount={
            (bindingsQuery.data ?? []).filter((b) => b.status === "ACTIVE").length
          }
          totalBindingCount={(bindingsQuery.data ?? []).length}
          categoryId={template.categoryId}
          aspectRatios={template.aspectRatios}
        />
      </div>

      {/* Metadata form */}
      <form
        onSubmit={onMetadataSubmit}
        className="flex max-w-2xl flex-col gap-4 rounded-md border border-border bg-surface p-6"
      >
        <h2 className="text-lg font-semibold text-text">Metadata</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-text">
            Ad
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={1}
            maxLength={120}
            className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
          />
        </div>

        <AssetUploadField
          value={thumbKey}
          onChange={(key) => setThumbKey(key)}
          categoryId={template.categoryId}
          purpose="thumb"
          label="Thumbnail"
          description="Mevcut thumbnail'i değiştir veya yeni dosya yükle. Upload sonrası storage key otomatik güncellenir; 'Kaydet'e basınca DB'ye yazılır."
          required
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="aspectRatios" className="text-sm font-medium text-text">
            Aspect Ratios (virgülle)
          </label>
          <input
            id="aspectRatios"
            type="text"
            value={aspectRatiosCsv}
            onChange={(e) => setAspectRatiosCsv(e.target.value)}
            required
            className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="tags" className="text-sm font-medium text-text">
            Tagler (virgülle)
          </label>
          <input
            id="tags"
            type="text"
            value={tagsCsv}
            onChange={(e) => setTagsCsv(e.target.value)}
            maxLength={500}
            className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="estimatedRenderMs"
            className="text-sm font-medium text-text"
          >
            Tahmini Render (ms)
          </label>
          <input
            id="estimatedRenderMs"
            type="number"
            value={estimatedRenderMs}
            onChange={(e) => setEstimatedRenderMs(Number(e.target.value))}
            min={100}
            max={60000}
            step={100}
            className="h-control-md w-40 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
          />
        </div>

        {patchMutation.error ? (
          <p className="text-sm text-danger" role="alert">
            {(patchMutation.error as Error).message}
          </p>
        ) : null}
        {savedFlash ? (
          <p className="text-sm text-success" role="status">
            Kaydedildi.
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="primary"
            loading={patchMutation.isPending}
            disabled={patchMutation.isPending}
          >
            Kaydet
          </Button>
          {template.status === "DRAFT" && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onTransition("ACTIVE")}
              disabled={patchMutation.isPending}
            >
              Yayınla
            </Button>
          )}
          {template.status === "ACTIVE" && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onTransition("DRAFT")}
              disabled={patchMutation.isPending}
            >
              Geri çek
            </Button>
          )}
          {template.status !== "ARCHIVED" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onTransition("ARCHIVED")}
              disabled={patchMutation.isPending}
            >
              Arşivle
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onTransition("DRAFT")}
              disabled={patchMutation.isPending}
            >
              Geri al
            </Button>
          )}
        </div>
      </form>

      {/* Bindings */}
      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Provider Bindings</h2>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setBindingFormOpen(true);
              setBindingProvider("LOCAL_SHARP");
              setBindingLocalConfig(defaultLocalSharpConfig(aspectRatiosCsv, ""));
              setBindingConfigJson("");
            }}
            disabled={bindingFormOpen}
          >
            + Yeni binding
          </Button>
        </div>

        {bindingsQuery.isLoading ? (
          <p className="text-sm text-text-muted">Yükleniyor…</p>
        ) : bindingsQuery.error ? (
          <p className="text-sm text-danger">
            {(bindingsQuery.error as Error).message}
          </p>
        ) : (bindingsQuery.data?.length ?? 0) === 0 && !bindingFormOpen ? (
          <p className="text-sm text-text-muted">
            Henüz binding yok. En az 1 ACTIVE binding olmadan template Apply page&apos;inde gösterilmez.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(bindingsQuery.data ?? []).map((b) => (
              <li
                key={b.id}
                className="flex flex-col gap-3 rounded-md border border-border bg-bg p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{b.providerId}</span>
                      <Badge tone={statusBadgeTone(b.status)}>
                        {statusLabel(b.status)}
                      </Badge>
                      <span className="text-xs text-text-muted">
                        v{b.version} · ~{b.estimatedRenderMs}ms
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {b.status === "DRAFT" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          patchBindingMutation.mutate({
                            templateId: template.id,
                            bindingId: b.id,
                            body: { status: "ACTIVE" },
                          })
                        }
                        disabled={patchBindingMutation.isPending}
                      >
                        Yayınla
                      </Button>
                    )}
                    {b.status === "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          patchBindingMutation.mutate({
                            templateId: template.id,
                            bindingId: b.id,
                            body: { status: "DRAFT" },
                          })
                        }
                        disabled={patchBindingMutation.isPending}
                      >
                        Geri çek
                      </Button>
                    )}
                    {b.status !== "ARCHIVED" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          patchBindingMutation.mutate({
                            templateId: template.id,
                            bindingId: b.id,
                            body: { status: "ARCHIVED" },
                          })
                        }
                        disabled={patchBindingMutation.isPending}
                      >
                        Arşivle
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          patchBindingMutation.mutate({
                            templateId: template.id,
                            bindingId: b.id,
                            body: { status: "DRAFT" },
                          })
                        }
                        disabled={patchBindingMutation.isPending}
                      >
                        Geri al
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (editingBindingId === b.id) {
                          setEditingBindingId(null);
                          setEditLocalConfig(null);
                          setEditDynamicJson("");
                          setEditError(null);
                          return;
                        }
                        setEditingBindingId(b.id);
                        setEditEstimatedMs(b.estimatedRenderMs);
                        setEditError(null);
                        if (b.providerId === "LOCAL_SHARP") {
                          // Mevcut config'i editor state'ine kopyala (providerId discriminator'ı çıkar)
                          const cfg = (b.config as Record<string, unknown>) ?? {};
                          const { providerId: _drop, ...rest } = cfg;
                          setEditLocalConfig({
                            ...defaultLocalSharpConfig(aspectRatiosCsv, ""),
                            ...(rest as Partial<LocalSharpEditorConfig>),
                          } as LocalSharpEditorConfig);
                          setEditDynamicJson("");
                        } else {
                          // DYNAMIC_MOCKUPS — JSON textarea
                          const cfg = (b.config as Record<string, unknown>) ?? {};
                          const { providerId: _drop, ...rest } = cfg;
                          setEditDynamicJson(JSON.stringify(rest, null, 2));
                          setEditLocalConfig(null);
                        }
                      }}
                      disabled={patchBindingMutation.isPending}
                    >
                      {editingBindingId === b.id ? "Kapat" : "Düzenle"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (
                          window.confirm(
                            `${b.providerId} binding'i silinsin mi? Render history içeriyorsa silinemez.`,
                          )
                        ) {
                          deleteBindingMutation.mutate({
                            templateId: template.id,
                            bindingId: b.id,
                          });
                        }
                      }}
                      disabled={deleteBindingMutation.isPending}
                    >
                      Sil
                    </Button>
                  </div>
                </div>

                {/* Inline edit form — yalnız bu row edit modundayken */}
                {editingBindingId === b.id ? (
                  <div className="flex flex-col gap-3 rounded-md border border-accent/30 bg-surface p-3">
                    <div className="text-xs text-text-muted">
                      Binding düzenleniyor — kaydet&apos;e basınca config + estimatedRenderMs PATCH edilir, version otomatik bump olur.
                    </div>
                    {b.providerId === "LOCAL_SHARP" && editLocalConfig ? (
                      <LocalSharpConfigEditor
                        value={editLocalConfig}
                        onChange={(next) => setEditLocalConfig(next)}
                        categoryId={template.categoryId}
                      />
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-text">
                          Provider Config (JSON)
                        </label>
                        <textarea
                          value={editDynamicJson}
                          onChange={(e) => setEditDynamicJson(e.target.value)}
                          rows={6}
                          className="rounded-md border border-border bg-bg p-3 font-mono text-xs text-text outline-none focus:border-accent"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-text">
                        Tahmini Render (ms)
                      </label>
                      <input
                        type="number"
                        value={editEstimatedMs}
                        onChange={(e) => setEditEstimatedMs(Number(e.target.value))}
                        min={100}
                        max={60000}
                        step={100}
                        className="h-control-md w-40 rounded-md border border-border bg-bg px-3 text-sm text-text outline-none focus:border-accent"
                      />
                    </div>

                    {editError ? (
                      <p className="text-sm text-danger" role="alert">
                        {editError}
                      </p>
                    ) : null}

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        loading={patchBindingMutation.isPending}
                        disabled={patchBindingMutation.isPending}
                        onClick={() => {
                          setEditError(null);
                          let cfgToSend: object | undefined;
                          if (b.providerId === "LOCAL_SHARP") {
                            if (!editLocalConfig) return;
                            if (
                              !editLocalConfig.baseAssetKey ||
                              editLocalConfig.baseAssetKey.trim().length === 0
                            ) {
                              setEditError("baseAssetKey zorunlu.");
                              return;
                            }
                            cfgToSend = editLocalConfig;
                          } else {
                            try {
                              cfgToSend = JSON.parse(editDynamicJson) as object;
                            } catch {
                              setEditError("Config geçerli JSON değil");
                              return;
                            }
                            if (!cfgToSend || typeof cfgToSend !== "object") {
                              setEditError("Config bir object olmalı");
                              return;
                            }
                          }
                          patchBindingMutation.mutate(
                            {
                              templateId: template.id,
                              bindingId: b.id,
                              body: {
                                config: cfgToSend,
                                estimatedRenderMs: editEstimatedMs,
                              },
                            },
                            {
                              onSuccess: () => {
                                setEditingBindingId(null);
                                setEditLocalConfig(null);
                                setEditDynamicJson("");
                              },
                              onError: (err) =>
                                setEditError((err as Error).message),
                            },
                          );
                        }}
                      >
                        Kaydet
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingBindingId(null);
                          setEditLocalConfig(null);
                          setEditDynamicJson("");
                          setEditError(null);
                        }}
                        disabled={patchBindingMutation.isPending}
                      >
                        İptal
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {/* Binding create form */}
        {bindingFormOpen && (
          <form
            onSubmit={onBindingCreate}
            className="flex flex-col gap-3 rounded-md border border-border bg-bg p-4"
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bindingProvider" className="text-sm font-medium text-text">
                Provider
              </label>
              <select
                id="bindingProvider"
                value={bindingProvider}
                onChange={(e) => {
                  const next = e.target.value as "LOCAL_SHARP" | "DYNAMIC_MOCKUPS";
                  setBindingProvider(next);
                  if (next === "LOCAL_SHARP") {
                    setBindingLocalConfig(defaultLocalSharpConfig(aspectRatiosCsv, ""));
                    setBindingConfigJson("");
                  } else {
                    setBindingConfigJson('{\n  "externalTemplateId": "your-dm-id"\n}');
                  }
                }}
                className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
              >
                <option value="LOCAL_SHARP">LOCAL_SHARP (V1 prod)</option>
                <option value="DYNAMIC_MOCKUPS">DYNAMIC_MOCKUPS (V2 stub)</option>
              </select>
            </div>

            {/* LOCAL_SHARP → structured editor + canlı validate panel + base asset preview overlay.
                DYNAMIC_MOCKUPS → JSON textarea (stub, tek alan: externalTemplateId). */}
            {bindingProvider === "LOCAL_SHARP" ? (
              <LocalSharpConfigEditor
                value={bindingLocalConfig}
                onChange={(next) => setBindingLocalConfig(next)}
                categoryId={template.categoryId}
              />
            ) : (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="bindingConfigJson" className="text-sm font-medium text-text">
                  Provider Config (JSON)
                </label>
                <textarea
                  id="bindingConfigJson"
                  value={bindingConfigJson}
                  onChange={(e) => setBindingConfigJson(e.target.value)}
                  rows={6}
                  className="rounded-md border border-border bg-surface p-3 font-mono text-xs text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
                />
                <p className="text-xs text-text-muted">
                  DYNAMIC_MOCKUPS şu an stub provider. Tek alan: <code>externalTemplateId</code>. Şema parse fail → 400.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="bindingEstimatedMs"
                className="text-sm font-medium text-text"
              >
                Tahmini Render (ms)
              </label>
              <input
                id="bindingEstimatedMs"
                type="number"
                value={bindingEstimatedMs}
                onChange={(e) => setBindingEstimatedMs(Number(e.target.value))}
                min={100}
                max={60000}
                step={100}
                className="h-control-md w-40 rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
              />
            </div>

            {bindingError ? (
              <p className="text-sm text-danger" role="alert">
                {bindingError}
              </p>
            ) : null}

            <div className="flex items-center gap-2">
              <Button
                type="submit"
                variant="primary"
                loading={createBindingMutation.isPending}
                disabled={createBindingMutation.isPending}
              >
                Oluştur
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setBindingFormOpen(false);
                  setBindingError(null);
                }}
                disabled={createBindingMutation.isPending}
              >
                İptal
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Pass 15 — Template readiness banner.
 *
 * Admin authoring sırasında "kullanıcıya görünür mü?" sorusunu UI içinde
 * yanıtlar. Mevcut sessiz fail senaryoları:
 *   - ACTIVE template + 0 ACTIVE binding → user tarafında templates[] boş
 *   - ACTIVE template + binding ACTIVE ama Apply page'de görünmüyor olabilir
 *     (ProductType.aspectRatio template aspectRatios[] içinde değilse)
 *
 * Bu banner sadece honest durum bilgisi verir; herhangi bir prod logic'i
 * bypass etmez.
 */
function ReadinessBanner({
  status,
  activeBindingCount,
  totalBindingCount,
  categoryId,
  aspectRatios,
}: {
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  activeBindingCount: number;
  totalBindingCount: number;
  categoryId: string;
  aspectRatios: string[];
}) {
  // DRAFT/ARCHIVED — Apply page'de zaten görünmez, mesaj nötr
  if (status === "DRAFT") {
    return (
      <div className="rounded-md border border-border bg-bg p-3 text-xs text-text-muted">
        <span className="font-medium text-text">Taslak</span> — kullanıcı Apply
        page&apos;inde görünmez. Yayınlamak için en az 1 ACTIVE binding ekleyin
        sonra &quot;Yayınla&quot;ya basın.
      </div>
    );
  }
  if (status === "ARCHIVED") {
    return (
      <div className="rounded-md border border-border bg-bg p-3 text-xs text-text-muted">
        <span className="font-medium text-text">Arşivli</span> — kullanıcı Apply
        page&apos;inde görünmez. Mevcut render&apos;lar etkilenmez (templateSnapshot
        stable). Geri yüklemek için &quot;Geri al&quot;.
      </div>
    );
  }

  // ACTIVE template + 0 ACTIVE binding = sessiz fail; uyar
  if (activeBindingCount === 0) {
    return (
      <div className="rounded-md border border-warning/40 bg-warning-soft p-3 text-xs text-text">
        <span className="font-medium text-warning">⚠ Aktif ama Apply page&apos;de görünmüyor</span>
        {" — "}
        Template ACTIVE durumda fakat hiç ACTIVE binding yok ({totalBindingCount}
        {" "}toplam binding). Aşağıdan binding ekleyin veya mevcut bir binding&apos;i Yayınlayın.
      </div>
    );
  }

  // ACTIVE + ACTIVE binding var → "Apply page'de gör" deep-link
  // Apply page categoryId + aspectRatio filtresine göre çalışır;
  // admin'in kendi mağazası varsa direkt deep-link öneririz.
  // Pratik: admin sidebar üzerinden kendi /selection/sets'e gitsin (ProductType
  // resolve oradan yapılır). Burada sadece "ne olduğunu" göster.
  return (
    <div className="rounded-md border border-success/40 bg-success-soft p-3 text-xs text-text">
      <span className="font-medium text-success">✓ Apply page&apos;de görünür</span>
      {" — "}
      {activeBindingCount}/{totalBindingCount} ACTIVE binding · kategori{" "}
      <span className="font-mono">{categoryId}</span> · aspectRatio{" "}
      <span className="font-mono">{aspectRatios.join(", ")}</span>. Kullanıcı
      uygun bir SelectionSet ile Apply page&apos;e geldiğinde bu template
      &quot;Şablon Seç&quot; listesinde çıkar (eşleşen ProductType.aspectRatio
      şart).
    </div>
  );
}
