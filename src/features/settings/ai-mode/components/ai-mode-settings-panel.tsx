"use client";

// Phase 5 Task 15 — AI Mode settings panel.
// kieApiKey + geminiApiKey password input. GET masked değerleri çeker (plain
// asla gelmez). PUT'ta boş string preserve sentinel — kullanıcı "değiştirmeden
// geç" davranışını boş bırakarak yapar.

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type MaskedSettings = {
  kieApiKey: string | null;
  geminiApiKey: string | null;
};

type FormState = {
  kieApiKey: string;
  geminiApiKey: string;
};

const QUERY_KEY = ["settings", "ai-mode"] as const;

export function AiModeSettingsPanel() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<{ settings: MaskedSettings }> => {
      const r = await fetch("/api/settings/ai-mode");
      if (!r.ok) throw new Error("Ayarlar yüklenemedi");
      return r.json();
    },
  });

  // Form her zaman boş başlar — masked değer ("•••••") form'a yansıtılmaz;
  // boş string PUT'ta preserve sinyali olduğu için bu doğru davranış.
  const [form, setForm] = useState<FormState>({
    kieApiKey: "",
    geminiApiKey: "",
  });
  const initialMask = useMemo(() => query.data?.settings, [query.data]);
  // WHY: query yenilendikçe (mutation onSuccess) form'u sıfırla — kullanıcı
  // tekrar girmeden submit etmesin diye.
  useEffect(() => {
    if (initialMask) setForm({ kieApiKey: "", geminiApiKey: "" });
  }, [initialMask]);

  const mutation = useMutation({
    mutationFn: async (data: FormState) => {
      const r = await fetch("/api/settings/ai-mode", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? "Kaydedilemedi");
      }
      return r.json() as Promise<{ settings: MaskedSettings }>;
    },
    onSuccess: (res) => {
      qc.setQueryData(QUERY_KEY, res);
    },
  });

  if (query.isLoading) {
    return (
      <Card variant="stat" className="p-5">
        <h2 className="text-lg font-semibold text-text">AI Mode anahtarları</h2>
        <p className="mt-2 text-sm text-text-muted">Yükleniyor…</p>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card variant="stat" className="p-5">
        <h2 className="text-lg font-semibold text-text">AI Mode anahtarları</h2>
        <p className="mt-2 text-sm text-danger">
          {(query.error as Error | null)?.message ?? "Ayarlar yüklenemedi"}
        </p>
      </Card>
    );
  }

  const masked = query.data!.settings;
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <Card variant="stat" className="p-5">
      <h2 className="text-lg font-semibold text-text">AI Mode anahtarları</h2>
      <p className="mt-1 text-sm text-text-muted">
        Sağlayıcı anahtarları sunucuda şifreli saklanır; arayüze plain text
        olarak hiçbir zaman dönmez. Boş bırakırsanız mevcut değer korunur.
      </p>
      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <FormField
          label="KIE.AI API Anahtarı"
          description={
            masked.kieApiKey
              ? "Mevcut: ••••• (boş bırakılırsa değişmez)"
              : "Henüz tanımlı değil."
          }
        >
          <Input
            type="password"
            autoComplete="off"
            value={form.kieApiKey}
            onChange={(e) =>
              setForm((cur) => ({ ...cur, kieApiKey: e.target.value }))
            }
            placeholder={masked.kieApiKey ? "•••••" : "kie_..."}
          />
        </FormField>

        <FormField
          label="Gemini API Anahtarı"
          description={
            masked.geminiApiKey
              ? "Mevcut: ••••• (boş bırakılırsa değişmez)"
              : "Henüz tanımlı değil."
          }
        >
          <Input
            type="password"
            autoComplete="off"
            value={form.geminiApiKey}
            onChange={(e) =>
              setForm((cur) => ({ ...cur, geminiApiKey: e.target.value }))
            }
            placeholder={masked.geminiApiKey ? "•••••" : "AIza..."}
          />
        </FormField>

        {mutation.isError ? (
          <p className="text-sm text-danger" role="alert">
            {(mutation.error as Error | null)?.message ?? "Kaydedilemedi"}
          </p>
        ) : null}
        {mutation.isSuccess ? (
          <p className="text-sm text-success">Kaydedildi.</p>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={mutation.isPending}
            disabled={mutation.isPending}
          >
            Kaydet
          </Button>
        </div>
      </form>
    </Card>
  );
}
