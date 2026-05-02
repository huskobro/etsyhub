# Phase 8 Mockup Studio — Manuel QA Checklist

> **Tarih:** 2026-05-02
> **Phase 8 status:** 🟡 (kod-otomasyon gate'leri PASS; manuel QA kullanıcı tarafından adım adım yürütülecek — sonuç bu dosyaya işaretlenecek)
> **Önkoşul:** `npm run dev` (Next.js) + `npm run worker` (BullMQ worker süreci arka planda)
> **Test user:** `admin@etsyhub.local` / `admin12345`
> **Spec referans:** [`../../plans/2026-05-01-phase8-mockup-studio-design.md`](../../plans/2026-05-01-phase8-mockup-studio-design.md) — Section 10.4

Bu doküman Phase 8 v1 closeout'unun **manuel QA katmanı**. Subagent / otomasyon
tarafından yürütülemez (gerçek tarayıcı + screen reader + ZIP extract +
gerçek mockup render testleri gözle değerlendirme gerektirir).

Aşağıdaki bölümleri sırayla geçin, sonuçları her satırın yanındaki kutuya
işaretleyin (`[x]` yapın). Sürpriz bulgu olursa bu dosyaya `## Bulgular —
YYYY-MM-DD` başlığı altında ekleyin; gerekirse Phase 8 closeout doc'a
(`phase8-closeout.md`) drift olarak yansıtın.

---

## A. Quick start entegrasyonu (Selection → Mockup)

> **Hedef:** Phase 7 ready SelectionSet'ten Phase 8 MockupSet'e geçiş atomik
> ve sorunsuz çalışır.

**Hazırlık:** `/selection` index → ready set seçin → "Mockup Studio'da Aç" CTA.

- [ ] "Mockup Studio'da Aç" buton tıklanınca `/mockups/sets/[mockupSetId]` yönlendir.
- [ ] Yeni MockupSet otomatik create olur (tek tx, rollback yok).
- [ ] MockupSet'in tüm item'ları SelectionSet'teki position sırasında eklenir.
- [ ] Studio canvas açılınca ilk item seçili durumda görünür.
- [ ] Sağ panel sourceSelectionSetId kaydı var (read-only metadata).
- [ ] Revert sorgusu yapabilirsin: "Bu item'lar nereden geldi?" — Panel'de görünür.

---

## B. Studio canvas ve grid/carousel UI

> **Hedef:** Canvas preview doğru render; grid/carousel navigation akıcı.

**Hazırlık:** `/mockups/sets/[mockupSetId]` açık, draft MockupSet, en az 3–5 item.

- [ ] Canvas alanında (sol/merkez) aktif item'ın mockup preview büyük render olur.
- [ ] Grid/carousel (sağ taraf veya alt) item thumbnail'leri gösterilir, tıklama item seçimini değiştirir.
- [ ] Aktif item'da highlight border/accent görünür (grid'de ve canvas'ta).
- [ ] Tab order: canvas → grid/carousel item'ları → sağ panel → top bar. Keyboard nav çalışır.
- [ ] Responsive breakpoint test (desktop 1920px, 1280px, 1024px) — grid/carousel kaydırma doğru.

---

## C. Mockup render kalitesi (4 mod testi)

> **Hedef:** Tüm 4 mode'da mockup render sorunsuz; provider (Dynamic Mockups)
> başarılı response dönüyor.

**Hazırlık:** Her mod için 1 test item seçili. API key ayarlar gözle ayarlanmış.

- [ ] **Canvas/Wall Art modunda:**
  - [ ] Template dropdown gösterilir (frame seçenekleri: Natural Light, Dark, White, Warm).
  - [ ] Template seçimi anında canvas preview update olur (~1–2s).
  - [ ] Preview render başında "Mockup hazırlanıyor..." loading state görünür.
  - [ ] Tamamlanınca bozuk/sıfır pixel olmayan gerçek mockup görseli çıkar.
  - [ ] Canvas oranında (2:3 / 4:5 / 1:1) mockup görseli tutorial dönüşsüz display.

- [ ] **Poster/Printable modunda:**
  - [ ] Size dropdown (A4, Letter, Custom).
  - [ ] Custom size giriş alanı (custom seçilince active).
  - [ ] Finish dropdown (Matte, Glossy).
  - [ ] Template seçimi ve render workflow Canvas ile aynı.

- [ ] **Product Mockup modunda:**
  - [ ] Ürün tipi dropdown (t-shirt, hoodie, DTF).
  - [ ] Size/Color option (S/M/L/XL, Siyah/Beyaz/Gri).
  - [ ] Mockup render t-shirt/hoodie üzerine image aplike gösterilir.
  - [ ] Renk değiştirme anında preview update.

- [ ] **Clipart Bundle modunda:**
  - [ ] Cover design upload/select.
  - [ ] Sheet preview (sticker bundle 6–12 item layout).
  - [ ] Bundle mockup bilgi paneli (dosya sayısı, toplam size tahmin).

---

## D. AI style variant (prompt-template tabanlı)

> **Hedef:** "AI stil varyasyonu oluştur" workflow akışkan; yeni tasarım item
> olarak eklenir; kalite tutarlı.

**Hazırlık:** Studio canvas açık, draft set, 1 item seçili. Worker ayakta.

- [ ] Sağ panel "AI Stil Varyasyonu" bölümü görünür (hidden/disabled değil).
- [ ] Dropdown: hazır template'ler (Minimalist, Boho, Modern, vb.).
- [ ] Template seçip "Oluştur" tıklanınca spinner başlar; "AI Tasarım hazırlanıyor..." 5–20s.
- [ ] Tamamlanınca yeni item grid'e eklenir (sonunda, otomatik scroll).
- [ ] Yeni item'da `styleVariant` metadata (template adı + variant details) okunabilir.
- [ ] EditHistory'de "AI Stil Varyasyonu — Minimalist — az önce" entry görünür.
- [ ] Yeni item'a mockup render hemen tetiklenir (template seçimi inherit, otomatik).
- [ ] Batch variant generation (seç 3 item → "Tüm seçilenlere stil uygula" → 3×3=9 yeni item).

---

## E. Multi-mockup batch application

> **Hedef:** Bir reference'dan 3 farklı mockup mode/template'i seçilip hepsi
> consistent olarak batch'e uygulanabilir.

**Hazırlık:** Drawer'dan 1 reference batch item seçim. Studio'da 2 mode template
hazır (Canvas + Poster).

- [ ] Drawer item seçim → "3 template'e ekle" buton tıkla.
- [ ] Modal: Canvas (Frame Natural Light), Poster (A4 Matte), Product (T-shirt Black) seç.
- [ ] "Ekle" → 3 yeni item hızla grid'e eklenir.
- [ ] Tüm 3 item'a otomatik mockup render tetiklenir.
- [ ] Tamamlanınca 3 farklı mockup preview yan yana görünür.
- [ ] Consistency: aynı selection asset farklı mode'larda, template'lerde mantıklı apply.

---

## F. Edit ve versioning (selection-to-mockup migration)

> **Hedef:** Phase 7 edit history pattern'i Phase 8'de korunur; mockup-spesifik
> parametre'ler de audit edilir.

**Hazırlık:** Studio, draft set, edit yapılabilir item.

- [ ] Template değişikliği → editHistory "Template: frame-dark — az önce" entry.
- [ ] Overlay param (scale 0.9 → 1.0) → editHistory "Scale 1.0 — az önce".
- [ ] Edit undo/reset: "Orijinale döndür" tümü reset'ler (template + overlay).
- [ ] Tekli undo (opsiyonel, carry-forward'ta) Phase 8 v1'de yok (MVP).
- [ ] EditHistory panel'de 5–6 son edit görünür; scroll ile eski görmek mümkün.

---

## G. Reorder erişilebilirlik (VoiceOver / NVDA / keyboard-only)

> **Hedef:** Phase 7 emsali — menu/button reorder a11y-default-garantili.

**Hazırlık:** Grid'de 4+ item. Keyboard + screen reader hazır.

- [ ] Grid item'ı `Tab` tuşuyla odaklanabilir (focus ring görünür).
- [ ] Kebap menü trigger'ı klavye `Enter` ile açılır.
- [ ] Menu açıkken `Arrow` tuşlarıyla "Sola taşı" / "Sağa taşı" / "Başa al" / "Sona al" gezilir.
- [ ] `Enter` ile aksiyon tetiklenir.
- [ ] Hareket sonrası screen reader (VoiceOver / NVDA) anonsu okur — örn. *"Mockup 1 başa taşındı."*.
- [ ] `Escape` menüyü kapatır + odak trigger'a geri döner.
- [ ] Ready set'te reorder kebap menü görünmez/disabled.

---

## H. Finalize workflow ve item status freezing

> **Hedef:** Finalize gate (approved ≥ 1), item status donması, read-only geçiş.

**Hazırlık:** Draft set, 3 item (1 pending, 1 approved, 1 rejected). Finalize butonu.

- [ ] Hiç approved item yoksa Finalize disabled (tooltip "En az 1 onaylanmış item gerekli").
- [ ] 1 item "Onayla" → Finalize aktif.
- [ ] Finalize tıkla → Modal: "X Onaylandı / Y Beklemede / Z Reddedildi" breakdown.
- [ ] "Tamamla" → Set `ready` state'ine geçer, item status'ları freeze.
- [ ] Tamamlanınca canvas disabler (edit/reorder/template change greyed out).
- [ ] Edit buton disabled + tooltip "Ready set'te düzenle yapılmaz".
- [ ] Drawer item ekleme disabled.
- [ ] Archive aksiyonu hâlâ çalışır (opsiyonel cleanup).

---

## I. Export ZIP ve manifest schema v2

> **Hedef:** Phase 7 emsali + v2 schema (backward-compat v1 helper'lar).

**Hazırlık:** Ready MockupSet, 2–5 item, "İndir" butonu aktif.

- [ ] "İndir (ZIP)" tıkla → "Export hazırlanıyor..." spinner (3sn polling).
- [ ] Tamamlanınca "İndir" link primary aktif.
- [ ] İndirilen `.zip` başarıyla açılır.
- [ ] Klasör yapısı:
  - [ ] `mockups/` (her item için JPG/PNG)
  - [ ] `sources/` (seçim asset'leri, orijinal SelectionSet)
  - [ ] `manifest.json`
  - [ ] `listing-draft.md`
  - [ ] `README.txt`
- [ ] `manifest.json`:
  - [ ] Valid JSON.
  - [ ] `schemaVersion: "2"`.
  - [ ] `mockupSet.setId`, `createdAt`, `items[]`.
  - [ ] Her item: `position`, `filename`, `status`, `mockupMode`, `templateId`, `sourceSelectionSetId`.
  - [ ] Optional `styleVariant` (AI variant işlemi yapıldıysa).
- [ ] `listing-draft.md`:
  - [ ] Türkçe metin.
  - [ ] Readiness checklist (mockup count, approved rate, template diversity vb.).
  - [ ] SEO hints (keyword suggestions, description template).
  - [ ] Phase 9 disclaimer ("Bu draft Listing Builder'a aktarılabilir").
- [ ] `README.txt` Türkçe + Mockup Studio → Listing Builder handoff notu.

---

## J. Listing readiness checklist

> **Hedef:** Otomatik checklist; approved rate, template coverage, image kalitesi
> check'leri görünür.

**Hazırlık:** Ready MockupSet, finalize sonrası.

- [ ] Sağ panel / modal'da "Hazırlık Durumu" card'ı görünür.
- [ ] Checkmark item'lar (dinamik):
  - [ ] "3+ mockup onaylandı" (approved count ≥ 3).
  - [ ] "Minimum 2 template mode'da" (canvas + poster gibi diversity).
  - [ ] "Tüm mockup render'lar başarılı" (render error yok).
  - [ ] "Orijinal selection asset'leri kaydedildi" (source tracking).
  - [ ] "ZIP export ready" (manifest + files tamam).
- [ ] **Not ready** item'lar (gri / disabled):
  - [ ] "< 3 onaylandı" → "X/3 onaylandı — 3+ gerekli".
  - [ ] "1 mod'dan az" → "Yalnız Canvas — 2+ mod gerekli".
  - [ ] "Render hata'lar var" → "3 item render başarısız — düzeltme gerekli".
- [ ] Ready state'te checklist read-only (edit yok).

---

## K. Notification + inline feedback senkronizasyonu

> **Hedef:** Page-level Toast + buton-içi feedback tutarlı; Phase 7 emsali.

**Hazırlık:** Draft set, edit/render yapılacak.

- [ ] Heavy render (mockup template change) tetikle → button "Hazırlanıyor..." + spinner (toast yok).
- [ ] Tamamlanınca → button reset + Toast "Mockup render tamamlandı" (5sn auto).
- [ ] Failure (provider error veya timeout): button "Tekrar dene" + Toast "Mockup render başarısız: <reason>" alert tone.
- [ ] Export tetikle → button "Export hazırlanıyor..." + 3sn polling.
- [ ] Tamamlanınca → "İndir" button + Toast "Export ready".
- [ ] Multi-toast: 2–3 toast üst üste → her biri 5sn'de auto-dismiss.
- [ ] Toast click-to-dismiss çalışır.

---

## L. Cross-browser smoke (Chrome + Safari minimum)

> **Hedef:** Desktop-first; Safari CSS render doğru, animation pürüzsüz.

**Hazırlık:** Aynı test user'la iki browser açık.

- [ ] **Chrome (latest):**
  - [ ] A–K bölümlerinin tümü çalışır.
  - [ ] Canvas preview şarp, grid thumbnail'ler temiz.
  - [ ] Console error yok.

- [ ] **Safari (latest macOS):**
  - [ ] Grid layout (CSS Grid, `grid-cols-3` Tailwind) doğru render.
  - [ ] Canvas aspect ratio CSS (`aspect-ratio: 2/3`) Safari'de Chrome ile identical.
  - [ ] Drawer slide animation pürüzsüz (transform/opacity).
  - [ ] Toast position `fixed` bottom-right doğru.
  - [ ] Focus management (menu open/close) Safari'de bozulmaz.

---

## M. Bilinçli kapalı affordance'lar (ürün kararı — NOT bug)

> **Hedef:** Phase 8 v1'de gizlenmiş affordance'lar **bug değildir**. Manuel QA
> bunların gerçekten gizli/disabled kaldığını doğrular.

- [ ] **Drag-and-drop reorder yok:** Grid item'ı sürüklenmez (cursor `grab` icon yok); reorder yalnız menu/button.
- [ ] **Set rename yok:** Set adı sabit (oluşturma anında verilen); edit disableddir.
- [ ] **Archived set browsing UX yok:** `/mockups` index'te yalnız draft + ready; archived filtre yok.
- [ ] **Custom mockup template upload yok:** Yalnız hazır Dynamic Mockups template'leri; custom upload carry-forward.
- [ ] **Provider fallback UI yok:** API başarısız → hata mesajı (fallback provider UI gösterilmiyor, fallback backend'de çalışıyor ama UI decision yok).

---

## N. Önemli ayrım — bug vs ürün-kararı vs BLOCKED

| Kategori | Tanım | Örnek |
|----------|-------|-------|
| **Bug** | Spec'te söz verilen davranış çalışmıyor | Reorder menu keyboard nav çalışmıyor |
| **Bilinçli kapalı (M)** | Ürün kararı — Phase 8 v1 dışı | Drag-reorder gizli |
| **Carry-forward** | İleride yapılacak (closeout doc'da listelenir) | Custom template upload |

Bug bulduysanız → Phase 8 closeout doc'a drift olarak ekleyin.
Bilinçli kapalı affordance'ı yanlış sandıysanız → bu doc'un M bölümüne bakın.

---

## Bulgular — YYYY-MM-DD

> Manuel QA sonrası bu bölümü doldurun. Beklenmedik bulgu yoksa "Tüm
> kontroller geçti, bug bulunmadı" yazın.

(Boş — kullanıcı dolduracak)
