// Phase 6 Dalga B (Task 15) — Review URL search params helper.
//
// Review yüzeyinde URL state üç eksende yönetilir:
//   - tab    (ai | local)
//   - page   (pagination)
//   - detail (drawer açma — kart click ile aktif olur)
//
// Helper, mevcut diğer query param'ları (örn. status filter veya gelecekte
// eklenecek koleksiyon filtresi) silmemek için tek noktadan yönetim sağlar.
// Tab değişimi, pagination, detay panel açma/kapama bu helper'dan geçer.
//
// Sözleşme:
//   - patches içinde value === undefined ⇒ key silinir.
//   - value === string ⇒ key set edilir (mevcut değer override).
//   - Ortaya çıkan querystring boşsa pathname tek başına döner (örn.
//     /review). Aksi halde `${pathname}?${qs}`.
//
// `URLSearchParams` ve `ReadonlyURLSearchParams` (Next.js useSearchParams)
// ikisi de `.toString()` destekliyor; helper iki tipi de kabul eder.

type ReadonlySearchParamsLike = { toString(): string };

export function buildReviewUrl(
  pathname: string,
  current: ReadonlySearchParamsLike,
  patches: Record<string, string | undefined>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patches)) {
    if (value === undefined) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
