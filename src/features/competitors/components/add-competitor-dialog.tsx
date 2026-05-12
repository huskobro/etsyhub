"use client";

import { useEffect, useRef, useState } from "react";
import { useCreateCompetitor } from "../mutations/use-create-competitor";
import { useFocusTrap } from "@/components/ui/use-focus-trap";
import type { AddCompetitorInput } from "../schemas";

type Platform = AddCompetitorInput["platform"];

export function AddCompetitorDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const [shopIdentifier, setShopIdentifier] = useState("");
  const [platform, setPlatform] = useState<Platform>("ETSY");
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const createMutation = useCreateCompetitor();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const initialInputRef = useRef<HTMLInputElement | null>(null);

  // T-40 a11y: Escape → onClose. aria-modal="true" taahhüdü ile uyumlandı.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // T-40 a11y: Tab boundary + initial focus tek hook ile yönetilir.
  // initialFocusRef parametresi explicit ilk input (mağaza adı/URL)
  // odaklamasını hook effect'inde garanti eder; ikinci useEffect (manuel
  // .focus()) effect-sıralama race condition'ı doğurur — kaldırıldı.
  useFocusTrap(dialogRef, true, initialInputRef);

  // T-40 a11y: Backdrop (overlay) tıklamasında onClose. Dialog içi tıklama
  // event bubbling ile buraya gelse de target !== currentTarget olduğu için
  // tetiklenmez (TrendClusterDrawer paterni).
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const canSubmit =
    !createMutation.isPending && shopIdentifier.trim().length >= 2;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate(
      {
        shopIdentifier: shopIdentifier.trim(),
        platform,
        autoScanEnabled,
      },
      {
        onSuccess: (data) => {
          onCreated?.(data.competitor.id);
          onClose();
        },
      },
    );
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-competitor-title"
      onClick={handleOverlayClick}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-popover"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="add-competitor-title"
            className="text-lg font-semibold text-text"
          >
            Add competitor shop
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Close
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="shopIdentifier"
            className="flex flex-col gap-1 text-sm text-text"
          >
            Shop name or URL
            <input
              ref={initialInputRef}
              id="shopIdentifier"
              type="text"
              required
              minLength={2}
              maxLength={200}
              placeholder="PrintableBohoArt or https://etsy.com/shop/…"
              value={shopIdentifier}
              onChange={(e) => setShopIdentifier(e.target.value)}
              disabled={createMutation.isPending}
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
            />
          </label>

          <label
            htmlFor="platform"
            className="flex flex-col gap-1 text-sm text-text"
          >
            Platform
            <select
              id="platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              disabled={createMutation.isPending}
              className="h-10 rounded-md border border-border bg-bg px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
            >
              <option value="ETSY">Etsy</option>
              <option value="AMAZON">Amazon</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={autoScanEnabled}
              onChange={(e) => setAutoScanEnabled(e.target.checked)}
              disabled={createMutation.isPending}
              className="h-4 w-4 rounded-sm border border-border bg-bg accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            Enable daily auto-scan (new listings are captured automatically)
          </label>
        </div>

        {createMutation.isError ? (
          <p className="mt-3 text-xs text-danger">
            {createMutation.error.message}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={createMutation.isPending}
            className="rounded-md border border-border px-3 py-2 text-sm text-text hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            {createMutation.isPending ? "Adding…" : "Add competitor"}
          </button>
        </div>
      </form>
    </div>
  );
}
