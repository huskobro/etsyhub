# Admin Feature Flags — Data Model Carry-Forward

Tarih: 2026-04-25
Bağlam: T-26 (CP-6 dalgası) — `src/features/admin/feature-flags/flags-table.tsx`
Table primitive migrasyonu. Canvas ile mevcut veri modeli arasında kalan açıklar
bu dokümanda kayıt altına alınır.

## Canvas hedefi

Canvas: `docs/design/EtsyHub/screens-b.jsx`, artboard `AdminFeatureFlags`
(satır 285-368). Satır yapısı:

| Kolon | İçerik |
| --- | --- |
| Flag | mono `key` (xs, muted) + ad (13/500) + açıklama (xs, muted) |
| Kapsam | Badge tone="neutral": `admin` / `user` |
| Ortam | Badge tone="info" (prod) veya "warning" (dev) |
| Durum | Badge dot, tone: on→success, off→neutral, rollout→warning, beta→info |
| Rollout | `<RolloutBar percent={N}>` + sağda mono `NN%` |
| Toggle | yerel `admin/_shared/toggle.tsx` |
| `⋯` | Action menu (Menu primitive gelince aktifleşir) |

Toolbar chip'leri: `Tümü · 7`, `Prod · X`, `Dev · X`, `Açık · X`, `Rollout · X`.

## Mevcut veri modeli (prisma)

`model FeatureFlag`:
- `id: String`
- `key: String @unique`
- `enabled: Boolean`
- `scope: FeatureFlagScope` (enum: `admin` | `user`)
- `metadata: Json?`
- `createdAt`, `updatedAt`

## Açık: eksik alanlar

Canvas'ta var, veri modelinde yok:

| Alan | Canvas | Mevcut | T-26 Placeholder |
| --- | --- | --- | --- |
| `name` (display name) | var | yok (`metadata.name` fallback) | `displayName(row)` — `metadata.name` varsa onu, yoksa `key`'i pretty-format |
| `description` | var | yok (`metadata.description` fallback) | truthy guard, boşsa gizle |
| `state` (4 state: ON/OFF/ROLLOUT/BETA) | var | yok (sadece `enabled: Boolean`) | 2-state fallback: `enabled ? "Açık" : "Kapalı"` |
| `rolloutPercent` | var | yok | proxy: `enabled ? 100 : 0` |
| `env` (PROD/DEV) | var | yok | **kolon çıkarıldı**; subtitle da `X flag · Y açık` (prod açık değil) |

## Gerekli migration (carry-forward)

```prisma
enum FeatureFlagState {
  ON
  OFF
  ROLLOUT
  BETA
}

enum FeatureFlagEnv {
  PROD
  DEV
}

model FeatureFlag {
  // ...mevcut alanlar
  name            String?
  description     String?
  state           FeatureFlagState  @default(OFF)
  rolloutPercent  Int               @default(0)
  env             FeatureFlagEnv    @default(PROD)
}
```

Migration sırası:
1. Prisma schema'ya alanlar eklenir (non-nullable alanlar için default'larla).
2. Backfill script'i mevcut `enabled` boolean'ını `state` ile senkronlar
   (`true → ON`, `false → OFF`).
3. Admin panelinde `state` dropdown'u ve rollout slider'ı aktifleşir; `enabled`
   boolean'ı geçici tutulur (backward-compat), sonraki dalgada düşürülür.
4. Canvas'ta saklı olan `Prod / Dev / Rollout` chip'leri toolbar'a geri döner;
   subtitle "X flag · Y prod açık · Z rollout" gramerine geçer.

## Rollout bar yerel bileşen kararı

Dosya: `src/features/admin/feature-flags/_shared/rollout-bar.tsx`.

Kural (brief 5.1 carry-forward #1 ile aynı disiplin):
> Tek tüketici (FlagsTable) olduğu sürece yerel. 2. tüketici (örn. Admin
> Cost Usage'daki quota progress bar) geldiği sprintte
> `src/components/ui/progress-bar.tsx` altına terfi edilir; sözleşme korunur:
> `percent: number (0-100)`, `aria-label?: string`.

Yasak: "ileride lazım olur" gerekçesiyle erken terfi. Primitive sözleşmesi
2. kullanım ortaya çıkmadan olgunlaşmaz.

Token disiplini notu: `RolloutBar` doldurulmuş barın dinamik genişliği için
`style={{ width: \`${clamped}%\` }}` kullanır — bu, Tailwind arbitrary value
(`w-[42%]`) yasağının **kasıtlı** escape hatch'idir. Dosya
`scripts/check-tokens.ts` whitelist'ine eklendi; terfi sırasında hem whitelist
girişi yeni path'e taşınır, hem de yorum eşlik eder.

## Toggle kullanım kaydı

| Sprint | Ekran | Kullanım |
| --- | --- | --- |
| T-25 | Admin Product Types | 1. kullanım — `disabled`, backend'de `enabled` alanı yok |
| T-26 | Admin Feature Flags | 2. kullanım — **gerçek PATCH mutation aktif** |
| (gelecek) | 3. admin ekranı | 3. kullanım → `src/components/ui/Toggle.tsx` terfi tetiklenir |

Kurallar:
- Toggle'ın 3. tüketicisi ortaya çıktığı sprintte (örn. Admin Themes veya
  Feature Flags'e ek kontrollerin eklenmesi sırasında **değil**, 3. ayrı ekran
  tüketimiyle) primitive katmanına terfi edilir.
- Sözleşme terfide korunur: `on: boolean`, `onChange: (next: boolean) => void`,
  `size?: "sm" | "md"`, `disabled?: boolean`, `aria-label?: string`.
- Terfi sırasında iki mevcut tüketici (product-types + feature-flags) aynı
  commit'te yeni import path'ine taşınır; yerel `_shared/toggle.tsx` silinir.

## Canvas sapmaları (bu sprintte kilitli)

1. **Env kolonu yok** — veri modelinde `env` yok. Canvas'taki 2. Badge kolonu
   çıkarıldı.
2. **State yalnız 2 değer** — `ROLLOUT` ve `BETA` tone'ları (`warning`, `info`)
   migration öncesi erişilebilir değil; `success` ve `neutral` ile yetiniliyor.
3. **Rollout proxy** — gerçek rollout yüzdesi yerine `enabled ? 100 : 0`.
   RolloutBar görsel olarak yerinde duruyor, bu sayede migration sonrası
   gerçek değer bağlandığında tablo düzeni değişmez.
4. **Toolbar chip'leri 3'e indi** — `Prod / Dev / Rollout` chip'leri yok.
   Test (`admin-feature-flags-page.test.tsx`, senaryo 4) bu sapmayı testle
   kilitler; migration sonrası test güncellenir ve chip'ler eklenir.
5. **"Yeni flag" CTA disabled** — `POST /api/admin/feature-flags` yok.
   `title="Yakında"` bilgilendirme veriyor; endpoint eklendiği sprintte aktif
   edilir.
6. **Action `⋯` disabled** — Menu primitive yok (brief kısıtı). Primitive
   geldiği sprintte aktive edilir.
