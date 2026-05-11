# Review — Troubleshooting Guide

Operasyonel sorun giderme rehberi. Sık görülen durumlar, olası kök
nedenler ve doğrulama yolları.

> Tüm semptomlar mevcut branch HEAD (`87942ba`) davranışına göredir.
> Belirsiz yerler "?" ile işaretlenmiştir.

---

## 1. "Item not found" görüyorum

**Semptom**: Deep-link açtım (`/review?item=<id>`) ama "Item not
found" geliyor veya boş ekran.

**Olası nedenler:**

| Neden | Doğrulama | Çözüm |
|---|---|---|
| Item başka decision filter'ı altında (örn. `?decision=undecided` ama item kept) | Page loader buna karşı redirect uygular: gerçek decision + page=1 ile yeniden yönlendirir. Browser network'te 307 görmen lazım. | Beklenen davranış. Yeniden açılan URL'i kullan. |
| Item soft-deleted (`deletedAt` veya `isUserDeleted: true`) | Local için isUserDeleted, design için deletedAt | Deleted item review'e geri gelmez. Operatör bilinçli sildi. |
| Item aktif root dışı (local) | Settings → Review → Local library'de aktif root değişti mi? | Aktif root'a geri dön veya farklı root altındaki asset'ler için review yok. |
| Cross-user lookup | `userId` filter zaten zorunlu — başkasının item'ını açamazsın. | Doğru kullanıcıyla giriş yap. |

**Hızlı kontrol**:

```bash
curl /api/review/queue?scope=local&page=1 | jq '.items | map(select(.id == "<id>"))'
```

Boş dönüyorsa item şu queryKey altında değil — decision filter veya
root issue.

---

## 2. "Not queued yet" — Asset'imde scoring çalışmıyor

**Semptom**: Kart üzerinde minus icon, lifecycle `not_queued`. AI
puanı yok.

**Olası nedenler (öncelik sırasıyla):**

1. **Local asset: folder mapping pending** — En sık karşılaşılan.
   Asset'in folder'ı için productType mapping atanmamış. Scan worker
   auto-enqueue YAPMAZ (CLAUDE.md Madde V).

   **Doğrulama**:
   - Settings → Review → Local library → folder list. Folder
     "Pending" durumda mı görünüyor?
   - `GET /api/local-library/folder-mapping` → `summary.pending > 0` mı?

   **Çözüm**:
   - Folder'a productType ata (alias). Örn. `bakılacak-352 ...` →
     `clipart`.
   - Veya folder adını bilinen bir PT'ye yeniden adlandır (convention
     devreye girer): `clipart/`, `wall_art/`, vs.
   - Veya operatör `Settings → Review → ops` panelinden manuel
     "Enqueue review for this scope" tetikler (productTypeKey body'de
     verilirse mapping bypass edilir).

2. **AI design: variation worker auto-enqueue başarısız** — Provider
   çağrısı kuyrukta hata almış, retry sayısı aşılmış olabilir.

   **Doğrulama**:
   - `db.job` tablosunda asset'e bağlı `REVIEW_DESIGN` job var mı?
   - Var ama `status: FAILED` mi? → lifecycle `failed` görünmeli, "not
     queued" değil.
   - Hiç job yoksa: worker enqueue path'i kırılmış demek (bug).

   **Çözüm**:
   - Operatör focus mode'da "Rerun review" tıklar — yeni job açar.
   - Worker logs'a bak; persistent error varsa platform tarafında.

3. **Already-scored guard yanlış skip etti** — Worker erken çıkmış
   olabilir.

   **Doğrulama**: `reviewProviderSnapshot` dolu mu? Doluysa zaten
   `ready` görünmeli.

   **Çözüm**: Snapshot dolu + lifecycle not_queued tutarsız — bug
   raporla.

---

## 3. Review sonucu görünmüyor (snapshot eksik)

**Semptom**: Item'ı saatlerce önce enqueue ettim ama hâlâ score chip
yerine icon var.

**Olası nedenler:**

| Neden | Doğrulama | Çözüm |
|---|---|---|
| Worker offline | `db.job` row'unda `status: PENDING` çok eski tarihli | Worker process'i çalışıyor mu kontrol et |
| Provider rate-limit | Logs'ta provider error mesajları | Bekle veya provider quota'sını yükselt |
| Persistent fail → job retry-exhausted | `status: FAILED`, lifecycle UI'da `failed` | Operator "Rerun review" yapar |
| Snapshot yazıldı ama UI cache stale | Network sekme'de queue endpoint son response'unda `reviewedAt + reviewProviderSnapshot` dolu mu? | Refresh; veya React Query cache invalidate (sayfayı kapatıp aç) |

---

## 4. Local item auto-review olmuyor

**Semptom**: Yeni asset'leri scan ettim, listede görünüyor ama hiçbiri
queued olmuyor.

**Kök neden**: Folder mapping pending. Operatör mapping atayana kadar
auto-enqueue kapalı (cost discipline + CLAUDE.md Madde V).

