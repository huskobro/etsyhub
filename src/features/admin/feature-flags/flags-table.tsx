"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FeatureFlagScope } from "@prisma/client";

type FlagRow = {
  id: string;
  key: string;
  enabled: boolean;
  scope: FeatureFlagScope;
};

async function fetchFlags(): Promise<FlagRow[]> {
  const res = await fetch("/api/admin/feature-flags", { cache: "no-store" });
  if (!res.ok) throw new Error("Flag listesi alınamadı");
  const data = (await res.json()) as { flags: FlagRow[] };
  return data.flags;
}

async function toggleFlag(input: { key: string; enabled: boolean }) {
  const res = await fetch("/api/admin/feature-flags", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Güncelleme başarısız");
  return res.json();
}

export function FlagsTable() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "feature-flags"],
    queryFn: fetchFlags,
  });
  const mutation = useMutation({
    mutationFn: toggleFlag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "feature-flags"] }),
  });

  if (isLoading) return <p className="text-sm text-text-muted">Yükleniyor…</p>;
  if (error) return <p className="text-sm text-danger">{(error as Error).message}</p>;
  if (!data) return null;

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-text-muted">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Anahtar</th>
            <th className="px-4 py-2 text-left font-medium">Scope</th>
            <th className="px-4 py-2 text-left font-medium">Durum</th>
          </tr>
        </thead>
        <tbody>
          {data.map((f) => (
            <tr key={f.id} className="border-t border-border">
              <td className="px-4 py-2 font-mono text-text">{f.key}</td>
              <td className="px-4 py-2 text-text-muted">{f.scope}</td>
              <td className="px-4 py-2">
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ key: f.key, enabled: !f.enabled })}
                  className={
                    "rounded-md px-3 py-1 text-xs font-medium " +
                    (f.enabled
                      ? "bg-success/15 text-success"
                      : "bg-surface-muted text-text-muted")
                  }
                >
                  {f.enabled ? "AÇIK" : "KAPALI"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
