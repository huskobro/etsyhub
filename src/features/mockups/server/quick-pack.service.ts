/**
 * Phase 8 Task 13 — Quick Pack default selection algoritması.
 *
 * Spec §2.6: kullanıcı set'i + aktif template'lere bakarak deterministik
 * 6 template (vibe diversity + lex tie-break) seçer. Frontend bu fonksiyonu
 * URL state hook'unda (Task 14 useMockupPackState) `defaultTemplateIds`
 * türetmek için kullanır.
 *
 * K5 disiplini: iterasyon öncesi `id` ASC stable sort → aynı input → aynı
 * output. Deterministic.
 *
 * Note: pure function — DB call yok, network yok. Frontend client-side
 * veya server-side aynı şekilde çağrılabilir.
 */

/**
 * V1 vibe taxonomy (Spec §2.6 + §9 V1 envanter).
 *
 * 6 vibe = 6 template hedef. Her template'in tags array'inde en az 1 vibe
 * tag'i bulunur. Vibe diversity disiplini: her unique vibe en az 1 template
 * ile temsil edilsin.
 *
 * Sıra önemli mi? Hayır — kod compatible.find(tag => VIBE_TAGS.includes(tag))
 * kullanıyor, VIBE_TAGS array order'ı match'lemeyi etkilemiyor. Ama
 * dokümantasyon için sıralı (Spec §9 envanter sırası).
 */
const VIBE_TAGS = [
  "modern",
  "scandinavian",
  "boho",
  "minimalist",
  "vintage",
  "playful",
] as const;

export type QuickPackInput = {
  set: { variants: { aspectRatio: string }[] };
  allActiveTemplates: { id: string; aspectRatios: string[]; tags: string[] }[];
  targetSize?: number;
};

/**
 * Spec §2.6 algoritması.
 *
 * @param input.set.variants Variant'ların aspectRatio bilgisi (Spec §1.4
 *                            fallback chain ile resolve edilmiş)
 * @param input.allActiveTemplates Aktif template'lerin id + aspectRatios
 *                                  + tags
 * @param input.targetSize Default 6 (Spec §2.6); test edge case'ler için
 *                          override edilebilir
 * @returns Seçilmiş template id'leri (sıralı; cover/diversity rolü
 *          buildPackSelection (Task 8) tarafından atanır)
 */
export function selectQuickPackDefault(input: QuickPackInput): string[] {
  const { set, allActiveTemplates } = input;
  const targetSize = input.targetSize ?? 6;

  // 1. Aspect compatibility filter + deterministik sort (K5 disiplini)
  const setAspects = new Set(set.variants.map((v) => v.aspectRatio));
  const compatible = allActiveTemplates
    .filter((t) => t.aspectRatios.some((ar) => setAspects.has(ar)))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (compatible.length === 0) {
    return [];
  }

  // 2. Vibe diversity ranking
  const result: string[] = [];
  const usedVibes = new Set<string>();

  // 2a. Her unique vibe için 1 template
  for (const t of compatible) {
    if (result.length >= targetSize) break;
    const newVibe = t.tags.find(
      (tag) => (VIBE_TAGS as readonly string[]).includes(tag) && !usedVibes.has(tag),
    );
    if (newVibe) {
      result.push(t.id);
      usedVibes.add(newVibe);
    }
  }

  // 2b. targetSize'a ulaşmadıysa lex order kalan'larla doldur
  if (result.length < targetSize) {
    const remaining = compatible.filter((t) => !result.includes(t.id));
    for (const t of remaining) {
      if (result.length >= targetSize) break;
      result.push(t.id);
    }
  }

  return result;
}
