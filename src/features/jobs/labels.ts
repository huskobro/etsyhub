// Pass 40 — Job type/status TR label'ları için tek kaynak. Dashboard
// (RecentJobsCard, Pass 38) ve admin (/admin/jobs, Pass 40) ortak tüketim.
// Pre-Pass 40: dashboard kendi inline map'lerini taşıyordu; admin sayfası
// raw enum gösteriyordu (tutarsızlık).
//
// Sözleşme:
//   - jobTypeLabel(type) → bilinen 21 JobType için TR label, bilinmeyen
//     (forward-compatible) raw fallback. Caller `label === type`
//     karşılaştırması ile bilinmeyen enum'u font-mono render edebilir.
//   - statusLabel(status) → 5 JobStatus için TR (QUEUED/RUNNING/SUCCESS/
//     FAILED/CANCELLED). Bilinmeyen status için raw fallback.
//
// Tüm 21 JobType kapsanır (dashboard Pass 38 sadece 14 sık kullanılanı
// taşıyordu); admin sayfası tüm enum'lara değer döner. Yeni JobType eklendiğinde
// bu dosyaya da eklenmeli — TS Record<JobTypeValue, string> exhaustive değil
// (forward-compat amacıyla string key kabul eder).

export const JOB_STATUS_LABELS = {
  QUEUED: "Sırada",
  RUNNING: "Çalışıyor",
  SUCCESS: "Tamamlandı",
  FAILED: "Başarısız",
  CANCELLED: "İptal",
} as const;

export type JobStatusKey = keyof typeof JOB_STATUS_LABELS;

export function statusLabel(status: string): string {
  return (JOB_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

// Tüm 21 JobType (prisma/schema.prisma JobType enum, Pass 29 + Pass 32 dahil).
// Sık kullanılanlar dashboard'da (Pass 38) yer aldı; admin tüm setini görür.
export const JOB_TYPE_LABELS: Record<string, string> = {
  ASSET_INGEST_FROM_URL: "URL'den asset",
  GENERATE_THUMBNAIL: "Thumbnail",
  BOOKMARK_PREVIEW_METADATA: "Bookmark önizleme",
  SCRAPE_COMPETITOR: "Rakip taraması",
  FETCH_NEW_LISTINGS: "Yeni listing taraması",
  GENERATE_VARIATIONS: "Varyant üretimi",
  REVIEW_DESIGN: "AI kalite review",
  REMOVE_BACKGROUND: "Arka plan silme",
  UPSCALE_IMAGE: "Görsel upscale",
  CREATE_MOCKUP: "Mockup",
  GENERATE_LISTING_COPY: "Listing metin üretimi",
  PUSH_ETSY_DRAFT: "Etsy draft gönderim",
  EXPORT_CLIPART_BUNDLE: "Clipart paket dışa aktarma",
  SIMILARITY_CHECK: "Benzerlik kontrolü",
  TREND_CLUSTER_UPDATE: "Trend kümesi",
  SCAN_LOCAL_FOLDER: "Lokal klasör taraması",
  EXPORT_SELECTION_SET: "Set dışa aktarma",
  SELECTION_EXPORT_CLEANUP: "Set export temizliği",
  MOCKUP_RENDER: "Mockup render",
  MAGIC_ERASER_INPAINT: "Magic Eraser",
  MIDJOURNEY_BRIDGE: "Midjourney köprüsü",
};

export function jobTypeLabel(type: string): string {
  return JOB_TYPE_LABELS[type] ?? type;
}
