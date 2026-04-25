# CP-9 — Selection Studio + Mockup Studio Dürüstlük Kararı

**Tarih:** 2026-04-25
**Bağlam:** CP-9 dalgası iki alt-dalgaya bölündü (CP-9A Selection Studio,
CP-9B Mockup Studio). Önceki dalgalar (CP-7/CP-8) **mevcut UI'yi primitive
ailesine migre etti**. CP-9 farklı bir iş: **henüz UI'sı olmayan iki
yüzey**. Bu nedenle önce backend tabanı ölçüldü, ardından "bugün
dürüstçe ne kurulabilir" sorusu yanıtlandı.
**Status:** Kilitli.

**Wave kuralları (CP-9 ortak):**
- Mock data ile ürün davranışı simüle edilmez
- Fake filmstrip / fake render queue / fake progress YASAK
- Yeni primitive YASAK (Toggle kuralı — 3 tüketim öncesi terfi yok)
- Backend (prisma / API / worker / provider) DOKUNULMAZ
- "Dürüst yüzey" kuralı: ekran ne kadarını dürüstçe gösterebiliyorsa o
  kadar ekran açılır. Görsel zenginlik için sahte üretim hissi YARATILMAZ.
- Karar dokümanı kod ÖNCESİ kilitlenir

## 1. Selection Studio bugün hangi gerçek veriyle açılabilir?

### Mevcut taban (ölçüm)

Prisma:
- `GeneratedDesign` modeli **var** (id, userId, referenceId, assetId,
  productTypeId, qualityScore, reviewStatus, reviewIssues, reviewSummary,
  textDetected, gibberishDetected, riskFlags, reviewedAt)
- `DesignReview` modeli **var** (1:1 GeneratedDesign üzerinde)

Çevre:
- `src/app/api/designs/...` route **YOK**
- `src/server/workers/generate-variations.worker.ts` **YOK**
- `src/server/workers/review-design.worker.ts` **YOK**
- `src/providers/ai/index.ts` `NotImplementedAI` — `generate()` çağrısı
  `Error("AI provider Phase 5'te aktifleşir")` fırlatır
- `src/features/selection-studio/` **YOK**, `/app/(app)/selection-studio`
  route **YOK**

Veritabanı pratiği:
- `GeneratedDesign` tablosu **boş** (üretim yolu olmadığı için satır
  oluşamaz)
- `DesignReview` tablosu **boş**

### Bugün ne dürüstçe yapılabilir?

**Cevap: Selection Studio'nun MVP yüzeyi — read-only "tasarım listesi
+ kalite filtreleri" — ancak üretim olmadığı için tablo boş kalır.**

Yani bugün açılırsa kullanıcı her zaman empty-state görür. Bu, "dürüst
yüzey" kuralıyla karşı karşıya. İki alt-soru:

1. **Boş bir liste ekranı kurmak dürüst müdür?**
   - Evet, eğer empty mesajı **niye** boş olduğunu açıkça söylüyorsa.
   - "Henüz tasarım yok. Variation Generation aktifleştiğinde (Phase 5)
     burada görünür" gibi.
   - Bu doğru durum: kullanıcı yan menüden Selection Studio'ya tıklar,
     ekranın varlığını öğrenir, beklentiyi anlar.
   - Sahte değil — durum dürüstçe iletilir.

2. **Buna değer mi?**
   - Soru: ekranı kurmadan da kullanıcı için bir maliyet var mı?
   - **Yan menüde link yok.** Selection Studio bugün sidebar'da değil
     (CP-9 öncesi audit). Yani route da link de yok → kullanıcı zaten
     bilmiyor.
   - Ekran kurmak = navigasyon eklemek = empty state göstermek =
     beklenti yaratmak.
   - **Karar:** **AÇMA.** Yan menü link'i + boş ekran "yakında" havası
     yaratır. Bu "fake olmasa bile dürüst değil" — kullanıcıya işlevsel
     bir köşe varmış izlenimi verir.

### CP-9A KARAR: Selection Studio AÇILMAZ

**Gerekçe:** Backend tabanı (variation generation worker, review worker,
provider implementation) henüz yeşil değil. Ekran açmak için tek
"dürüst veri" kullanıcının üretmediği bir tablodan empty mesajı
göstermek olur. Bu, ürünün hazır olmadığı bir köşeyi sidebar'a iliştirip
"Phase 5'te gel" demektir. Sidebar gürültüsü + beklenti şişmesi.

**Bunun yerine carry-forward:** CP-9A defter dışı kalır. Selection
Studio dalgası **`generate-variations.worker.ts` yeşil olduğunda** açılır
(Phase 5 implementation). O sprintte sırayla:
1. POST `/api/designs/generate` route + worker
2. GET `/api/designs?referenceId=` listele
3. Selection Studio shell + Card grid + reviewStatus filter chips
4. AI Quality Review (Phase 6) ekranı

İkisi birlikte (üretim + review) açılırsa kullanıcı tutarlı bir akış görür:
"referans → varyasyon üret → kalite skoru → seç". Yarım açmak (sadece
liste, üretim yok) dürüstlük kuralını bozar.

