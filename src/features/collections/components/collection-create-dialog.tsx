"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/components/ui/use-focus-trap";

type CollectionKindOption = "BOOKMARK" | "REFERENCE" | "MIXED";

/**
 * CollectionCreateDialog — yeni koleksiyon oluşturmak için kullanılan disclosure.
 *
 * C1 hizalaması (post CP-9 cleanup wave): Bookmarks PromoteDialog +
 * AddCompetitorDialog ile aynı manuel disclosure pattern'ine taşındı.
 * useFocusTrap'in 5. tüketim noktası.
 *
 * a11y davranışları:
 * - role="dialog" + aria-modal="true" + aria-labelledby="create-collection-title"
 * - useFocusTrap → Tab boundary + initial focus ("İsim" input)
 * - Escape → onClose (busy iken iptal edilmez; mutation in-flight koruması)
 * - Backdrop click → onClose (target === currentTarget guard + busy guard)
 * - Vazgeç butonu disabled={busy}
 *
 * NOT: Form mantığı (name/description/kind state, onSubmit handler, busy/error
 * prop davranışı) DOKUNULMADI.
 */
export function CollectionCreateDialog({
  onClose,
  onSubmit,
  busy,
  error,
}: {
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    description?: string;
    kind: CollectionKindOption;
  }) => void;
  busy: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<CollectionKindOption>("MIXED");

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLInputElement | null>(null);

  // C1 a11y: Tab boundary + initial focus tek hook ile yönetilir.
  // Initial focus "İsim" input'a — kullanıcı dialog açılır açılmaz yazmaya
  // başlayabilsin.
  useFocusTrap(dialogRef, true, initialFocusRef);

  // C1 a11y: Escape → onClose. busy iken iptal edilmez (mutation in-flight;
  // ConfirmDialog/PromoteDialog'un busy guard paterni).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (busy) return;
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, busy]);

  // C1 a11y: Backdrop tıklamasında onClose. Dialog içi tıklama event
  // bubbling ile buraya gelse de target !== currentTarget olduğu için
  // tetiklenmez. busy iken iptal edilmez.
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (busy) return;
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-collection-title"
      onClick={handleOverlayClick}
      className="fixed inset-0 z-40 grid place-items-center bg-text/40 p-4"
    >
      <div className="w-full max-w-md rounded-md border border-border bg-surface p-6 shadow-popover">
        <h2 id="create-collection-title" className="text-lg font-semibold text-text">Yeni Koleksiyon</h2>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || busy) return;
            onSubmit({
              name: name.trim(),
              description: description.trim() || undefined,
              kind,
            });
          }}
        >
          <label className="flex flex-col gap-1 text-sm text-text">
            İsim
            <input
              ref={initialFocusRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
              className="h-9 rounded-md border border-border bg-bg px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text">
            Açıklama (opsiyonel)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text">
            Tip
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CollectionKindOption)}
              className="h-9 rounded-md border border-border bg-bg px-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="MIXED">Karma</option>
              <option value="BOOKMARK">Bookmark</option>
              <option value="REFERENCE">Reference</option>
            </select>
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {busy ? "Kaydediliyor…" : "Oluştur"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
