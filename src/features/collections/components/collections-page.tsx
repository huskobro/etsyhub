"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Search, Plus, FolderIcon } from "lucide-react";
import { CollectionCard } from "./collection-card";
import { CollectionCreateDialog } from "./collection-create-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/components/ui/use-confirm";
import { confirmPresets } from "@/components/ui/confirm-presets";
import { Toolbar } from "@/components/ui/Toolbar";
import { FilterBar } from "@/components/ui/FilterBar";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";
import { SkeletonCardGrid } from "@/components/ui/Skeleton";

type CollectionKind = "BOOKMARK" | "REFERENCE" | "MIXED";
type KindFilter = "ALL" | "BOOKMARK" | "REFERENCE";

type CollectionLite = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: CollectionKind;
  createdAt: string;
  updatedAt?: string;
  _count: { bookmarks: number; references: number };
  thumbnailAssetIds?: string[];
};

type ListResponse = {
  items: CollectionLite[];
  uncategorizedReferenceCount: number;
  orphanedReferenceCount: number;
};

export function CollectionsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { confirm, close, run, state } = useConfirm();
  const [kind, setKind] = useState<KindFilter>("ALL");
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("intent") === "create") {
      setCreateOpen(true);
      router.replace("/collections");
    }
  }, [router]);

  const query = useQuery<ListResponse>({
    queryKey: ["collections-all", kind, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (kind !== "ALL") params.set("kind", kind);
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", "60");
      const res = await fetch(`/api/collections?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Koleksiyonlar alınamadı");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      kind: CollectionKind;
    }) => {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Koleksiyon oluşturulamadı");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections-all"] });
      qc.invalidateQueries({ queryKey: ["collections", { kind: "REFERENCE" }] });
      qc.invalidateQueries({ queryKey: ["collections", { kind: "BOOKMARK" }] });
      setCreateOpen(false);
      setCreateError(null);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Arşivleme başarısız");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collections-all"] });
      qc.invalidateQueries({ queryKey: ["collections", { kind: "REFERENCE" }] });
      qc.invalidateQueries({ queryKey: ["collections", { kind: "BOOKMARK" }] });
    },
  });

  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* R11.14.3 — Çift header kaldırıldı; üst topbar References shell
       * tarafından tek h1 + sub-view subtitle olarak render ediliyor. */}
      <div className="flex justify-end">
        <button
          type="button"
          data-size="sm"
          className="k-btn k-btn--primary"
          onClick={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="h-3 w-3" aria-hidden />
          New collection
        </button>
      </div>

      <Toolbar
        leading={
          <div className="w-60">
            <Input
              type="search"
              placeholder="Search collections"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              prefix={<Search className="h-4 w-4" aria-hidden />}
            />
          </div>
        }
      >
        <FilterBar>
          <Chip active={kind === "ALL"} onToggle={() => setKind("ALL")}>
            All
          </Chip>
          <Chip
            active={kind === "BOOKMARK"}
            onToggle={() => setKind("BOOKMARK")}
          >
            Bookmark
          </Chip>
          <Chip
            active={kind === "REFERENCE"}
            onToggle={() => setKind("REFERENCE")}
          >
            Reference
          </Chip>
        </FilterBar>
      </Toolbar>

      {query.isLoading ? (
        <SkeletonCardGrid count={6} />
      ) : query.error ? (
        <StateMessage
          tone="error"
          title="Couldn't load list"
          body={(query.error as Error).message}
        />
      ) : items.length === 0 ? (
        q.trim() ? (
          <StateMessage
            tone="neutral"
            icon={<FolderIcon className="h-5 w-5" aria-hidden />}
            title="No matching collection"
            body="Try a different search term or create a new collection."
          />
        ) : (
          <StateMessage
            tone="neutral"
            icon={<FolderIcon className="h-5 w-5" aria-hidden />}
            title="No collections yet"
            body="Group bookmarks and references by theme. Create your first collection to start."
            action={
              <Button
                variant="primary"
                icon={<Plus className="h-4 w-4" aria-hidden />}
                onClick={() => {
                  setCreateError(null);
                  setCreateOpen(true);
                }}
              >
                Create your first collection
              </Button>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <CollectionCard
              key={c.id}
              collection={c}
              onArchive={(id) => {
                const item = items.find((col) => col.id === id);
                confirm(
                  confirmPresets.archiveCollection(item?.name),
                  async () => {
                    await archiveMutation.mutateAsync(id);
                  },
                );
              }}
            />
          ))}
        </div>
      )}

      {createOpen ? (
        <CollectionCreateDialog
          busy={createMutation.isPending}
          error={createError}
          onClose={() => {
            setCreateOpen(false);
            setCreateError(null);
          }}
          onSubmit={(input) => createMutation.mutate(input)}
        />
      ) : null}

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
