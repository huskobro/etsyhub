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
  christmas: { label: "Noel", emoji: "🎄" },
  valentines: { label: "Sevgililer Günü", emoji: "💘" },
  halloween: { label: "Cadılar Bayramı", emoji: "🎃" },
  easter: { label: "Paskalya", emoji: "🐣" },
  mothers_day: { label: "Anneler Günü", emoji: "💐" },
  fathers_day: { label: "Babalar Günü", emoji: "👔" },
  thanksgiving: { label: "Şükran Günü", emoji: "🦃" },
  new_year: { label: "Yeni Yıl", emoji: "🎊" },
  graduation: { label: "Mezuniyet", emoji: "🎓" },
  wedding: { label: "Düğün", emoji: "💒" },
  birthday: { label: "Doğum Günü", emoji: "🎂" },
  nursery: { label: "Bebek Odası", emoji: "🍼" },
};

function prettifyKey(key: string): string {
  return key
    .split(/[_\s-]+/)
    .map((part) =>
      part.length > 0
        ? part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1)
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
      className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
      title={`Sezonsal: ${meta.label}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      <span>{meta.label}</span>
    </span>
  );
}
