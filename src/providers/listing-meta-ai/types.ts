/**
 * ListingMetaAIProvider — Phase 9 V1 Task 5.
 *
 * Provider listing metadata (title/description/tags) üretir. Text-only;
 * image input yok (review provider bunu yapar). KIE/Gemini chat/completions
 * OpenAI-compat endpoint kullanır.
 *
 * V1: tek provider (kie-gemini-flash). İkinci provider eklemek için registry
 * pattern hazır.
 */

export type ListingMetaInput = {
  /** Mockup pack content özeti — provider'a context vermek için. */
  productType: string; // "wall_art" | "clipart" | "sticker" vb.
  /** Mevcut başlık (kullanıcı yazdıysa); boş/null → üret. */
  currentTitle: string | null;
  /** Mevcut açıklama (kullanıcı yazdıysa); kontekst olarak verilir. */
  currentDescription: string | null;
  /** Mevcut tags; tamamlama için. */
  currentTags: string[];
  /** Mevcut category; varsa kontekst olur. */
  category: string | null;
  /** Materials (digital/print). */
  materials: string[];
  /** İsteğe bağlı stil/voice ipucu (Phase 9 V1 default null). */
  toneHint?: string | null;
};

export type ListingMetaOutput = {
  title: string; // 5-140 char Etsy limit
  description: string; // min 50 char V1 hedefi
  tags: string[]; // exactly 13, each ≤20 char
};

export type ListingMetaProviderRunOptions = {
  apiKey: string;
};

export interface ListingMetaAIProvider {
  /** Snapshot kaynak: provider id, örn. "kie-gemini-flash". */
  id: string;
  /** Altta tüketilen gerçek model id (snapshot için), örn. "gemini-2.5-flash". */
  modelId: string;
  /** V1: text-only. Gelecekte vision eklenirse discriminated union. */
  kind: "text";
  generate: (
    input: ListingMetaInput,
    options: ListingMetaProviderRunOptions,
  ) => Promise<ListingMetaOutput>;
}
