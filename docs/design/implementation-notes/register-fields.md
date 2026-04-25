# Register — Alan Listesi Kararı

**Tarih:** 2026-04-25
**Bağlam:** T-29 (Register tab) öncesi, brief carry-forward #3 gereği alan
listesi kod yazılmadan önce kilitlenir.
**Status:** Kilitli.

## Karar

Register form'u **3 alan** ile sınırlı kalır:

1. `email` — `z.string().email()` (zorunlu)
2. `password` — `z.string().min(8)` (zorunlu)
3. `name` — `z.string().max(120).optional()` (opsiyonel)

Bu alan listesi mevcut `POST /api/auth/register`
([src/app/api/auth/register/route.ts](src/app/api/auth/register/route.ts))
sözleşmesiyle **birebir** uyumludur. Backend tarafında değişiklik yok.

## Kapsam dışı bırakılan alanlar

| Alan | Niye yok |
|---|---|
| Mağaza adı / shop URL | Ayrı `Store` modeli var; onboarding wizard'ında bağlanır (Phase 1+ scope) |
| Niche / target audience | `Store.brandVoice` profil alanı; register kapsamı değil |
| Tone / preferred style | Aynı şekilde Store profile |
| Etsy bağlantısı | OAuth flow ayrı ekran (`/settings/etsy`) |
| Şifre tekrarı | UX kalabalığı; modern tek-input pattern + "Göster/gizle" toggle (Phase 2'de) |
| Kullanım koşulları checkbox | Localhost-first MVP; legal kapsamı henüz yok |
| Davet kodu | Davet API yok (T-24 Davet CTA disabled mantığı bu kararla aynı) |

## Form davranışı

- **Submit yolu:** Mevcut `POST /api/auth/register` aynen kullanılır
- **Hata haritası:**
  - 400: "Geçersiz istek" (email format / password length)
  - 403: "Kayıt şu an kapalı" (`registration.enabled` flag)
  - 409: "Bu e-posta kullanımda"
- **Başarı sonrası:** `/login` redirect (auto-login YOK, e-posta doğrulama gerekli olabileceğinden saklı)
- **A11y:** Email autocomplete `email`, password autocomplete `new-password`,
  name autocomplete `name`. `aria-invalid` + inline error span Türkçe mesajla.

## Login ile ortak kabuk

Login + Register **tek sayfa, tab switch** olarak render edilecek (canvas
direction: `screens.jsx` SCREEN 4). Tab değişimi URL search param ile
(`?mode=register`) — sayfa yenilenmeden geçiş, ama paylaşılabilir link.

## Tetikleyici (alan eklemek istersek)

Aşağıdaki sinyallerden **ikisi** birleştiğinde register alan listesi
yeniden açılır:

1. Davet API canlı (`Invite` modeli + endpoint) → davet kodu alanı
2. Onboarding wizard kararı → "register'da niche sor" kararı verilirse
3. Etsy OAuth ilk-tıklama akışı → "register sırasında store bağla" tasarımı

Bu sinyallerin **tek başına** yetmez; biri çıksa diğer alan listesini
aramayı tetikler ama register'a alan eklemez. Onboarding gibi ardışık
adımlar register sonrası `/onboarding` rotasında çözülür.

## Test sözleşmesi

- `tests/unit/register-form.test.tsx` (T-29'da yazılır):
  - Email/password/name input'ları render olur, autocomplete doğru
  - Submit fail (400/403/409) → Türkçe inline error
  - Submit success → `/login` redirect

## Yasak

- "Bu da olsa fena olmaz" mantığıyla alan eklemek
- Backend'i değiştirmeden frontend-only alan eklemek (sözleşme
  kayması yaratır)
- Şifre tekrarı (`passwordConfirm`) eklemek — modern UX değil ve
  backend zaten beklemiyor

Bu liste **kilitli**. T-29 implementer'ı bu listeden sapmaz.
