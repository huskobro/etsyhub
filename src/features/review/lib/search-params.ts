// Review URL search-params helper.
//
// Canonical params (IA Phase 2 completion):
//   • source   — "ai" | "local" | "midjourney"  (legacy alias: tab)
//   • item     — detail-drawer item id          (legacy alias: detail)
//   • batch    — batch-scoped workspace id      (no legacy alias)
//   • decision — "undecided" | "kept" | "rejected" (no legacy alias)
//   • page     — pagination
//
// Legacy params still parsed by the host page:
//   • tab      — old name for source ("ai" | "local")
//   • detail   — old name for item
//
// Writers go through `buildReviewUrl`. The helper takes a patches object
// and:
//   1. Sets / deletes keys per the patches.
//   2. **Auto-clears the opposing legacy alias** when its canonical
//      counterpart is set (or vice-versa). This prevents URL drift
//      where ?tab=ai and ?source=local end up coexisting after several
//      navigations.
//
// Sözleşme:
//   - patches[key] === undefined ⇒ key deleted.
//   - patches[key] === string    ⇒ key set, opposing alias dropped.
//   - Other keys preserved (page, batch, decision, etc.).
//
// `URLSearchParams` ve `ReadonlyURLSearchParams` (Next.js useSearchParams)
// ikisi de `.toString()` destekliyor; helper iki tipi de kabul eder.

type ReadonlySearchParamsLike = { toString(): string };

/**
 * Pairs of canonical ↔ legacy keys. When one side of the pair is being
 * set on the URL, the other side is removed so the canonical param is
 * always the source of truth.
 */
const ALIAS_PAIRS: ReadonlyArray<readonly [canonical: string, legacy: string]> = [
  ["source", "tab"],
  ["item", "detail"],
];

export function buildReviewUrl(
  pathname: string,
  current: ReadonlySearchParamsLike,
  patches: Record<string, string | undefined>,
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patches)) {
    // Drop both sides of any alias-pair this key participates in. Whether
    // the patch sets or clears the key, the opposing alias should never
    // outlive the operation — otherwise stale `?detail=` lingers after
    // `item: undefined` and the drawer reopens on the next render.
    for (const [canonical, legacy] of ALIAS_PAIRS) {
      if (key === canonical) {
        next.delete(legacy);
      } else if (key === legacy) {
        next.delete(canonical);
      }
    }
    if (value === undefined) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
