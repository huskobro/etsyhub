"use client";

// Phase 7 Task 28 — Selection Studio sağ panel "Hızlı işlem" bölümü.
//
// Spec Section 3.2 + Section 5 (hızlı işlem matrisi):
//   Sıra (mockup B.13 ile aynı): Background remove, Upscale 2×, Crop, Transparent.
//   - Background remove → Task 29 ayrı component (HeavyActionButton); bu task'te
//     **placeholder buton** yerinde duruyor (onClick no-op). Task 29 bağlanınca
//     placeholder gerçek heavy action component ile değiştirilecek.
//   - Upscale 2× → DISABLED ("Yakında") — provider entegrasyonu yok, fake
//     capability vermez (CLAUDE.md honesty disipline). Section 1.4.
//   - Crop · oran seçimi → instant edit. 4 ratio (2:3 / 4:5 / 1:1 / 3:4); buton
//     tıklandığında inline menu açılır, ratio seçimi POST /edit'e gider.
//   - Transparent PNG kontrolü → instant edit (read-only analiz). Sonuç
//     response.item.editHistoryJson son entry'den okunup inline result olarak
//     gösterilir; 5 saniye sonra fade.
//
// Crop dropdown stratejisi (subagent kararı):
//   - @radix-ui/react-popover repo'da YOK (yalnızca dropdown-menu install).
//   - Phase 6 baseline'da hiçbir DropdownMenu tüketicisi yok (StudioShell'de
//     yalnız comment).
//   - Pragmatik karar: state-driven inline menu (`open` flag + role="menu" /
//     role="menuitem" listesi + outside click handle). Daha az dependency,
//     a11y ARIA semantik korunur, test öngörülebilir. Phase 7 v1 yeterli;
//     gelecekte birden fazla dropdown ihtiyacı çıkarsa Radix dropdown-menu'ya
//     terfi (carry-forward `selection-studio-dropdown-radix-promote`).
//
// Inline result fade (5 saniye) — useEffect cleanup pattern:
//   `useEffect(() => { if (transparentResult) { const t = setTimeout(...);
//   return () => clearTimeout(t); } }, [transparentResult])` — unmount
//   sonrası setState/leak yok. Plan'daki risk uyarısı bu pattern ile çözüldü.
//
// Mutation: POST /api/selection/sets/[setId]/items/[itemId]/edit (Task 22).
// Başarı sonrası selection set query invalidate → liste fresh fetch.

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  selectionSetQueryKey,
  type SelectionItemView,
  type SelectionSetStatus,
} from "../queries";
import { Crop, Sparkles, ImageOff, CheckCircle2 } from "lucide-react";

type CropRatio = "2:3" | "4:5" | "1:1" | "3:4";

const CROP_RATIOS: ReadonlyArray<{ value: CropRatio; label: string }> = [
  { value: "2:3", label: "2:3 portrait" },
  { value: "4:5", label: "4:5 portrait" },
  { value: "1:1", label: "1:1 square" },
  { value: "3:4", label: "3:4 landscape" },
];

const SECTION_LABEL_CLASS =
  "font-mono text-xs uppercase tracking-meta text-text-muted";

export type QuickActionsProps = {
  setId: string;
  item: SelectionItemView;
  setStatus: SelectionSetStatus;
};

type EditMutationVariables =
  | { op: "crop"; params: { ratio: CropRatio } }
  | { op: "transparent-check" };

type EditHistoryEntry = {
  op: string;
  at: string;
  params?: { ratio?: CropRatio };
  result?: {
    ok: boolean;
    summary: string;
  };
};

type TransparentResult = { ok: boolean; summary: string };

