# EtsyHub — Tasarım Dili + Ekran Spec'i

> Bu doküman, `EtsyHub Design Language.html` dosyasındaki canlı canvas'ın eşlikçisidir. Canvas görsel yönü kanıtlar; bu doküman kararları yazıya döker, Claude Code handoff için operasyonel zemin sağlar. **Editoryal kokpit** yönü uygulandı: warm off-white yüzey (`#FAFAF7`), `#E85D25` aksan, Inter + IBM Plex Mono, ince border + yumuşak shadow kart dili, accent-bar-left sidebar.

> **Senkron durumu:** Bu doküman ve canvas birebir hizalı. Envanter, primitive listesi, ekran seviyeleri ve kapanış durumu bu dosyadaki tek doğrudur.

---

## TEK VE KESİN ENVANTER

**Canvas:** `EtsyHub Design Language.html`
**Toplam bölüm:** 7
**Toplam artboard:** 17

### Bölüm bölüm artboard listesi

| # | Bölüm | Artboard | Ekran |
|---|---|---|---|
| 1 | Tasarım Dili | `primitives` | Primitives showcase |
| 2 | Auth | `login` | Login · default |
| 3 | Kullanıcı Paneli | `dashboard` | Dashboard |
| 4 | Kullanıcı Paneli | `bookmarks` | Bookmarks · default · 3 seçili + bulk |
| 5 | Kullanıcı Paneli | `bookmarks-empty` | Bookmarks · empty state |
| 6 | Kullanıcı Paneli | `bookmarks-loading` | Bookmarks · loading (6 sabit skeleton) |
| 7 | Kullanıcı Paneli | `references` | References grid |
| 8 | Kullanıcı Paneli | `collections` | Collections mosaic kartlar |
| 9 | Keşif | `competitors` | Competitors |
| 10 | Keşif | `trend-stories` | Trend Stories |
| 11 | Üretim | `selection` | Selection Studio |
| 12 | Üretim | `mockup` | Mockup Studio |
| 13 | Admin Paneli | `admin-users` | Admin Users |
| 14 | Admin Paneli | `admin-product-types` | Admin Product Types |
| 15 | Admin Paneli | `admin-feature-flags` | Admin Feature Flags |
| 16 | Sistem Katalog | `confirms` | Confirm dialog · 3 tone |
| 17 | Sistem Katalog | `empties` | Empty state · 4 örnek |
| 18 | Sistem Katalog | `skeletons` | Skeleton · 3 density |

