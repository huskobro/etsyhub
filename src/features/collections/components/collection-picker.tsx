"use client";

import { useQuery } from "@tanstack/react-query";

type CollectionOption = { id: string; name: string };
type ListResponse = { items: CollectionOption[] };

export function CollectionPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const query = useQuery<ListResponse>({
    queryKey: ["collections-all"],
    queryFn: async () => {
      const res = await fetch("/api/collections?limit=100", { cache: "no-store" });
      if (!res.ok) throw new Error("Koleksiyonlar alınamadı");
      return res.json();
    },
  });

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? e.target.value : null)}
      disabled={disabled || query.isLoading}
      className="h-7 rounded-md border border-border bg-surface px-2 text-xs text-text disabled:opacity-50"
    >
      <option value="">Koleksiyon yok</option>
      {query.data?.items.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}
