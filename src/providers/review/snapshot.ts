/**
 * Provider snapshot string formatı:
 *   "{model}@{YYYY-MM-DD}"
 * Örnek: "gemini-2.5-flash@2026-04-28"
 *
 * Tek kaynak: build/parse helper'larını birden fazla yerde elle yazmamak için
 * bu modül. Schema'daki `reviewProviderSnapshot String?` alanına yazılan
 * format buradan geçer; UI (Task 15 detay panel) okurken yine buradan parse eder.
 *
 * Sessiz fallback YASAK: invalid format ⇒ explicit throw.
 */

/**
 * Sözleşme:
 * - Model id: lowercase, sadece [a-z0-9.-] (provider üreticisi sözleşmesi).
 * - Tarih: YYYY-MM-DD format kontrolü; semantic validation YAPILMAZ
 *   (örn. 2026-13-45 regex'ten geçer; downstream caller validate eder).
 * - UTC günü kullanılır (`toISOString().slice(0, 10)`).
 */
const SNAPSHOT_FORMAT = /^([a-z0-9.-]+)@(\d{4}-\d{2}-\d{2})$/;

export function buildProviderSnapshot(model: string, settingsDate: Date): string {
  if (!model || /\s/.test(model)) {
    throw new Error(`invalid provider model: ${JSON.stringify(model)}`);
  }
  const dateStr = settingsDate.toISOString().slice(0, 10); // YYYY-MM-DD
  return `${model}@${dateStr}`;
}

export type ParsedProviderSnapshot = {
  model: string;
  /** ISO date string YYYY-MM-DD formatında. */
  date: string;
};

export function parseProviderSnapshot(s: string): ParsedProviderSnapshot {
  const m = SNAPSHOT_FORMAT.exec(s);
  if (!m) throw new Error(`invalid provider snapshot: ${JSON.stringify(s)}`);
  return { model: m[1]!, date: m[2]! };
}
