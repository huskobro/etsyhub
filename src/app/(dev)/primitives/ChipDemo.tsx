"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";

/**
 * Chip demo — client component. Toggle + remove davranışlarını canlı göster.
 * Primitives showcase sayfasında Chip matrisi olarak kullanılır.
 */

const FILTERS = [
  "Wall art",
  "Clipart bundle",
  "Sticker set",
  "Nursery",
  "Boho",
  "Christmas",
] as const;

const TAGS = ["Halloween", "Black & white", "Minimal", "Pastel"] as const;

export function ChipFilterDemo() {
  const [active, setActive] = useState<string[]>(["Wall art", "Nursery"]);
  const toggle = (key: string) =>
    setActive((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {FILTERS.map((label) => (
        <Chip
          key={label}
          active={active.includes(label)}
          onToggle={() => toggle(label)}
        >
          {label}
        </Chip>
      ))}
      <Chip disabled>Disabled</Chip>
    </div>
  );
}

export function ChipRemovableDemo() {
  const [tags, setTags] = useState<string[]>([...TAGS]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <Chip
          key={tag}
          active
          onToggle={() => void 0}
          onRemove={() => setTags((prev) => prev.filter((t) => t !== tag))}
        >
          {tag}
        </Chip>
      ))}
      {tags.length === 0 ? (
        <button
          type="button"
          onClick={() => setTags([...TAGS])}
          className="font-mono text-xs text-text-muted underline-offset-2 hover:underline"
        >
          resetle
        </button>
      ) : null}
    </div>
  );
}
