export type ConfirmTone = "destructive" | "warning" | "neutral";

export type ConfirmPresetValue = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
};

export const confirmPresets = {
  archiveBookmark: (title?: string | null): ConfirmPresetValue => ({
    title: "Bookmark'ı arşivle",
    description: title
      ? `"${title}" arşivlenecek. Bookmark İnbox'tan kaldırılır; istediğinde arşivden geri getirebilirsin.`
      : "Bu bookmark arşivlenecek. Bookmark İnbox'tan kaldırılır; istediğinde arşivden geri getirebilirsin.",
    confirmLabel: "Arşivle",
    cancelLabel: "Vazgeç",
    tone: "destructive",
  }),

  archiveBookmarksBulk: (count: number): ConfirmPresetValue => ({
    title: "Seçili bookmark'ları arşivle",
    description: `${count} bookmark arşivlenecek. Bookmark İnbox'tan kaldırılırlar; istediğinde arşivden geri getirebilirsin.`,
    confirmLabel: "Arşivle",
    cancelLabel: "Vazgeç",
    tone: "destructive",
  }),

  archiveReference: (title?: string | null): ConfirmPresetValue => ({
    title: "Referansı arşivle",
    description: title
      ? `"${title}" arşivlenecek. Reference Board'dan kaldırılır; üretime dahil olmaz.`
      : "Bu referans arşivlenecek. Reference Board'dan kaldırılır; üretime dahil olmaz.",
    confirmLabel: "Arşivle",
    cancelLabel: "Vazgeç",
    tone: "destructive",
  }),

  archiveReferencesBulk: (count: number): ConfirmPresetValue => ({
    title: "Seçili referansları arşivle",
    description: `${count} referans arşivlenecek. Reference Board'dan kaldırılırlar; üretime dahil olmazlar.`,
    confirmLabel: "Arşivle",
    cancelLabel: "Vazgeç",
    tone: "destructive",
  }),

  archiveCollection: (name?: string | null): ConfirmPresetValue => ({
    title: "Koleksiyonu arşivle",
    description: name
      ? `"${name}" koleksiyonu arşivlenecek. İçindeki bookmark ve referanslar silinmez; ama bu koleksiyon filtresi altında artık görünmez.`
      : "Bu koleksiyon arşivlenecek. İçindeki bookmark ve referanslar silinmez; ama bu koleksiyon filtresi altında artık görünmez.",
    confirmLabel: "Arşivle",
    cancelLabel: "Vazgeç",
    tone: "destructive",
  }),

  deleteProductType: (name?: string | null): ConfirmPresetValue => ({
    title: "Ürün tipini sil",
    description: name
      ? `"${name}" ürün tipi silinecek. Bu ürün tipine bağlı bookmark/reference kayıtlarının tip bağlantısı boşa düşer.`
      : "Bu ürün tipi silinecek. Bağlı kayıtların tip bağlantısı boşa düşer.",
    confirmLabel: "Sil",
    cancelLabel: "Vazgeç",
    tone: "destructive",
  }),

  changeUserRole: (
    email: string,
    nextRole: "USER" | "ADMIN",
  ): ConfirmPresetValue => ({
    title: "Kullanıcı rolünü değiştir",
    description: `${email} kullanıcısının rolü "${nextRole === "ADMIN" ? "Admin" : "Kullanıcı"}" olarak güncellenecek. Admin rolü sistem genelinde yetki sağlar.`,
    confirmLabel: "Rolü güncelle",
    cancelLabel: "Vazgeç",
    tone: nextRole === "ADMIN" ? "warning" : "destructive",
  }),

  activateTheme: (name?: string | null): ConfirmPresetValue => ({
    title: "Tema değiştir",
    description: name
      ? `Aktif tema "${name}" olarak ayarlanacak. Yeni tema, sonraki sayfa yüklemesinde tüm kullanıcılara uygulanır.`
      : "Aktif tema bu temayla değiştirilecek. Sonraki sayfa yüklemesinde tüm kullanıcılara uygulanır.",
    confirmLabel: "Aktifleştir",
    cancelLabel: "Vazgeç",
    tone: "warning",
  }),

  deleteApiKey: (providerLabel: string): ConfirmPresetValue => ({
    title: "API key'i sil",
    description: `${providerLabel} API key'i silinecek. Bu sağlayıcıyla yapılan işler, başka sağlayıcıya geçilene kadar başarısız olur.`,
    confirmLabel: "Sil",
    cancelLabel: "Vazgeç",
    tone: "destructive",
  }),
};