export function QuickActions({ setId, item, setStatus }: QuickActionsProps) {
  const queryClient = useQueryClient();
  const isReadOnly = setStatus !== "draft";

  const [transparentResult, setTransparentResult] =
    useState<TransparentResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const cropMenuRef = useRef<HTMLDivElement | null>(null);

  // Inline result auto-clear (5 saniye); unmount sonrası setState leak'siz.
  useEffect(() => {
    if (!transparentResult) return;
    const t = setTimeout(() => setTransparentResult(null), 5000);
    return () => clearTimeout(t);
  }, [transparentResult]);

  // Inline error auto-clear (5 saniye).
  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(null), 5000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  // Crop menu — outside click ile kapan.
  useEffect(() => {
    if (!cropOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        cropMenuRef.current &&
        !cropMenuRef.current.contains(e.target as Node)
      ) {
        setCropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [cropOpen]);

  const editMutation = useMutation({
    mutationFn: async (vars: EditMutationVariables) => {
      const res = await fetch(
        `/api/selection/sets/${setId}/items/${item.id}/edit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vars),
        },
      );
      if (!res.ok) {
        let detail = "";
        try {
          const body = (await res.json()) as { error?: string };
          detail = typeof body.error === "string" ? body.error : "";
        } catch {
          // ignore parse hatası
        }
        throw new Error(
          detail ? detail : `İşlem başarısız (${res.status})`,
        );
      }
      return (await res.json()) as { item: SelectionItemView };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: selectionSetQueryKey(setId),
      });
      setErrorMessage(null);

      // Transparent-check sonucunu response'tan oku (server son entry'ye
      // result push'lar — edit.service Task 22 sözleşmesi).
      if (variables.op === "transparent-check") {
        const history = (data.item.editHistoryJson ??
          []) as unknown as EditHistoryEntry[];
        const last = history[history.length - 1];
        if (
          last &&
          last.op === "transparent-check" &&
          last.result &&
          typeof last.result.summary === "string"
        ) {
          setTransparentResult({
            ok: last.result.ok,
            summary: last.result.summary,
          });
        }
      }
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  const handleCropSelect = (ratio: CropRatio) => {
    setCropOpen(false);
    if (isReadOnly || editMutation.isPending) return;
    editMutation.mutate({ op: "crop", params: { ratio } });
  };

  const handleCropToggle = () => {
    if (isReadOnly || editMutation.isPending) return;
    setCropOpen((v) => !v);
  };

  const handleTransparentCheck = () => {
    if (isReadOnly || editMutation.isPending) return;
    editMutation.mutate({ op: "transparent-check" });
  };

  const isPending = editMutation.isPending;
  const pendingOp = editMutation.variables?.op;

  return (
    <div className="border-b border-border-subtle px-4 py-3">
      <div className={SECTION_LABEL_CLASS}>Hızlı işlem</div>
      <div className="mt-2 flex flex-col gap-1.5">
        {/* 1. Background remove — Task 29 placeholder (heavy op ayrı buton) */}
        <BackgroundRemovePlaceholder isReadOnly={isReadOnly || isPending} />

        {/* 2. Upscale 2× — DISABLED (provider yok, honesty: "Yakında") */}
        <UpscaleDisabledButton />

        {/* 3. Crop · oran seçimi — inline menu */}
        <div className="relative" ref={cropMenuRef}>
          <ActionButton
            label="Crop · oran seçimi"
            icon={<Crop className="h-3.5 w-3.5" />}
            onClick={handleCropToggle}
            disabled={isReadOnly || isPending}
            loading={isPending && pendingOp === "crop"}
            ariaHaspopup="menu"
            ariaExpanded={cropOpen}
          />
          {cropOpen ? (
            <div
              role="menu"
              aria-label="Crop ratio seçimi"
              className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border border-border bg-surface p-1 shadow-popover"
            >
              {CROP_RATIOS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  onClick={() => handleCropSelect(opt.value)}
                  className="block w-full rounded-sm px-2 py-1.5 text-left text-sm text-text hover:bg-surface-2"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* 4. Transparent PNG kontrolü — read-only analiz */}
        <ActionButton
          label="Transparent PNG kontrolü"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          onClick={handleTransparentCheck}
          disabled={isReadOnly || isPending}
          loading={isPending && pendingOp === "transparent-check"}
        />
      </div>

      {/* Inline result — transparent-check sonrası 5 saniye */}
      {transparentResult ? (
        <div
          role="status"
          aria-live="polite"
          className={
            transparentResult.ok
              ? "mt-2 rounded-md border border-success bg-success-soft px-2 py-1.5 text-xs text-success"
              : "mt-2 rounded-md border border-warning bg-warning-soft px-2 py-1.5 text-xs text-warning"
          }
        >
          {transparentResult.summary}
        </div>
      ) : null}

      {/* Inline error — mutation fail */}
      {errorMessage ? (
        <div
          role="alert"
          aria-live="assertive"
          className="mt-2 rounded-md border border-danger bg-danger-soft px-2 py-1.5 text-xs text-danger"
        >
          {errorMessage}
        </div>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ActionButton — paylaşılan tek satırlık quick action butonu
// ────────────────────────────────────────────────────────────

type ActionButtonProps = {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  ariaHaspopup?: "menu";
  ariaExpanded?: boolean;
};

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  loading,
  ariaHaspopup,
  ariaExpanded,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-haspopup={ariaHaspopup}
      aria-expanded={ariaExpanded}
      className="flex h-control-md w-full items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm text-text transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-text-muted">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {loading ? (
        <span
          className="h-3 w-3 animate-spin rounded-full border-2 border-text-muted border-t-transparent"
          aria-label="Yükleniyor"
        />
      ) : null}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// Task 29 placeholder — Background remove
// ────────────────────────────────────────────────────────────
//
// Heavy op (BullMQ); Task 29 ayrı component (HeavyActionButton) bağlayacak.
// Bu task'te yalnız buton **yerinde** duruyor (onClick no-op). Read-only set
// veya pending mutation sırasında disabled olur (Task 29 implementasyonu da
// aynı disipline uyar).

function BackgroundRemovePlaceholder({ isReadOnly }: { isReadOnly: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        // Task 29 HeavyActionButton bağlanana kadar no-op.
      }}
      disabled={isReadOnly}
      className="flex h-control-md w-full items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm text-text transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-text-muted">
        <ImageOff className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-left">Background remove</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// Upscale 2× — DISABLED ("Yakında")
// ────────────────────────────────────────────────────────────
//
// Provider entegrasyonu yok; fake capability vermez. Sakin ton: muted text +
// küçük "Yakında" rozeti + title attr.

function UpscaleDisabledButton() {
  return (
    <button
      type="button"
      disabled
      title="Yakında — provider entegrasyonu sonrası aktif"
      aria-label="Upscale 2× (yakında aktif olacak)"
      className="flex h-control-md w-full cursor-not-allowed items-center gap-2 rounded-md border border-border bg-transparent px-3 text-sm text-text-muted opacity-60"
    >
      <span className="text-text-muted">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-left">Upscale 2×</span>
      <span className="font-mono text-xs uppercase tracking-meta text-text-muted">
        Yakında
      </span>
    </button>
  );
}
