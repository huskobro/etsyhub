"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ThemeStatus } from "@prisma/client";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

type ThemeRow = {
  id: string;
  name: string;
  status: ThemeStatus;
  isSystem: boolean;
  tokens: unknown;
  createdAt: string;
};

async function fetchThemes(): Promise<ThemeRow[]> {
  const res = await fetch("/api/admin/themes", { cache: "no-store" });
  if (!res.ok) throw new Error("Tema listesi alınamadı");
  const data = (await res.json()) as { themes: ThemeRow[] };
  return data.themes;
}

async function activateTheme(themeId: string) {
  const res = await fetch("/api/admin/themes", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ themeId }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Aktifleştirme başarısız");
  return res.json();
}

export function ThemesList() {
  const qc = useQueryClient();
  const { confirm, close, run, state } = useConfirm();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "themes"],
    queryFn: fetchThemes,
  });
  const mutation = useMutation({
    mutationFn: activateTheme,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "themes"] }),
  });

  if (isLoading) return <p className="text-sm text-text-muted">Yükleniyor…</p>;
  if (error) return <p className="text-sm text-danger">{(error as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-text-muted">
        Token editörü Phase 10&apos;da eklenecek; şu an sadece aktif tema seçimi yapılabilir.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.map((t) => (
          <Card
            key={t.id}
            variant="stat"
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-medium text-text">{t.name}</span>
                <span className="text-xs text-text-muted">
                  {t.isSystem ? "Sistem" : "Özel"} · {t.status}
                </span>
              </div>
              {t.status === "ACTIVE" ? (
                <Badge tone="success">AKTİF</Badge>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={mutation.isPending}
                  onClick={() =>
                    confirm(
                      confirmPresets.activateTheme(t.name),
                      async () => {
                        await mutation.mutateAsync(t.id);
                      },
                    )
                  }
                >
                  Aktifleştir
                </Button>
              )}
            </div>
            <pre className="max-h-48 overflow-auto rounded-md bg-bg p-3 text-xs text-text-muted">
              {JSON.stringify(t.tokens, null, 2)}
            </pre>
          </Card>
        ))}
      </div>
      {state.preset ? (
        <ConfirmDialog
          open={state.open}
          onOpenChange={(o) => {
            if (!o) close();
          }}
          {...state.preset}
          onConfirm={run}
          busy={state.busy}
          errorMessage={state.errorMessage}
        />
      ) : null}
    </div>
  );
}
