"use client";

import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ReferenceCard } from "./reference-card";

type ReferenceLite = {
  id: string;
  userId: string;
  notes: string | null;
  createdAt: string;
  asset: { id: string; storageKey: string; bucket: string } | null;
  productType: { id: string; displayName: string } | null;
  collection: { id: string; name: string } | null;
  bookmark: { id: string; title: string | null; sourceUrl: string | null } | null;
  tags: { tag: { id: string; name: string; color: string | null } }[];
};

type ListResponse = {
  items: ReferenceLite[];
  nextCursor: string | null;
};

type ProductTypeOption = { id: string; displayName: string };

export function ReferencesPage({
  productTypes,
}: {
  productTypes: ProductTypeOption[];
}) {
  const qc = useQueryClient();
  const [productTypeId, setProductTypeId] = useState<string>("");
  const [q, setQ] = useState("");

  const query = useQuery<ListResponse>({
    queryKey: ["references", productTypeId, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (productTypeId) params.set("productTypeId", productTypeId);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "60");
      const res = await fetch(`/api/references?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Liste alınamadı");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/references/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Arşivleme başarısız");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["references"] }),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Reference Board</h1>
        <p className="text-sm text-text-muted">
          Seçilmiş referanslar — üretime hazır kaynak havuzu.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={productTypeId}
          onChange={(e) => setProductTypeId(e.target.value)}
          className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text"
        >
          <option value="">Tüm ürün tipleri</option>
          {productTypes.map((pt) => (
            <option key={pt.id} value={pt.id}>
              {pt.displayName}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Notlarda ara"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 min-w-60 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-text"
        />
      </div>

      {query.isLoading ? (
        <p className="text-sm text-text-muted">Yükleniyor…</p>
      ) : query.error ? (
        <p className="text-sm text-danger">{(query.error as Error).message}</p>
      ) : !query.data || query.data.items.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Henüz referans yok. Bookmark sayfasından &quot;Referansa Taşı&quot; ile ekle.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {query.data.items.map((ref) => (
            <ReferenceCard
              key={ref.id}
              reference={ref}
              onArchive={(id) => archiveMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
