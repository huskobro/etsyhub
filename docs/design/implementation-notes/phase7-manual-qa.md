# Phase 7 Selection Studio — Manuel QA Checklist

> **Tarih:** 2026-04-30
> **Phase 7 status:** 🟢 (kod-otomasyon gate'leri PASS; manuel QA kullanıcı tarafından adım adım yürütülecek — sonuç bu dosyaya işaretlenecek)
> **Önkoşul:** `npm run dev` (Next.js) + `npm run worker` (BullMQ worker süreci arka planda)
> **Test user:** `admin@etsyhub.local` / `admin12345`
> **Spec referans:** [`../../plans/2026-04-30-phase7-selection-studio-design.md`](../../plans/2026-04-30-phase7-selection-studio-design.md) — Section 10.4

Bu doküman Phase 7 v1 closeout'unun **manuel QA katmanı**. Subagent / otomasyon
tarafından yürütülemez (gerçek tarayıcı + screen reader + ZIP extract +
gerçek `@imgly/background-removal-node` çıktısı gözle değerlendirme gerektirir).

Aşağıdaki bölümleri sırayla geçin, sonuçları her satırın yanındaki kutuya
işaretleyin (`[x]` yapın). Sürpriz bulgu olursa bu dosyaya `## Bulgular —
YYYY-MM-DD` başlığı altında ekleyin; gerekirse Phase 7 closeout doc'a
(`phase7-selection-studio.md`) drift olarak yansıtın.

---

## A. Reorder erişilebilirlik (VoiceOver / NVDA / keyboard-only)

> **Hedef:** Phase 7 v1'de drag-and-drop YOK (bilinçli ürün kararı, carry-forward
> `selection-studio-drag-reorder`). Reorder yalnız kebap menü / butonlarla
> yapılır ve a11y-default-garantili olmalı.

**Hazırlık:** `/selection` index → "Yeni set oluştur" → en az 4 item ekle
(drawer'dan Reference batch). Studio canvas filmstrip'inde 4 item görünüyor
olmalı.

- [ ] Filmstrip item'ı klavye `Tab` tuşuyla odaklanabilir (focus ring görünür).
- [ ] Item üzerindeki kebap menü trigger'ı klavye `Enter` ile açılır.
- [ ] Menu açıkken `Tab` veya `Arrow` tuşlarıyla menü item'ları arasında gezilir.
- [ ] `Enter` ile "Sola taşı" / "Sağa taşı" / "Başa al" / "Sona al"
      eylemlerinden biri tetiklenir.
- [ ] Hareket sonrası screen reader (VoiceOver: `Cmd+F5` / NVDA: `Insert+N`)
      anonsu okur — örn. *"Varyant 1 başa taşındı. Yeni sıra: 1."*.
      (`aria-live="polite"` veya benzer status region beklenir.)
- [ ] `Escape` tuşu menüyü kapatır + odak menü trigger butonuna geri döner.
- [ ] **İlk item'da** "Sola taşı" / "Başa al" disabled gözükür ve klavye
      odağı bu item'a gelse bile aksiyon tetiklenmez (veya menü item
      `aria-disabled="true"` olur).
- [ ] **Son item'da** "Sağa taşı" / "Sona al" disabled.
- [ ] **Read-only set'te** (`status: ready` finalize sonrası) reorder kebap
      menü trigger'ı **görünür DEĞİL** (veya disabled — ürün kararı:
      görünmez tercih edildi). Finalize sonrası canvas'ta deneyin.

---

## B. Background remove görsel kalitesi (manuel sample test)

> **Hedef:** Phase 7 v1'de `@imgly/background-removal-node` gerçek model ile
> koşulur. Worker ayakta olmalı; mock yalnız test ortamında.

**Hazırlık:** Worker süreci ayakta (`npm run worker`). Studio canvas'ta
preview olarak bg-remove tetiklenecek item seçili.

- [ ] **Saç edge case:** Insan portresi PNG (saç detayı görünür) → "Background
      Remove" → 5–15s içinde tamamlandı, saç kenarları belirgin halo /
      stair-step artifact yok.
- [ ] **Low-contrast bg:** Gri arka plan + gri obje fixture → bg-remove
      sonrası obje kenarı ile bg ayrımı doğru (yanlış-pozitif segmentasyon yok).
- [ ] **Transparent / yarı-saydam obje** (cam, su, ışık efekti): bg-remove
      objenin saydam bölgelerini bg sanıp silmiyor (alfa blend mantıklı).
