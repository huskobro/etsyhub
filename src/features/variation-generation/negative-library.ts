// NEGATIVE_LIBRARY (R19) — Phase 5 hardcoded sabit.
//
// Image prompt'larının "Avoid:" satırına enjekte edilen yasaklı terimler.
// Bu liste şu an deliberate olarak hardcoded; Phase 6+ Settings Registry'ye
// taşınacak (admin yönetimi + kullanıcı override). Phase 5'te statik tutmak,
// erken karmaşıklık eklemeden R19 sözleşmesini sağlar.
//
// Spec: docs/plans/2026-04-25-variation-generation-design.md §4.4, §7
export const NEGATIVE_LIBRARY = [
  "Disney",
  "Marvel",
  "Nike",
  "celebrity names",
  "watermark",
  "signature",
  "logo",
] as const;