(Numaralandırma 18'e kadar gidiyor; bölüm sayısı 7.)

### Studio ekranları (hi-fi ürün kokpiti)
- Selection Studio
- Mockup Studio

### Katalog ekranları (primitive varyant kanıtı)
- Confirm dialog catalog (destructive / warning / neutral)
- Empty state catalog (neutral / neutral / warning / error — 4 gerçek kullanım)
- Skeleton catalog (user grid · admin row · detay layout)

---

## PRIMITIVE ENVANTERİ

Bu envanter kesin. "Primitive eklemedim" önceki ifadem, **çekirdek primitive** seviyesinde doğru — aşağıdaki her şey önceki turlarda inşa edilmiş `primitives.jsx` + `app-shell.jsx` kapsamında. Yeni eklenen `Toggle`, ekran içi yardımcıdır; ürün primitive'i değildir, ileride ihtiyaç olursa terfi ettirilebilir.

### 1. Çekirdek primitive'ler (ürün sistemi)

`primitives.jsx` + `app-shell.jsx` içinde. Her ekran bunları tüketir, hiçbir ekran bunları delemez.

| Primitive | Dosya | Varyant/prop'lar |
|---|---|---|
| `Icon (I.*)` | primitives.jsx | bookmark, folder, sparkle, search, filter, plus, download, send, check, x, chev, dots, alert, trash, image, layers, store, trend, wand, eye |
| `Button` | primitives.jsx | variant: primary/secondary/ghost · size: sm/md/lg · icon/iconRight · loading |
| `Input` | primitives.jsx | prefix/suffix · error · disabled |
| `Badge` | primitives.jsx | tone: neutral/accent/success/warning/danger/info · dot |
| `Chip` | primitives.jsx | active · removable |
| `Card` | primitives.jsx | interactive · onMouseEnter/Leave |
| `Thumb` | primitives.jsx | kind: boho/christmas/nursery/poster/clipart/sticker/abstract/landscape/neutral · aspect |
| `Skeleton` | primitives.jsx | w · h · r |
| `StateMessage` | primitives.jsx | tone: neutral/warning/error · icon · title · body · action |
| `NavItem` | app-shell.jsx | active · count · group header |
| `Sidebar` | app-shell.jsx | scope: user/admin · accent-bar-left |
| `PageShell` | app-shell.jsx | scope · title · subtitle · actions · toolbar |

### 2. Yardımcı wrapper / helper'lar (ekran içi)

Tek bir ekran ailesine hizmet ediyorlar; terfi değildir. Eğer ikinci bir ekranda ihtiyaç olursa çekirdeğe taşıdım.

| Helper | Dosya | Kullanım |
|---|---|---|
| `Toggle` | screens-b.jsx | Admin Product Types + Admin Feature Flags — accent pill toggle. **Terfi adayı**: üçüncü admin ekranında da istenirse çekirdeğe alınacak. |
| `miniRow / HeadCell / Cell` | screens-b.jsx | Admin tablo + Competitors listing tablosu — admin density mini-table. Çekirdek `Table` primitivi bu davranışı kapsamalı; şimdilik yerel. |
| `SectionTitle` | screens-b.jsx | Competitors, Trend Stories, Mockup Studio bölüm başlıkları |
| `QuickEdit` | screens-b.jsx | Selection Studio edit sidebar button satırı |
| `StatMini` | screens-b.jsx | Competitors store card stat üçlüsü |

### 3. Katalog / demo bileşenleri

Ürün ağacında **yoklar**; sadece canvas'taki sistem katalog artboard'larını render ederler.

| Bileşen | Amaç |
|---|---|
| `DialogCard` | Confirm dialog 3 tone yan yana sergisi |
| `CanvasBackdrop` | Katalog artboard'larına uygulanan etiketli fon |
| `MockupScene` | Mockup Studio için pure-CSS sahne (oda / galeri / nursery / flat lay) |

---

## EKRAN ÇÖZÜM SEVİYELERİ

| Ekran | Seviye | Notlar |
|---|---|---|
| Dashboard | **direction-level** | İskelet + stat hiyerarşisi + bölümleme kararlı. Widget detayları, mikro grafik, data binding sonraki turda derinleşecek. |
| Bookmarks (3 state) | **full hi-fi** | Default + empty + loading kapandı. Yüzey kararlı. |
| References | **full hi-fi** | Kart hi-fi, koleksiyon filter bar + bulk ready. |
| Collections | **full hi-fi** | 2×2 mosaic karar verildi. |
| Competitors | **full hi-fi** | Ekle formu + takipli mağazalar + top-reviewed tablo. Analiz detay drill-down sonraki turda. |
| Trend Stories | **full hi-fi** | Cluster satırı + story feed hi-fi. Story tap preview modalı sonraki turda. |
| Selection Studio | **full hi-fi** | Preview + filmstrip + edit sidebar + kalite skoru hi-fi. Edit uygulama iç akışı sonraki turda. |
| Mockup Studio | **full hi-fi** | Featured render + template grid + render queue hi-fi. Custom mockup upload modalı sonraki turda. |
| Admin Users | **full hi-fi** | Tablo dili hi-fi. |
| Admin Product Types | **full hi-fi** | Toggle + usage + recipe sayısı hi-fi. |
| Admin Feature Flags | **full hi-fi** | Kapsam + env + rollout progress hi-fi. |
| Login | **full hi-fi** | Brand panel + form panel hi-fi. Register tab içeriği direction-level. |
| Confirm dialog catalog | **katalog/demo** | 3 tone sergisi. Ürün kullanımında `Dialog` primitivi üzerinden tüketilir. |
| Empty state catalog | **katalog/demo** | 4 gerçek kullanım. `StateMessage` primitivinin ürün davranışını kanıtlar. |
| Skeleton catalog | **katalog/demo** | User grid + admin row + detay layout. Shimmer yok, pulse dili kanıtlandı. |

---

## BÖLÜM A — TASARIM DİLİ

### A.1 Final Ürün Tasarım Prensipleri

**1. Sakin yoğunluk.** EtsyHub üretim kokpitidir; kullanıcı ekranda saatler geçirir. Ekranda çok veri, çok görsel, çok aksiyon var ama sayfa gürültülü hissetmemeli. Bu prensibi warm off-white yüzey, nötr kenarlık tonu ve sınırlı shadow hiyerarşisi taşır. Örnek: Bookmarks grid'inde 24 kart aynı anda render edilebilir; ama sadece hover edilen kart border-strong ve hafif shadow yükselişi ile ayrışır.

**2. Asset öncelikli.** Ürünün kalbi görsellerdir. Kart yüzeyinin en az %60'ı thumbnail'a ayrılır; tipografi ve meta ikinci plandadır. Örnek: bookmark card padding 0, üstte `aspect-card` thumbnail full-bleed, altta 12px padding ile title + single badge + mono source.

**3. Mono meta, sans gövde.** Tipografi hiyerarşisi mantığı: insan okur → Inter; sistem okur → IBM Plex Mono. Tarih, email, URL, score, kaynak domain'i, pagination sayacı mono'dur; başlıklar, body, button etiketi sans'tır. Bu ayrım kullanıcıya "bu satır veri" sinyali verir.

**4. Tek birincil aksiyon.** Her ekranda tek bir primary button vardır (accent dolu). Geri kalanı secondary, ghost veya destructive. Dashboard'da "Yeni varyasyon üret"; Bookmarks'ta "URL ekle"; Admin Users'ta "Kullanıcı davet et". Bu disiplin ekran-başına-birinci-iş sorusunu net tutar.

**5. Status title-case, badge mono uppercase.** Badge gramerinde iki kat: görünen metin **title-case** Türkçe (Hazır, Review, Üretiliyor, Hata, Rollout, Açık), ama 11px mono + 0.6 letter-spacing + uppercase render edilir. Karar: içerik title-case yazılır, badge primitivi render sırasında uppercase uygular. Bu ürüne tutarlı dil verir; badge dışı yerlerde (ör. page subtitle) aynı kelime title-case okunur.

**6. User vs admin — aynı aile, farklı sıkılık.** User panelinde `p-6 gap-4`, admin panelinde `p-4 gap-3`. Admin'de body `text-sm`, user'da `text-base`. Admin'de tablo satırı 48px, user'da kart pad 16px. Palette, radius, aksan ortaktır.

**7. Skeleton sadedir.** Shimmer gradient yok; sadece `ehPulse` keyframe ile opacity 1 ↔ 0.55 salınımı. 6 sabit kart grid / 5 sabit satır tablo. Pulse izleyiciyi yormaz, shimmer yorar.

**8. Hover kontrollüdür.** Kart hover dili: (a) border `border` → `border-strong`, (b) thumbnail içinde `scale-subtle` (1.015×), (c) shadow 1px → 4px. Asla renk patlaması, scale sıçraması, bouncing. `scale-subtle` yalnızca görsel yüzeyde uygulanır, tüm kart kutusunda değil.

---

### A.2 UI Language Kit

Her primitive için canlı örnek `EtsyHub Design Language.html` → "Tasarım Dili" section → "Primitives showcase" artboard'unda.

#### 1. Button
- Varyantlar: `primary` (accent fill), `secondary` (surface + border), `ghost` (transparent → surface-2), `destructive` (surface + danger text)
- Boyutlar: sm 28h · md 34h · lg 40h
- Durumlar: default / hover / focus (accent ring 2px offset) / disabled / loading
- Radius `md`, font sans 500. Her ekranda **tek** primary.
- **Yanlış:** iki primary yan yana; pill radius; destructive'i kırmızı fill.

#### 2. Input / Textarea
- 34h, radius md, prefix/suffix slot. Focus: accent border (ring yok).
- Textarea `min-h-textarea` (80px), vertical resize.
- **Yanlış:** shadow; glassmorphism; label-as-placeholder.

#### 3. Card (3 tip)
- **Stat card** — mono uppercase label + büyük numeral + trend badge
- **Asset card** — padding 0, aspect-card thumbnail full-bleed, 12px pad alt kısım
- **List / table card** — yatay sıra, sol avatar/thumb, sağ meta

Tümü: surface bg, border 1px, radius md, shadow-card; interactive hover: border-strong + 4px soft shadow.
**Yanlış:** gradient bg; borderless + colored shadow; pill radius.

#### 4. Table (admin)
- Row 48h body, 34h head. Head: surface-2 bg, mono uppercase 11, tracking 0.6.
- Selected row: accent-soft bg.
- Bulk action bar: kart üstünde ayrı sıra, accent-soft, seçim sayacı + ghost aksiyonlar.
- Sort header: accent ok (↓/↑). Empty satırı: tablo içinde 5-row StateMessage.
- **Yanlış:** zebra stripe; dikey kolon çizgisi; hover renk patlaması.

#### 5. Badge / Chip / Tag
- **Badge (status):** 20h, mono uppercase 11, radius sm, tones: neutral/accent/success/warning/danger/info; `dot` sol 6px.
- **Chip (filter):** 28h, sans 13, active → accent-soft bg.
- **Tag (category):** neutral badge, thumbnail altında tek tane.
- **Yanlış:** ekranda 3'ten fazla tone; chip'i button gibi kullanmak; badge pill rounded-full.

#### 6. Dialog / Confirm
- Overlay `text/50` (rgba(26,23,21,0.5)), blur **YOK**.
- Panel: surface bg, radius lg, shadow-popover, 20 pad, max-w 440.
- Header: 36×36 tone-soft icon kutu + title 15/600 + body 13 muted.
- Footer: sağa yaslı, secondary iptal + primary/destructive onay.
- 3 tone: neutral (accent), warning, danger.

#### 7. Skeleton
- Atomic `Skeleton(w,h,r)` — surface-3 bg + ehPulse.
- Grid skeleton: 6 sabit kart. Table skeleton: 5 sabit satır. Detay: hero + sidebar kompoze.
- **Yanlış:** shimmer; random boyut.

#### 8. StateMessage
- 40×40 tone-soft icon kutu + 15/600 title + 13 muted body + opsiyonel CTA.
- 3 tone: neutral / warning / error. Padding 48 vertical, 24 horizontal. Max-w body 360.
- **Yanlış:** illüstrasyon; dekoratif art; emoji.

#### 9. Asset / Thumbnail
- Aspect: `--aspect-card` 4/3, `--aspect-portrait` 2/3, `--aspect-square` 1/1.
- Fallback kind'lar: boho, christmas, nursery, poster, clipart, sticker, abstract, landscape, neutral.
- Hover: `scale-subtle` 1.015×, 180ms ease-out. Selected: accent outer ring.

#### 10. Page Shell / Sidebar
- Sidebar 232w, surface-2 bg, accent-bar-left (2×16px bar active item'da), group headers mono uppercase.
- Topbar 56h, sayfa başlığı 2xl + subtitle 12 muted, sağ actions gap-2.
- Toolbar opsiyonel, border-bottom-subtle, search + chip row + view toggle.

#### 11. Toolbar / Filter bar
- Sol 260-280w search · divider · chip row · sağ ghost filter button / view toggle.
- Bulk bar toolbar altında ayrı satır, accent-soft bg.

#### 12. Etkileşim durumları

| State | Border | Background | Shadow | Scale |
|---|---|---|---|---|
| default | border | surface | shadow-card | 1 |
| hover | border-strong | surface | 4px soft | asset only: scale-subtle |
| selected | accent | surface + outer ring | shadow-card | 1 |
| focus | accent | (same) | — | 1 |
| disabled | border-subtle | surface-3 | none | 1 |
| busy | border | surface | shadow-card | 1 + spinner |

#### 13. Spacing / Radius / Shadow density
- User: page-pad 24, grid gap 16, card pad 16, row 52.
- Admin: page-pad 16, grid gap 12, card pad 12, row 48.
- Radius: sm 4 (chip, badge) · md 6 (default) · lg 10 (dialog).
- Shadow: card + popover. **Başka shadow yok.**

#### 14. User vs admin ton farkı

| Boyut | User | Admin |
|---|---|---|
| Body size | 14 | 13 |
| Row height | 52 | 48 |
| Page pad | 24 | 16 |
| Grid gap | 16 | 12 |
| Birincil yüzey | kart grid | tablo |
| Action density | 2-3 button | 1-2 + CSV export |

Palette, radius, shadow ortak. Sadece density + layout birimi değişir.

#### 15. Veri yoğun vs thumbnail yoğun hiyerarşi
- **Admin satır:** 28px avatar + name 13/500 + email mono 11 muted + kolonlar. Lineer, soldan sağa.
- **Bookmark kart:** thumbnail %65 yüzey + title tek satır ellipsis + badge + source mono. Dikey, görsel öne.

---

### A.3 İki Alternatif Yön + Öneri

#### Yön 1 — Editoryal Kokpit ✅ SEÇİLEN VE UYGULANDI

Warm off-white, büyük asset yüzeyleri, ince border + yumuşak shadow, az chrome, mono meta. Linear'ın disiplini + Substack'in editoryal hissi.

**+** Asset'ler nefes alır; uzun kullanımda yormaz
**+** Palette thumbnail çeşitliliğine sadık kalır
**+** Premium üretim aracı hissi
**−** Yoğun tablolarda daha fazla gap = daha az satır per ekran
**−** Shadow'a alışkın kullanıcıya "düz" gelebilir
**−** Dark mode ekstra düşünce ister

Güçlü: Bookmarks, References, Trend Stories, Dashboard, Selection, Mockup.
Zayıf: Job Monitor, Audit Logs gibi süper yoğun tablolarda zorlar.

#### Yön 2 — Terminal Disiplini (seçilmedi)

Soğuk gri, tam mono body, radius 2px, hard border, shadow yok. Asset-first ürün ruhuyla çelişir; Matesy/Listybox akışındaki sıcak Etsy tonunu kaybeder.

**Karar:** Editoryal Kokpit. **Canvas'taki tüm 17 artboard bu yönde çizildi.**

---

### A.4 Claude Code Handoff

**KRİTİK:** Primitive-first. Ekran aileleri primitive tüketir, davranış delemez.

#### Token ekleri

```js
theme.extend.aspectRatio = { card: '4 / 3', portrait: '2 / 3' }
theme.extend.minHeight = { textarea: 'var(--space-20)' }
theme.extend.scale = { subtle: '1.015' }
```

#### Primitive inşa sırası
1. Tokens + globals
2. Button
3. Input / Textarea
4. Badge / Chip
5. Card (Stat / Asset / List)
6. Skeleton + SkeletonCard + SkeletonRow
7. StateMessage
8. Thumb / AssetSurface
9. NavItem + Sidebar
10. PageShell
11. Toolbar / FilterBar / BulkActionBar
12. Dialog / Confirm
13. Table (Head, Row, Cell)
14. Toggle (yardımcıdan terfi edilirse)

#### Ekran migrasyon sırası
- **Phase 1 (kapandı):** Bookmarks → References → Admin Users → Login
- **Phase 2 (kapandı):** Dashboard → Collections → Competitors → Trend Stories → Selection Studio → Mockup Studio → Admin Product Types → Admin Feature Flags + sistem katalog (Confirm · Empty · Skeleton)
- **Phase 3 (sıradaki):** AI Review Queue, Listing Builder, Publishing Queue, Export Center, Clipart Studio, Prompt Playground, Cost Usage, Negative Library, Recipes, Seasonal Calendar, Audit Logs, Job Monitor detayları

#### Yapılmayacaklar
- `confirm-dialog.tsx` yeniden yazılmayacak; sadece overlay'den `backdrop-blur-sm` kaldırılacak, ikon kutusu radius md + tone-soft bg güncellenecek
- Skeleton'a shimmer/gradient eklenmeyecek
- Button'a yeni variant eklenmeyecek (success button yok)
- Hiçbir ekrana emoji/illüstrasyon eklenmeyecek
- Custom tek-seferlik hover davranışı yok

#### Kabul kriterleri
- Her primitive: default + hover + focus + disabled + Storybook
- Her ekran: empty + loading + default; URL state senkron; keyboard shortcuts; 1024+ responsive

---

## BÖLÜM B — EKRAN TASARIMLARI

Tüm ekranlar canvas'ta canlı. Aşağıda her birinin kararları; wireframe yerine canvas artboard'una referans.

### B.1 Dashboard · direction-level
Stat row (4 col) + son işler (list card) + review bekleyen (asset preview pair) + yükselen trendler (4-col asset grid). Derinleşme sonraki turda: widget içerikleri, mini grafik, drill-through linkler.
**Primitives:** PageShell, Card (stat + list + asset), Badge, Thumb.
**Tokens:** page-pad-user 24, gap-4, shadow-card, text-3xl numeral.
**Kaçınılan:** chart; gradient hero; greeting copy.

### B.2 Login · full hi-fi
İki kolon 1:1; sol brand panel (surface-2, editoryal copy, 4 asset strip), sağ form panel (tab switch + email + şifre + primary CTA + Google OAuth).

### B.3 Bookmarks (default + empty + loading) · full hi-fi
4-col grid, bulk bar 3 seçili, toolbar search + 6 chip + ghost filter + grid/list toggle. Empty: StateMessage neutral + CTA çifti. Loading: 6 sabit skeleton kart.

### B.4 References · full hi-fi
Bookmarks kart dili + koleksiyon filter chip satırı (6 koleksiyon + "koleksiyonsuz"). Kart altında badge: `folder accent` koleksiyonlu · italik "koleksiyonsuz" boş olan.

### B.5 Collections · full hi-fi
3-col grid, kart: 2×2 mosaic thumbnail (aspect 16:9) + başlık + count + son güncelleme mono. Accent bar (3px) aktif koleksiyonu işaretler.

### B.6 Admin Users · full hi-fi
9-kolon tablo, head mono uppercase, 1 satır selected (accent-soft). 3 chip filter, CSV export + davet CTA topbar.

### B.7 Admin Product Types · full hi-fi
7 satır (4 aktif + 3 pasif), kolonlar: Tip (thumb + name) · Slug · Aspect · Recipe · Usage · Toggle · dots. Pasif satırda "Kullanıcı panelinde gizli" sub-copy.

### B.8 Admin Feature Flags · full hi-fi
7 flag satırı; her satır: key (mono) + name + desc + scope badge + env badge + state badge (dot) + rollout progress bar + toggle. `Rollout` ve `Beta` state'leri warning/info tone.

### B.9 Competitors · full hi-fi
Üç blok: (1) hızlı ekle formu, (2) 3-col takipli mağaza kartı (avatar + growth badge + stat üçlüsü), (3) "En çok yorum alan ürünler" tablosu 8 satır.

### B.10 Trend Stories · full hi-fi
İki blok: (1) 4-col trend cluster kartı (2-gözlü mosaic + heat badge + count chip), (2) 4-col story feed (portrait asset + gradient overlay + bookmark/folder/wand hover butonları).

### B.11 Selection Studio · full hi-fi
Sol: varyant preview kartı + 12-slot filmstrip (seçili: accent border, checked: accent pin). Sağ 320w edit sidebar: kalite skoru 92, kontrol listesi, edit prompt textarea, 4 quick edit buton, footer "Reddet / Seçime ekle".

### B.12 Mockup Studio · full hi-fi
Sol: featured render kartı (16:9 oda sahnesi) + 3-col 6 template grid (aktif template accent border). Sağ 320w render queue: 7 iş · progress bar + status + ZIP indir CTA.

### B.13 Confirm dialog catalog · katalog/demo
3 dialog yan yana: danger (trash, "Kalıcı olarak sil"), warning (alert, "Onayla ve gönder"), neutral (folder + input, "Oluştur"). Her biri 360w panel, shadow-popover.

### B.14 Empty state catalog · katalog/demo
4 kart: Bookmarks ilk kullanım (neutral), boş koleksiyon (neutral), Review queue temiz (warning — beklenen pozitif boş), Etsy bağlantısı hatası (error). Her biri meta band + StateMessage primitivi.

### B.15 Skeleton catalog · katalog/demo
3 density: user grid (6 sabit kart), admin tablo (5 sabit satır, her kolonu skeleton), detay layout (hero + thumb strip + sidebar meta/button iskeleti).

---

## AÇIK SORULAR · cevaplar

**1. Wow noktası.** Bookmark grid ilk açılış — 24 thumbnail aynı anda, hover'da asset-scale-subtle + border-strong. Trend Stories cluster kartında 3-gözlü mosaic + heat badge ikinci wow. Mockup Studio'nun oda sahnesi üçüncü. Hepsi marketing değil, **veri yoğunluğunun disiplinli sunumu**.

**2. Asset baskınlığı.** Kart yüzeyinin %60-70'i thumbnail. Title tek satır ellipsis, badge 1 tane, source mono. Admin tablosunda ters — 28px avatar, veri baskın.

**3. Admin tarafı.** Aynı palette, aynı primitive, density token farkı: `p-4 gap-3`, body text-sm, row 48px. Tipografi skalası aynı, ölçekleri değişir. Shadow aynı.

**4. Hover.** Üçü kombine ama ölçülü: border-strong + thumbnail scale-subtle (1.015) + shadow 1→4px. Kart kutusu scale etmez; sadece thumbnail. **named `scale-subtle` = 1.015** (canvas'ta canlı).

**5. Badge/chip dağılımı.**
- Status badge: Dashboard, Admin Users, Feature Flags, Render queue → yoğun
- Count badge (sidebar nav): review queue + job monitor → minimal
- Filter chip: Bookmarks/References/Admin filters → yoğun
- Category tag: asset kartta 1 tane → minimal

**6. Empty states.** İkon + başlık + body + CTA; illüstrasyon yok. 40×40 tone-soft ikon kutu, 15/600 başlık, 13 muted body. Ton: yönlendirici — "İlk bookmark'ını ekle" eylemli.

**7. Trend Stories + Competitors.** Ortak: PageShell, Card (asset), Badge, Thumb, SectionTitle. Trend Stories story-card + cluster mosaic; Competitors tablo + store card. İkisi **keşif modu**; ayrışma: Trend story kartı preview açar, Competitor satırı analiz detayına navigate eder.

**8. Çekirdek 7 primitive.** Olmazsa hiçbir şey çalışmaz:
1. Button
2. Card
3. Badge
4. Thumb / AssetSurface
5. PageShell + Sidebar
6. StateMessage
7. Table

---

## KAPANIŞ DURUMU

### Görsel olarak kapanmış aileler
Bu aileler "tasarım dili tamam" sayılır; Claude Code bunları olduğu gibi implement edebilir.

- **Auth** (Login brand + form)
- **Bookmarks** (default + empty + loading)
- **References** (kart + koleksiyon filter + bulk ready)
- **Collections** (mosaic kartlar)
- **Admin density ailesi** (Users · Product Types · Feature Flags — aynı tablo grammar)
- **Sistem Katalog** (Confirm 3 tone · Empty 4 tone · Skeleton 3 density)

### Küçük revizyon isteyen
Küçük yön kararları (içerik listesi, copy, ikonografi detayı) sonraki turda işlenecek; temel dil kapanmış.

- **Dashboard** — stat seti final değil, widget kombinasyonu ve mikro grafik kararı sonraki tur (direction-level olarak bırakıldı)
- **Login register tab** — giriş tab'ı hi-fi; register tab'ı aynı shell içinde alan listesi netleşmeli

### Sonraki turda yalnızca derinleşecek
Temel yüzey kapandı; davranış/akış derinleşecek.

- **Competitors** → analiz detay drill-down (mağaza seçili → ürün listesi + review timeline + bookmark CTA)
- **Trend Stories** → story tap preview modal + trend cluster detay sayfası
- **Selection Studio** → edit uygulama iç akışı (loading + diff before/after)
- **Mockup Studio** → custom mockup upload modalı + koordinat düzenleme
- **Admin** → bulk action menüsünün her admin ekranında standardize davranışı

### Henüz dile girmemiş (Phase 3+)
Tasarım dili bunları taşıyacak kadar kararlı; sıra geldiğinde yeni keşif yerine **mevcut dili yayma** ile inşa edilecek.

- AI Review Queue (Human Review)
- Listing Builder (13 tag + title + description alanı)
- Publishing Queue (listing statü tablosu)
- Export Center (format seçici)
- Clipart Studio (bundle preview + sticker sheet)
- Prompt Playground (admin)
- Cost Usage, Audit Logs, Job Monitor detay
- Seasonal Calendar
- Recipes, Negative Library

---

## CARRY-FORWARD NOTLAR (implementation'a taşı)

1. **`Toggle` terfisi.** Şu an Admin Product Types + Admin Feature Flags'te kullanılıyor (2 yer). **Üçüncü admin ekranında tekrar edince** ürün primitive'ine terfi et (`primitives.jsx` altına `Toggle` olarak taşı, `on/onChange/size/disabled` prop'larıyla). Üçüncü kullanım gelene kadar ekran içi yardımcı kalır.

2. **Dashboard widget detayı + Login register tab.** Implementation'ın ilk turunda iki ekran dikkatle gözden geçirilecek:
   - **Dashboard** direction-level bırakıldı; widget seti, mikro grafik kararları ve drill-through linkler implementation sırasında kilitlenecek. Ana shell/stat hiyerarşisi değişmez.
   - **Login register tab** giriş tab'ı hi-fi; register tab'ının alan listesi (email + şifre + tekrar + marketing opt-in?) implementation'ın ilk turunda netleşecek.

3. **Yeni tasarım keşfi YOK.** Implementation sırasında onaylı dilin dışına çıkan yeni ekran/primitive/davranış tekliflerine kapalıyız. Yeni ihtiyaç çıkarsa → önce primitive/spec güncellenir, sonra uygulanır. Tek seferlik custom çözüm yasak.

---

## DOSYA HARİTASI

| Dosya | İçerik |
|---|---|
| `tokens.css` | CSS custom properties (color/space/radius/shadow/font) |
| `primitives.jsx` | Icon, Button, Badge, Chip, Input, Card, Thumb, StateMessage, Skeleton |
| `primitives-sheet.jsx` | UI Language Kit canlı showcase |
| `app-shell.jsx` | Sidebar + PageShell + topbar + toolbar + NavItem |
| `screens.jsx` | Dashboard, BookmarksGrid, AdminUsers, Login |
| `screens-b.jsx` | References, Collections, AdminProductTypes, AdminFeatureFlags, Competitors, TrendStories, SelectionStudio, MockupStudio, ConfirmDialogs, EmptyStates, SkeletonCatalog + helper'lar (Toggle, miniRow, MockupScene, DialogCard) |
| `tweaks-panel.jsx` | Sade tweaks paneli (accent + density) |
| `design-canvas.jsx` | Canvas shell |
| `EtsyHub Design Language.html` | 17 artboard canvas, tümünü birleştirir |
| `EtsyHub Design Spec.md` | Bu doküman |