**Çözüm**:

1. Settings → Review → Local library aç.
2. "Pending folders" bloğunda folder'ları gör.
3. Her folder için dropdown'dan productType seç (clipart / wall_art /
   sticker / transparent_png / bookmark / printable veya
   `__ignore__`).
4. Mapping yazıldıktan sonra: ya yeni bir scan tetikle, ya da focus
   mode'dan "Enqueue review for this scope" CTA'sı ile folder'ı
   manuel olarak kuyruğa al.

> Aynı isimli farklı path'teki klasörler artık çarpışmaz (IA-35).
> Mapping anahtarı canonical `folderPath`. Legacy folderName-keyed
> entries hâlâ okunur (geriye uyumluluk).

---

## 5. Mapping pending / ignored — ne anlama gelir?

**Pending**: Operatör henüz bu folder için karar vermedi. Auto-
review **çalışmaz**.

**Ignored** (`__ignore__` sentinel): Operatör bu folder'ı atlamak
istedi. Scan worker bu folder'daki asset'leri içeri alır (görünür
kalır) ama auto-enqueue yapmaz. Operatör manuel scope-trigger ile
yine tetikleyebilir — ignore yalnız otomatik akışta.

**Convention**: Folder adı bilinen bir productType key'i ise
(`clipart/`, `wall_art/`). Mapping yazmana gerek yok, otomatik
çalışır.

**Alias**: Operatörün açıkça yazdığı eşleşme (path veya legacy
folderName). Convention'dan baskın.

---

## 6. Rerun sonrası ne beklenir?

Rerun tetiklediğinde:

1. UI lifecycle anında `not_queued` olarak görünebilir (snapshot
   wipe ile UI cache invalidate'i arasındaki kısa pencere).
2. ~1-3 saniye içinde lifecycle `queued`'a geçer.
3. Worker job'u aldığında `running` (~5-30s, provider'ın hızına
   bağlı).
4. Snapshot yazıldıktan sonra `ready`; score chip + AI suggestion
   güncellenir.