- [ ] Job tamamlanma süresi 5–15s aralığında (manuel ölç — worker log
      `EDIT_BACKGROUND_REMOVE` start/finish timestamp).
- [ ] Output asset PNG, alpha kanalı doğru (Preview > Get Info / `file <path>`
      ile RGBA olduğunu doğrula).
- [ ] HeavyActionButton tetiklendikten sonra "İşleniyor (~5–15s)" hint
      buton içinde görünür ve job süresince kalır.
- [ ] Tamamlanınca preview otomatik refresh (yeni asset URL React Query
      invalidation ile yüklenir, manuel `F5` gerekmez).
- [ ] Notification toast "Background remove tamamlandı" görünür ve 5sn
      sonra otomatik kaybolur.
- [ ] **Failure path** (büyük asset >50MB → AssetTooLargeError veya
      worker tarafında manuel fail simulasyonu): inline error + "Tekrar dene"
      butonu görünür, toast `role="alert"` ile `Background remove başarısız:
      <reason>`.

---

## C. Export ZIP gerçek extract testi

> **Hedef:** Phase 7 v1 manifest schema v1 contract test'lerle korunur.
> Manuel test: gerçek ZIP açılıp klasör yapısı + manifest + README gözden
> geçirilir.

**Hazırlık:** Studio'da set finalize edilmiş (`status: ready`). 2–5 item
karışık (en az 1 edit yapılmış + 1 hiç edit yapılmamış). "İndir (ZIP)" butonu
aktif.

- [ ] "İndir (ZIP)" tıkla → ExportButton "Export hazırlanıyor..." gösterir
      → polling 3sn aralıklarla → "İndir" link aktif olur.
- [ ] Indirilen `.zip` dosyası başarıyla açılır (`unzip <file.zip>` veya
      Finder/Explorer çift tıkla).
