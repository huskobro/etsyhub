"use client";

/**
 * Mevsimsel / tatil etiketini kısa pill olarak gösterir.
 *
 * `seasonalTag` backend tarafından normalize edilmiş anahtardır (ör.
 * "christmas", "valentines", "halloween"). UI tarafında Türkçe etikete
 * çevirip pill içinde render ederiz.
 */

type SeasonalMeta = { label: string; emoji: string };

const SEASONAL_MAP: Record<string, SeasonalMeta> = {
  christmas: { label: "Christmas", emoji: "🎄" },
  valentines: { label: "Valentine's Day", emoji: "💘" },
  halloween: { label: "Halloween", emoji: "🎃" },
  easter: { label: "Easter", emoji: "🐣" },
  mothers_day: { label: "Mother's Day", emoji: "💐" },
  fathers_day: { label: "Father's Day", emoji: "👔" },
  thanksgiving: { label: "Thanksgiving", emoji: "🦃" },
  new_year: { label: "New Year", emoji: "🎊" },
  graduation: { label: "Graduation", emoji: "🎓" },
  wedding: { label: "Wedding", emoji: "💒" },
  birthday: { label: "Birthday", emoji: "🎂" },
  nursery: { label: "Nursery", emoji: "🍼" },
};

function prettifyKey(key: string): string {
  return key
    .split(/[_\s-]+/)
    .map((part) =>
      part.length > 0
        ? part.charAt(0).toLocaleUpperCase("en-US") + part.slice(1)
        : part,
    )
    .join(" ");
}

export function SeasonalBadge({ seasonalTag }: { seasonalTag: string | null }) {
  if (!seasonalTag) return null;

  const meta: SeasonalMeta = SEASONAL_MAP[seasonalTag] ?? {
    label: prettifyKey(seasonalTag),
    emoji: "✨",
  };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning"
      title={`Sezonsal: ${meta.label}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      <span>{meta.label}</span>
    </span>
  );
}