**Polling**: Queue endpoint listede `queued` veya `running` item var
oldukça 5s polling açık. Tüm item'lar `ready` olduğunda polling
durur (idle scope'larda istek yok — IA-35 düzeltmesi).

> Rerun bir provider çağrısı = cost. Confirm prompt'u sebebiyle
> yanlış tıklama önlenir.

---

## 7. AI suggestion ile operator decision neden farklı?

**Bilinçli ayrım**. CLAUDE.md Madde V:

- AI suggestion (`reviewSuggestedStatus`) **tavsiyedir** — operatörü
  bağlamaz.
- Operator decision (`reviewStatus + reviewStatusSource = USER`)
  canonical truth.

**Yaygın durumlar**:

| Durum | Anlamı |
|---|---|
| AI `APPROVED`, operator `KEPT` | Operatör AI'a katıldı. Downstream akış buradan ilerler. |
| AI `APPROVED`, operator `REJECTED` | Operatör tavsiyeyi reddetti. Bu item downstream'e gitmez. AI raw data referans olarak kalır. |
| AI `NEEDS_REVIEW`, operator `KEPT` | Operatör "Approve anyway" yaptı. UI bunu info-rail'de gösterir; downstream akış normal işler. |
| AI henüz `PENDING`, operator `KEPT` | Operatör AI değerlendirmesi gelmeden karar verdi (manuel inspection). Geçerli; downstream akış işler. |

**"Kept" tanımı tek**: `reviewStatus = APPROVED AND
reviewStatusSource = USER`. AI suggestion bu sayıma sızmaz; downstream
gate yalnız operator damgasına bakar.

---

## 8. Refresh atmadan update ne zaman gelir?

| Aksiyon | Live update | Cadence |
|---|---|---|
| Operator Keep/Discard | Anında (mutation invalidate) | <500ms |
| Operator Undecided (reset) | Anında | <500ms |
| Rerun review | Lifecycle değişimi 5s polling ile | 5s, lifecycle ready olunca durur |
| Variation worker yeni item ekledi | Polling unsettled item yoksa **durur**; manuel refresh gerek | — |
| Local scan yeni asset taradı | Polling unsettled yoksa durur | — |
| Tab gizli iken (background) | Polling **durur** (`refetchIntervalInBackground: false`) | — |
| Tab geri görününce | Manuel refetch | Anında |

> Eğer "scan yeni asset ekledi ama listede görünmüyor" diyorsan:
> sayfayı yenile veya tabı focus'a getir. Polling idle scope için
> bilinçli kapalı (IA-35 — `not_queued` artık unsettled değil).

---

## 9. Topbar sayıları yanlış görünüyor

`67 LOCAL PENDING` ile `THIS SCOPE 12 UNDECIDED` farklı sayılarda —
**bu doğru**.

- Sol blok = source pending (Local source'daki tüm operator-
  undecided item'lar, active root dahilinde).
- Sağ blok = current scope (örn. folder içindeki) operator
  damgalı kırılım.
- `Item N / M` = current scope cardinality.

Aynı sayı ise scope = entire source (`folder` veya `reference`
verilmemiş queue mode).

**Eski "ALL PENDING" (workspace global)** review focus topbar'dan
kaldırıldı (IA-34). Eğer hâlâ "141 ALL PENDING" görüyorsan branch
güncel değil — pull yap.

---

## 10. Decision filter chip'i seçtim ama grid boş

**Olası neden 1**: O scope'ta o decision'da gerçekten item yok.
Sayfa loader'ın `THIS SCOPE 12 UNDECIDED · 0 KEPT · 0 DISCARDED`
breakdown'ı ile uyumlu mu?

**Olası neden 2**: Page loader item-not-found redirect'i sırasında
URL düzeltildi ve grid yenilendi. URL bar'a bak; decision aynı mı?

**Olası neden 3**: Cache stale (`q` search aktifken çok nadir).
URL'i yenile.

---

## 11. Stage küçük / kenarlarda boşluk var

**Local focus mode'da**: Eğer `fullResolutionUrl` yerine
`thumbnailUrl` çekiyor (512×512 webp) ise stage 760×760
container'da küçük görünür.

**Doğrulama**: Browser network'te focus mode açıkken `/api/local-
library/asset?hash=…` mı görüyorsun, yoksa `/api/local-library/
thumbnail` mı?

- Doğru: `/api/local-library/asset` (orijinal, IA-33).
- Hatalı: `/api/local-library/thumbnail` (eski branch).

Yine de küçük görünüyorsa: asset boyutu gerçekten küçük olabilir
(`naturalWidth × naturalHeight` < 1024) — bu kaynak gerçeğidir,
upscale yapılmaz.

---

## 12. Bulk decision sonrası bazı item'lar kept'e geçmedi

**Olası neden**: Bulk endpoint operator-truth gate'ini uygular.
Specific item'lar zaten KEPT durumunda + USER source ise atlama olur
(idempotent). Bulk action sayısı != selected count olabilir.

**Doğrulama**: Bulk action response'unu kontrol et — `applied N,
skipped K, errors E` döner.

---

## 13. "Could not resolve productTypeKey" hatası

**Senaryo**: Local item için `PATCH /api/review/decisions` (rerun)
çağırdığımda 400 alıyorum.

**Kök neden**: Asset'in folder'ı için productType mapping yok ve
body'de productTypeKey de verilmemiş.

**Çözüm**:

1. Settings → Review → Local library aç, folder'ı bul.
2. ProductType seç ve Save.
3. Rerun'u tekrar dene.

veya body'de `{ productTypeKey: "clipart" }` ile override gönder
(admin debug için).

---

## 14. Settings → Review thresholds değiştirdim ama eski item'ların skoru aynı

**Beklenen davranış** (CLAUDE.md Madde S):

- Threshold değişikliği yeni job'ları etkiler.
- Mevcut stored kararlar **olduğu gibi kalır**.
- UI'da "Current policy preview" (collapsible) ile **stored ≠ preview
  ise** yeni threshold'larla nasıl görünürdü gösterilir.
- Tüm item'ları yeni policy ile yeniden hesaplatmak istiyorsan
  her birini "Rerun review" yap (cost'a dikkat).

> Queue endpoint **lazy recompute** uygular (IA-31): eski snapshot'ın
> `reviewScore`'u bugünkü criteria + risk flag kinds matematiğiyle UI
> response'una yeniden hesaplanır. Persist yok. Bu sayede 85/75 gibi
> eski raw değerler bugün 80/80 görünür.

---

## 15. Test fail'leri review modülü blocker'ı mı?

Workspace combined `npx vitest run` → ~141 fail (HEAD'de).

Hepsi pre-existing borç:
- Phase 3/4 sayfaları (bookmarks, competitors, references, collections,
  trend-*).
- Selection bulk-* (IA-30 öncesi semantiği).
- Mockup UI eski expectations.

Review module targeted suite: **96/96 pass**.

> IA-35'ten önce default `npm test` sadece `.test.ts` koşuyordu;
> `.test.tsx` UI fail'leri gizliydi. Workspace patterni ile artık
> görünüyor ama bu yeni regression **değildir** — eski borç.

---

## 16. Hiçbir şey yardımcı olmadıysa

1. Browser DevTools → Network sekmesi. `/api/review/queue` request
   ve response payload'ına bak.
2. `reviewStatus`, `reviewStatusSource`, `reviewSuggestedStatus`,
   `reviewScore`, `reviewProviderRawScore`, `reviewedAt`,
   `reviewProviderSnapshot`, `reviewLifecycle` ne diyor?
3. Console errors var mı?
4. Server logs (`preview_logs` veya production stack) → worker
   error'ları?

---

## İlgili dokümanlar

- [Review User Guide](REVIEW_USER_GUIDE.md)
- [Review Technical Spec](REVIEW_TECHNICAL_SPEC.md)
- [CLAUDE.md](../../CLAUDE.md) — ürün anayasası