- [ ] Klasör yapısı:
      - [ ] `images/` (her item için bir PNG)
      - [ ] `originals/` (yalnız edit yapılmış item'lar için orijinal asset)
      - [ ] `manifest.json` (root)
      - [ ] `README.txt` (root)
- [ ] `images/var-NNN.png` her item için var (NNN sıralı 3-haneli, position
      sırasında).
- [ ] `originals/var-NNN.png` yalnız edit yapılmış item için var (edit
      yapılmamış item'larda dosya YOK — set'in 2 item'ından yalnız 1'inde
      original beklenir).
- [ ] `manifest.json`:
      - [ ] Valid JSON (parse hatasız).
      - [ ] `schemaVersion: "1"` field var.
      - [ ] `exportedBy.userId` set edilmiş (test user ID'si).
      - [ ] `items[]` dolu, her item'da `position`, `filename`,
            `originalFilename` (varsa edit yapıldıysa), `status`
            (`pending`/`selected`/`rejected`).
      - [ ] `review` alanı opsiyonel (Phase 6 review verisi varsa item'da
            `score` + `riskFlags[]` görünür).
- [ ] `README.txt` Türkçe, 10–15 satır, Phase 8 disclaimer içerir
      ("Bu set Mockup Studio'ya hazırdır" gibi).
- [ ] `images/*.png` ve `originals/*.png` dosyaları gerçek görsel olarak
      açılır, bozuk/sıfır byte değil.

---

## D. Notification + inline feedback senkronizasyonu

> **Hedef:** Page-level Toast notification + buton-içi inline feedback
> tutarlı çalışır; bir kanal diğerinin yerini almaz, ikisi tamamlayıcı.

**Hazırlık:** Studio canvas, draft set, edit yapılabilir bir item.

- [ ] Heavy edit (background-remove) tetikle → button içinde spinner +
      "İşleniyor..." inline; **aynı anda** toast yok (yalnız tamamlanma
      anında toast).
- [ ] Tamamlanınca → button reset (eski label döner) + Toast "Background
      remove tamamlandı" (5sn auto-dismiss).
- [ ] Failure simulasyonu (worker tarafında manuel fail / büyük asset
      upload): inline button "Tekrar dene" durumuna geçer + Toast
      "Background remove başarısız: <reason>" `role="alert"`.
- [ ] Export tetikle (`İndir (ZIP)`) → ExportButton "Export hazırlanıyor..."
      inline + 3sn polling.
- [ ] Tamamlanınca → "İndir" link inline + Toast "Export hazır —
      indirebilirsiniz".
- [ ] Failure: ExportButton "Tekrar dene" inline + Toast "Export başarısız:
      <reason>".
- [ ] **Multi-toast stack:** 2–3 toast üst üste görünür (bottom-right
      konumda; en yeni üstte; her biri 5sn'de auto-dismiss).
- [ ] Toast click → manuel dismiss çalışır.
- [ ] Sayfa terk + dön: toast state kaybolur (page-level Zustand store
      kasıtlı sayfa-bazlı; **bu beklenen davranış**, bug değil).

---

## E. Cross-browser smoke

> **Hedef:** Chrome + Safari minimum. Phase 7 v1 desktop-first; mobile
> responsive carry-forward.

**Hazırlık:** Aynı test user'la iki browser açık.

- [ ] **Chrome (latest):** A–D bölümlerinin tümü çalışır, görseller bozuk
      değil, console error yok.
- [ ] **Safari (latest macOS):**
  - [ ] Filmstrip `aspect-ratio: portrait` CSS doğru render (3:4 / 4:5
        ratio).
  - [ ] Drawer slide-in animation pürüzsüz (transform/opacity transitions).
  - [ ] Toast position `fixed` bottom-right doğru.
  - [ ] Studio shell grid `grid-cols-[1fr_320px]` Safari'de Chrome ile
        identical render.
  - [ ] Reorder menu açma/kapama state'i Safari focus management ile
        bozulmaz.
- [ ] (Opsiyonel) Firefox spot-check / Chrome Android responsive — kritik
      değil, manuel QA scope dışı.

---

## F. Bilinçli kapalı affordance'lar (ürün kararı — NOT bug)

> **Hedef:** Phase 7 v1'de gizlenmiş veya disabled olan affordance'lar **bug
> değildir**, ürün kararıdır. Manuel QA bunların gerçekten gizli/disabled
> kaldığını doğrular (sürprizden kaynaklı sızıntı varsa drift sayılır).

- [ ] **Edit prompt section yok:** Sağ panel'de "Edit prompt / Edit uygula"
      bölümü görünmez (mockup'ta var ama Phase 7 v1'de honesty disiplini
      gereği komple gizli; placeholder yok).
- [ ] **Upscale 2× disabled:** Sağ panel'de "Upscale 2×" buton görünür
      ama `disabled` + "Yakında" badge.
- [ ] **Drag-and-drop reorder yok:** Filmstrip item'ı sürüklenmez (cursor
      `grab` icon görünmez); reorder yalnız menu/button.
- [ ] **Set rename yok:** Set name değiştirilemez (Phase 7 v1'de set
      oluşturma anında verilen ad sabit).
- [ ] **Archived set browsing UX yok:** `/selection` index'te yalnız draft
      + ready listeleri görünür; archived set listesi/filtre yok (state
      machine `archived` kapısı doğru kurulu, ama browsing UX dışı).
- [ ] **Drawer Review Queue tab disabled:** AddVariantsDrawer'da "Review
      Queue" sekmesi görünür ama disabled (Phase 6 canlı smoke gating —
      drift #6 + KIE flaky).
- [ ] **AI Kalite paneli "Review'a gönder" link disabled:** Review verisi
      varsa read-only gösterilir; "Review'a gönder" link disabled (aynı
      Phase 6 smoke gating).

---

## Önemli ayrım — bug vs ürün-kararı vs BLOCKED

| Kategori | Tanım | Örnek |
|----------|-------|-------|
| **Bug** | Spec'te söz verilen davranış çalışmıyor | Reorder klavye anonsu okumuyor |
| **Bilinçli kapalı (F)** | Ürün kararı — Phase 7 v1 dışı | Edit prompt gizli |
| **BLOCKED işler** | Phase 6 canlı smoke kapanınca açılacak (drift #6 + KIE flaky kaynaklı) | Review Queue tab disabled |
| **Carry-forward** | İleride yapılacak (closeout doc'da listelenir) | Drag-reorder, set rename, archived browsing |

Bug bulduysanız → Phase 7 closeout doc'a drift olarak ekleyin.
Bilinçli kapalı affordance'ı yanlış sandıysanız → bu doc'un F bölümüne bakın.
BLOCKED işleri → Phase 6 mini-tur kapanınca açılacak; Phase 7 closeout doc
"BLOCKED işler" listesindeler.

---

## Bulgular — YYYY-MM-DD

> Manuel QA sonrası bu bölümü doldurun. Beklenmedik bulgu yoksa "Tüm
> kontroller geçti, bug bulunmadı" yazın.

(Boş — kullanıcı dolduracak)
