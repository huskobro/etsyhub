"use client";

// Phase 7 Task 23 — /selection index page client component.
//
// Spec Section 3.1 + plan Task 23:
//   - Üstte: aktif draft set kartı (varsa "Aç" → /selection/sets/[id];
//     yoksa empty state + "Yeni set oluştur" CTA modal trigger)
//   - Altta: "Son finalize edilen set'ler" max 5, link list
//
// Item count gösterilmez — list endpoint payload'ı entity satırı (items
// aggregate yok). Carry-forward: `selection-list-item-count`.
//
// "Yeni set oluştur" butonu placeholder — Task 24 CreateSetModal'ı
// bağlayacak. Bu task'te buton yerinde, click'i lokal `useState` ile
// stub'lanmış, modal yerine console.info bırakılır (Task 24 setOpen(true)
// olarak değiştirecek).
//
// Tone: sade kokpit hissi; PageShell sarmalayıcısını layout veriyor —
// bu component sadece content body'sini taşır.

import { useState } from "react";
import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StateMessage } from "@/components/ui/StateMessage";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useSelectionSets,
  type SelectionSetListItem,
} from "@/features/selection/queries";
import { CreateSetModal } from "./CreateSetModal";
import { MjOriginInlineBadge } from "./MjOriginInlineBadge";

const READY_LIMIT = 5;

export function SelectionIndexPage() {
  // Task 24 — CreateSetModal entegre. Boolean state modal'ın disclosure
  // kontrolünü taşır; modal kapalıyken DOM'da render edilmez (Radix Portal).
  const [createOpen, setCreateOpen] = useState(false);

  const draftQuery = useSelectionSets("draft");
  const readyQuery = useSelectionSets("ready");

  const activeDraft = draftQuery.data?.[0] ?? null;
  const readySets = (readyQuery.data ?? []).slice(0, READY_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-text">Selection Studio</h1>
        <p className="mt-1 text-sm text-text-muted">
          Curate, edit and export your designs.
        </p>
      </header>

      {/* Active draft set */}
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs tracking-meta text-text-muted">
          Active draft
        </h2>
        {draftQuery.isLoading ? (
          <Card
            role="status"
            aria-label="Loading active draft set"
            className="flex flex-col gap-3"
          >
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </Card>
        ) : draftQuery.error ? (
          <Card>
            <StateMessage
              tone="error"
              title="Couldn't load"
              body="Active draft set info could not be retrieved. Try again."
            />
          </Card>
        ) : activeDraft ? (
          <ActiveDraftCard set={activeDraft} />
        ) : (
          <Card>
            <StateMessage
              tone="neutral"
              title="No active draft set yet"
              body="Create a new set to start curating designs."
              action={
                <Button
                  variant="primary"
                  icon={<Plus className="h-4 w-4" aria-hidden />}
                  onClick={() => setCreateOpen(true)}
                >
                  Create new set
                </Button>
              }
            />
          </Card>
        )}
      </section>

      {/* Recently finalized sets */}
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs tracking-meta text-text-muted">
          Recently finalized sets
        </h2>
        {readyQuery.isLoading ? (
          <div
            role="status"
            aria-label="Loading finalized sets"
            className="flex flex-col gap-2"
          >
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : readyQuery.error ? (
          <Card>
            <StateMessage
              tone="error"
              title="Couldn't load"
              body="Finalized set list could not be retrieved."
            />
          </Card>
        ) : readySets.length === 0 ? (
          <p className="text-sm text-text-muted">
            No finalized sets yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {readySets.map((s) => (
              <ReadySetRow key={s.id} set={s} />
            ))}
          </ul>
        )}
      </section>

      <CreateSetModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

// Pass 35 — Set thumbnail görseli. listSets payload'ından gelen signed URL.
// Asset URL var → 40×40 rounded thumb; yok → Layers icon fallback.
// Tek noktadan refactor için inline component.
function SetThumb({
  thumbnailUrl,
  alt,
}: {
  thumbnailUrl: string | null;
  alt: string;
}) {
  if (thumbnailUrl) {
    return (
      <div
        className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md border border-border bg-surface-2"
        data-testid="selection-set-thumbnail"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnailUrl}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-text">
      <Layers className="h-4 w-4" aria-hidden />
    </div>
  );
}

function ActiveDraftCard({ set }: { set: SelectionSetListItem }) {
  return (
    <Card className="flex items-center gap-3">
      <SetThumb
        thumbnailUrl={set.thumbnailUrl}
        alt={`${set.name} önizleme`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="truncate text-sm font-medium text-text">{set.name}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Draft</Badge>
          {/* Pass 35 — Item count visible. "0 items" → empty-set signal. */}
          <span className="font-mono text-xs text-text-muted">
            {set.itemCount} items
          </span>
          {/* Pass 91 — MJ origin badge (handoff'tan gelen set'ler için). */}
          <MjOriginInlineBadge sourceMetadata={set.sourceMetadata} />
        </div>
      </div>
      {/* Button primitive `asChild` desteklemiyor; semantik link için
          Button class'ları yerine tutarlı bir `Link` + Button-stili kullanmak
          yerine Button'ı sadece görsel rolünden ayırıp direkt anchor ile
          aynı tonu render etmek mockup'a uyar. Burada anchor'a primary
          görünüm vermek için Button styling'ini kopyalamak yerine sadece
          Link yer alır — accent BG + accent-foreground text'i Card içinde
          fazla yüklü olur. Plan: küçük "Aç" link buton tonu primary. */}
      <Link
        href={`/selection/sets/${set.id}`}
        className="inline-flex h-control-md items-center justify-center gap-1.5 rounded-md border border-accent bg-accent px-3.5 text-base font-medium text-accent-foreground transition-colors duration-fast ease-out hover:border-accent-hover hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Open
      </Link>
    </Card>
  );
}

function ReadySetRow({ set }: { set: SelectionSetListItem }) {
  const finalizedLabel = set.finalizedAt
    ? new Date(set.finalizedAt).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <li>
      <Link
        href={`/selection/sets/${set.id}`}
        data-testid="selection-ready-row"
        className="flex items-center gap-3 rounded-md border border-border bg-surface p-3 shadow-card transition-colors duration-fast ease-out hover:border-border-strong hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <SetThumb
          thumbnailUrl={set.thumbnailUrl}
          alt={`${set.name} önizleme`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-medium text-text">
            {set.name}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-text-muted">
              Finalized: {finalizedLabel} · {set.itemCount} items
            </span>
            {/* Pass 91 — MJ origin badge */}
            <MjOriginInlineBadge sourceMetadata={set.sourceMetadata} />
          </div>
        </div>
        <Badge tone="success">Ready</Badge>
      </Link>
    </li>
  );
}
