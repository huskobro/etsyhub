"use client";

// Phase 7 Task 24 — CreateSetModal (zorunlu name input)
//
// Spec Section 3.1: manuel "Yeni set oluştur" CTA → küçük modal (Quick start
// flow'undan farklı). Tek input (name), client-side validation (trim min 1),
// submit → POST /api/selection/sets → success'te redirect ve modal kapat.
//
// Design tercihleri:
//   - Radix Dialog primitive'i direkt kullanılır (confirm-dialog wrapper'ı
//     description+confirm pattern'idir, input içermez).
//   - Tek FormField (label + input + inline error). FormField error prop'u
//     üzerinden a11y bağlamayı (aria-invalid + aria-describedby) otomatik kurar.
//   - Submit hatası inline gösterilir (modal kapanmaz, retry mümkün).
//   - Mutation success → redirect + onOpenChange(false) + cache invalidate
//     (defensive; Studio'dan geri dönüldüğünde liste taze olur).
//
// Token discipline: bg-text/40 overlay (Phase 6 confirm-dialog ile aynı),
// shadow-popover (Tailwind tokens), bg-surface/border-border standart.

import { useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";

export type CreateSetModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CreatedSet = { id: string };

async function postCreateSet(name: string): Promise<CreatedSet> {
  const res = await fetch("/api/selection/sets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: unknown };
      // Server hata payload'u `{ error: string, code, details }` (errorResponse).
      if (typeof body.error === "string") detail = body.error;
    } catch {
      // ignore parse hatası
    }
    throw new Error(detail || `İstek başarısız (${res.status})`);
  }
  const data = (await res.json()) as { set: CreatedSet };
  return data.set;
}

export function CreateSetModal({ open, onOpenChange }: CreateSetModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const trimmed = name.trim();
  const isValid = trimmed.length > 0;

  const mutation = useMutation({
    mutationFn: () => postCreateSet(trimmed),
    onSuccess: (set) => {
      // Defensive cache invalidate: kullanıcı yeni set sayfasından geri
      // dönerse liste taze olur. Redirect zaten yeni route'a gider.
      queryClient.invalidateQueries({ queryKey: ["selection", "sets"] });
      setSubmitError(null);
      setName("");
      onOpenChange(false);
      router.push(`/selection/sets/${set.id}`);
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
    },
  });

  // Modal kapandığında local state'i sıfırla. Cancel/Escape sonrası tekrar
  // açıldığında temiz bir input ve error olmadan başlar.
  useEffect(() => {
    if (!open) {
      setName("");
      setSubmitError(null);
    }
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (mutation.isPending) return;
    onOpenChange(next);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValid || mutation.isPending) return;
    setSubmitError(null);
    mutation.mutate();
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-text/40 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-md border border-border bg-surface p-6 shadow-popover focus:outline-none"
          onEscapeKeyDown={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (mutation.isPending) e.preventDefault();
          }}
        >
          <Dialog.Title className="text-base font-semibold text-text">
            Yeni set oluştur
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-text-muted">
            Set adını girin. Sonradan değiştirilemez.
          </Dialog.Description>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <FormField
              label="Set adı"
              htmlFor="create-set-name"
              required
              error={
                !isValid && name.length > 0 ? "Set adı boş olamaz." : undefined
              }
            >
              <Input
                id="create-set-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="örn. Boho Wall Art"
                disabled={mutation.isPending}
              />
            </FormField>

            {submitError ? (
              <p
                role="alert"
                className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {submitError}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                İptal
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!isValid || mutation.isPending}
              >
                {mutation.isPending ? "Oluşturuluyor..." : "Oluştur"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