### CP-9A için BUGÜN yapılabilecek tek iş (opsiyonel)

Eğer dalgayı boş bırakmak istemiyorsak, backend'e **dokunmadan**
yapılabilecek tek meşru iş var:

**Provider stub'ları için açıklayıcı README + JobType dispatcher
guard'ı.** Yani Phase 5/6/8 worker iskeletinin nasıl bağlanacağını
belgelemek. Ama bu UI işi değil, dokümantasyon işi. CP-9 wave kuralı
"UI migrasyonu" — bu kapsama girmiyor.

**Sonuç:** CP-9A bu wave'de **iş üretmez**. Selection Studio carry-forward.

## 2. Mockup Studio için hangi backend eksikleri blocker?

### Mevcut taban (ölçüm)

Prisma:
- `Mockup` modeli **var** (id, userId, generatedDesignId, assetId,
  templateKey)
- `JobType.CREATE_MOCKUP` enum **var**

Çevre:
- `src/app/api/mockups/...` route **YOK**
- `src/server/workers/create-mockup.worker.ts` **YOK**
- `src/providers/mockup/index.ts` `NotImplementedMockup` — `render()`
  çağrısı `Error("Mockup provider Phase 8'de aktifleşir")` fırlatır
- Mockup template kaydı **YOK** (admin'de mockup template yönetimi yok)
- `src/features/mockups/` **YOK**

Veritabanı pratiği:
- `Mockup` tablosu **boş**
- `templateKey` referansı için herhangi bir registry yok

### Blocker listesi

CP-9B'yi açabilmek için **şunlar gerekli** (kapsam dışı):

1. **Mockup provider implementation** — Dynamic Mockups veya benzeri
   provider entegrasyonu. Şu an `NotImplementedMockup.render()` fırlatır.
2. **Mockup template registry** — Admin tarafında template tanımı,
   templateKey ↔ asset/dimension mapping. Şu an yok.
3. **`create-mockup.worker.ts`** — Job dispatcher + provider çağrısı +
   asset oluşturma + Mockup row insert. Şu an yok.
4. **`POST /api/mockups`** — Mutation endpoint. Şu an yok.
5. **`GET /api/mockups?designId=`** — Listele endpoint. Şu an yok.
6. **GeneratedDesign zinciri** — Mockup oluşturmak için bir tasarım
   gerekir. Selection Studio gibi, bu da Phase 5'e bağlı.
7. **Custom mockup upload yolu** — Asset upload + template registry
   "user template" desteği. Şu an asset upload var, registry yok.

### Bugün dürüstçe ne yapılabilir?

**A. Hiç açma.** Selection Studio gerekçesiyle aynı: backend tüm
seviyelerde boş, üretim yolu yok, ekran açmak yan menüye "yakında"
köşesi eklemekten ibaret.

**B. Ultra sınırlı dürüst sayfa.** Sadece tek satır mesaj:
> "Mockup üretimi Phase 8'de aktifleşecek. Şu an kullanılabilir bir
> mockup provider'ı bağlı değil."

Bu sayfa:
- Yan menüde link **YOK** (sidebar gürültüsü yok)
- Yalnızca admin'in `/admin/system-status` benzeri bir alanından
  görülebilir
- Ya da hiç sayfa olmaz, sadece admin "system status" rozetinde "Mockup:
  not implemented" satırı görünür

**C. Sadece admin "Phase capability" panosu.** Bu fikrin mantıksal
sonu: admin için "hangi feature açık, hangisi kapalı, niye" ekranı.
Ama bu CP-9'un kapsamı değil — admin hardening (Phase 10).

### CP-9B KARAR: Mockup Studio AÇILMAZ

Gerekçe Selection Studio ile aynı + dahası: provider implementation
yok, template registry yok, custom upload pipeline yok. Ekran açmak için
yedi farklı katmanın yeşil olması gerek; bugün hiçbiri yeşil değil.

**Carry-forward:** CP-9B Phase 8 sprintinde açılır. O sprintte sırayla:
1. Mockup template registry (admin)
2. Provider implementation (Dynamic Mockups veya alternatif)
3. `create-mockup.worker.ts` + `POST /api/mockups` + GET listesi
4. Mockup Studio shell — design seç, template seç, render kuyruğu
5. Custom mockup upload akışı
6. Listing builder ile mockup linkleme (Phase 9)

## 3. Hangi parça şimdi dürüstçe yapılabilir?

CP-9'un soruluş biçimi "Selection + Mockup açalım mı" idi. Cevap:
**ikisi de hayır.** Ama bu, dalganın boş geçeceği anlamına gelmez —
sadece şu iki yüzeyin boş geçeceği anlamına gelir.

### Bu wave'de dürüstçe yapılabilecek iş alternatifleri

CP-9'u **References + Collections migrasyonu** olarak yeniden
tanımlamak Brief'te zaten gündemdi (kullanıcı önceki turda "References
+ Collections zaten bittiği için B artık anlamlı değil" dedi). Doğru,
ana migrasyon bitti. Ama:

**Audit gerekli — gerçekten bitti mi?**
- `src/features/references/` ve `src/features/collections/` mevcut
- Primitive consumption durumu CP-7/CP-8 sırasında uçtan uca tarandı mı?
- Eğer migrasyon eksik kaldıysa CP-9 küçük bir "kalan migrasyon
  süpürgesi" olarak değer üretir.

**Diğer dürüst iş aday adayları:**
1. **Sidebar primitive consumption** — `src/features/app-shell/`
   Sidebar / TopBar henüz primitive ailesi tüketmiyor olabilir.
2. **Settings ekranları** — User settings (mağazalar, Etsy bağlantısı)
   primitive durumu bilinmiyor.
3. **Admin paneli görünür ekranlar** — Audit Logs, Cost Usage, Job
   Monitor primitive durumu bilinmiyor.
4. **A11y carry-forward süpürgesi** — Phase 2 a11y sweep'e biriken
   maddeler (drawer focus trap dışında):
   - Competitor detail tab klavye gez (ArrowLeft/ArrowRight)
   - Trend cluster card klavye Enter/Space (Card as=button native
     destekliyor — doğrulama)
   - Toolbar / WindowTabs roving tabIndex tutarlılığı
5. **Toast primitive terfi keşfi** — T-33/T-34/T-36'da manuel
   `role="status"` + `aria-live` kuralı var. Üç ekran tüketim eşiği
   geçildi. Toast primitive terfisi dürüst bir CP-9 işi olabilir.

### Önerilen sıra (kullanıcı kararına bırakılır)

CP-9 yeniden çerçevelenirse adaylar şu önceliğe sahip:

| Aday | Değer | Risk | Backend dokunma |
|---|---|---|---|
| Toast primitive terfisi | 3 ekran sinyali geçildi, Toggle kuralı tetiklendi | Düşük | Yok |
| Kalan migrasyon süpürgesi (Sidebar/Settings/Admin) | Primitive ailesi tutarlılığı | Düşük-Orta | Yok |
| A11y sweep (klavye gez + drawer focus trap) | Phase 2 carry-forward'lar | Düşük | Yok |
| Selection Studio (CP-9A) | Sıfır — backend yok | Yüksek (sahte yüzey) | Çok (Phase 5) |
| Mockup Studio (CP-9B) | Sıfır — backend yok | Çok yüksek | Çok (Phase 8) |

### Kararın özeti

**Bugün dürüstçe yapılabilen:**
- Toast primitive terfisi
- Sidebar/Settings/Admin migrasyon auditi (eksikse migrasyon)
- A11y sweep (klavye + focus trap)

**Bugün dürüstçe YAPILAMAYAN:**
- Selection Studio (Phase 5 backend bekliyor)
- Mockup Studio (Phase 8 backend + provider bekliyor)

## Yasaklar (CP-9 implementer için — sahte UI yasakları)

- **Mock filmstrip:** "Tasarım önizlemesi" görseli olarak placeholder
  thumb dizmek YASAK. Boş tabloya thumb verme.
- **Fake job listesi:** "Üretim sırasında" gibi sahte job/queue rozeti
  YASAK.
- **Fake quality skoru:** Skor 0 değil "yok". Empty state yok demektir,
  rastgele/varsayılan skor üretilmez.
- **Fake mockup template grid:** "Hazır mockup'lar" gibi statik görsel
  grid YASAK. Template registry yok.
- **"Coming soon" rozeti yan menüde:** Sidebar'a "yakında" link YASAK.
  Açılacaksa açılır, açılmayacaksa görünmez.
- **Aspirational CTA:** "Tasarım üret" butonu route'lu ama altta worker
  yoksa YASAK. Buton 500/disabled olur, dürüst durum.

## Tetikleyici (CP-9A / CP-9B'yi yeniden açma sinyali)

CP-9A (Selection Studio):
1. `generate-variations.worker.ts` yeşil
2. `POST /api/designs/generate` 200 döndüren e2e test geçti
3. AI provider implementation seçildi (OpenAI / Fal / Replicate)

Üçü birden gerekli. İkisi yeşil olunca planlama açılabilir, üçü yeşil
olunca implementation açılır.

CP-9B (Mockup Studio):
1. Mockup provider implementation aktif
2. Template registry admin'de yönetiliyor
3. `create-mockup.worker.ts` yeşil
4. Bir GeneratedDesign satırı oluşturulabiliyor (CP-9A bağımlılığı)

Dördü birden gerekli. Üçü yeşil olunca planlama açılabilir.

## Karar revizyonu

Bu doküman **kilitlidir**. Revize için:
- Kullanıcı (operatör) talimatı, VEYA
- Yukarıdaki tetikleyicilerin gerçekleşmesi

gerekli. "Bir şeyler yapmış olalım" gerekçesi karar revizyonu için
yeterli değil. Boş wave de meşru bir sonuçtur — boş ekran açmaktan iyidir.
