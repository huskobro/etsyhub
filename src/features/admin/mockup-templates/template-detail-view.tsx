"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AssetUploadField } from "./asset-upload-field";

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
  if (!res.ok) throw new Error("Liste alınamadı");
  return ((await res.json()) as { items: MockupTemplateRow[] }).items;
}

async function fetchBindings(templateId: string): Promise<MockupTemplateBindingRow[]> {
  const res = await fetch(`/api/admin/mockup-templates/${templateId}/bindings`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Binding listesi alınamadı");
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
  body: { status?: "DRAFT" | "ACTIVE" | "ARCHIVED"; estimatedRenderMs?: number };
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
  // V2 (HEAD `4606834`+) — baseAssetKey LOCAL_SHARP için ayrı upload widget;
  // onChange'te JSON config'in `baseAssetKey` alanı otomatik güncellenir.
  const [bindingBaseAssetKey, setBindingBaseAssetKey] = useState("");

  // Aspect ratio dependent config template (admin'in formunu kolaylaştırmak için)
  const localSharpTemplate = useMemo(() => {
    const ar = aspectRatiosCsv.split(",")[0]?.trim() ?? "3:4";
    return JSON.stringify(
      {
        baseAssetKey: thumbKey || "templates/your-base-key.png",
        baseDimensions: { w: 1200, h: ar === "3:4" ? 1600 : ar === "2:3" ? 1800 : 1200 },
        safeArea: { type: "rect", x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
        recipe: { blendMode: "normal" },
        coverPriority: 50,
      },
      null,
      2,
    );
  }, [aspectRatiosCsv, thumbKey]);

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
          setBindingBaseAssetKey("");
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
          ← Mockup Template'leri
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
              setBindingConfigJson(localSharpTemplate);
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
            Henüz binding yok. En az 1 ACTIVE binding olmadan template Apply page'inde gösterilmez.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(bindingsQuery.data ?? []).map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg p-3"
              >
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
                  setBindingConfigJson(
                    next === "LOCAL_SHARP" ? localSharpTemplate : '{\n  "externalTemplateId": "your-dm-id"\n}',
                  );
                }}
                className="h-control-md rounded-md border border-border bg-surface px-3 text-sm text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
              >
                <option value="LOCAL_SHARP">LOCAL_SHARP (V1 prod)</option>
                <option value="DYNAMIC_MOCKUPS">DYNAMIC_MOCKUPS (V2 stub)</option>
              </select>
            </div>

            {/* baseAssetKey upload widget — yalnız LOCAL_SHARP için göster.
                onChange'te JSON config'in baseAssetKey alanı + baseDimensions
                (width/height varsa) otomatik update edilir. */}
            {bindingProvider === "LOCAL_SHARP" ? (
              <AssetUploadField
                value={bindingBaseAssetKey}
                onChange={(key, extra) => {
                  setBindingBaseAssetKey(key);
                  // JSON config'i parse et + baseAssetKey + baseDimensions güncelle
                  try {
                    const cfg = JSON.parse(bindingConfigJson || "{}") as Record<string, unknown>;
                    cfg.baseAssetKey = key;
                    if (extra?.width && extra.height) {
                      cfg.baseDimensions = { w: extra.width, h: extra.height };
                    }
                    setBindingConfigJson(JSON.stringify(cfg, null, 2));
                  } catch {
                    // JSON broken → kullanıcı manuel düzeltsin
                  }
                }}
                categoryId={template.categoryId}
                purpose="base"
                label="Base Asset (LOCAL_SHARP base image)"
                description="Mockup base image. Upload sonrası key + boyutlar JSON config'in baseAssetKey + baseDimensions alanına otomatik yazılır."
              />
            ) : null}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bindingConfigJson" className="text-sm font-medium text-text">
                Provider Config (JSON)
              </label>
              <textarea
                id="bindingConfigJson"
                value={bindingConfigJson}
                onChange={(e) => setBindingConfigJson(e.target.value)}
                rows={12}
                className="rounded-md border border-border bg-surface p-3 font-mono text-xs text-text outline-none transition-colors duration-fast ease-out focus:border-accent"
              />
              <p className="text-xs text-text-muted">
                LOCAL_SHARP için: baseAssetKey (yukarıdaki upload widget'ı bu alanı doldurur), baseDimensions {`{w,h}`}, safeArea {`{type:"rect",...}`}, recipe {`{blendMode}`}, coverPriority. DYNAMIC_MOCKUPS için: externalTemplateId. Şema parse fail → 400 ValidationError.
              </p>
            </div>

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
