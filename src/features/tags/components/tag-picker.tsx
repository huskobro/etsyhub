"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { tagColorClass, TAG_COLOR_KEYS } from "@/features/tags/color-map";

type TagLite = { id: string; name: string; color: string | null };
type ListResponse = { items: TagLite[] };

export function TagPicker({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<(typeof TAG_COLOR_KEYS)[number]>("accent");

  const query = useQuery<ListResponse>({
    queryKey: ["tags-all"],
    queryFn: async () => {
      const res = await fetch("/api/tags", { cache: "no-store" });
      if (!res.ok) throw new Error("Taglar alınamadı");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      color: (typeof TAG_COLOR_KEYS)[number];
    }) => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Tag oluşturulamadı");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tags-all"] });
      const created = data.tag as TagLite | undefined;
      if (created) onChange([...selected, created.id]);
      setNewName("");
    },
  });

  const byId = useMemo(() => {
    const m = new Map<string, TagLite>();
    for (const t of query.data?.items ?? []) m.set(t.id, t);
    return m;
  }, [query.data]);

  function toggle(tagId: string) {
    if (selected.includes(tagId)) {
      onChange(selected.filter((id) => id !== tagId));
    } else {
      onChange([...selected, tagId]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {selected.length === 0 ? (
          <span className="text-xs text-text-muted">No tags</span>
        ) : (
          selected.map((id) => {
            const t = byId.get(id);
            if (!t) return null;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => !disabled && toggle(t.id)}
                className={`rounded-md px-2 py-0.5 text-xs ${tagColorClass(t.color)}`}
              >
                {t.name} ✕
              </button>
            );
          })
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          className="rounded-md border border-border px-2 py-0.5 text-xs text-text-muted hover:bg-surface-muted disabled:opacity-50"
        >
          {open ? "Close" : "Add tag"}
        </button>
      </div>

      {open ? (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface p-2">
          <div className="flex flex-wrap gap-1">
            {query.data?.items.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={`rounded-md px-2 py-0.5 text-xs ${tagColorClass(t.color)} ${
                  selected.includes(t.id) ? "ring-1 ring-accent" : ""
                }`}
              >
                {t.name}
              </button>
            ))}
            {query.data && query.data.items.length === 0 ? (
              <span className="text-xs text-text-muted">Hiç tag yok.</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Yeni tag"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
              className="h-7 flex-1 rounded-md border border-border bg-bg px-2 text-xs text-text"
            />
            <select
              value={newColor}
              onChange={(e) =>
                setNewColor(e.target.value as (typeof TAG_COLOR_KEYS)[number])
              }
              className="h-7 rounded-md border border-border bg-bg px-1 text-xs text-text"
            >
              {TAG_COLOR_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!newName.trim() || createMutation.isPending) return;
                createMutation.mutate({ name: newName.trim(), color: newColor });
              }}
              disabled={createMutation.isPending || !newName.trim()}
              className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground disabled:opacity-50"
            >
              Ekle
            </button>
          </div>
          {createMutation.error ? (
            <p className="text-xs text-danger">
              {(createMutation.error as Error).message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
