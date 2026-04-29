# Phase 7+ / Mockup Studio — Hazırlık Notu

**Tarih:** 2026-04-30
**Durum:** Hazırlık (Phase 7 brainstorming/planning öncesi referans)

> Bu dosya implementasyon değil; Phase 7 (Selection Studio) ve Phase 8
> (Mockup Studio) brainstorming + planlama turlarına girildiğinde
> **birincil yerel tasarım kaynağı**'na işaret eden referans notu.

## Birincil Yerel Tasarım Kaynağı

`docs/design/EtsyHub_mockups/` — **bu klasör Phase 7 ve Phase 8
brainstorming / planlama / implementation aşamalarında aktif referans
olarak kullanılacak.** "İleride bakarız" değil; ilk adımda açılacak.

**Anlamlı içerik (mevcut dosyalar):**

| Dosya | Tip | İçerik |
|-------|-----|--------|
| `EtsyHub Design Language.html` | HTML | Genel tasarım dili kuralları (renk paleti, spacing, tipografi, primitive'ler) |
| `EtsyHub Design Spec.md` | Markdown | Tasarım spec'i — okuma sırası başlangıçta bu dosya |
| `tokens.css` | CSS | Design token değerleri (renk/spacing/radius/shadow) — proje `check:tokens` disiplinine kaynak |
| `primitives.jsx` | React/JSX | Buton, input, badge, vs. base primitive component'ler |
| `primitives-sheet.jsx` | JSX | Drawer/sheet primitive — Phase 6 review drawer ile karşılaştırma için |
| `app-shell.jsx` | JSX | Sidebar + üst bar genel layout |
| `screens.jsx`, `screens-b.jsx` | JSX | Genel ekran mockup'ları (dashboard, references, vb.) |
| `Mockup Studio Spec.html` | HTML | **Phase 8 Mockup Studio sayfa spec'i** — birincil kaynak |
| `Mockup Studio Hi-Fi.html` | HTML | Phase 8 yüksek-fidelite mockup'ı — görsel referans |
| `mockup-studio-screens-a.jsx`, `-b.jsx` | JSX | Mockup Studio ekran varyantları (canvas/wall art, clipart, sticker) |
| `mockup-studio-shared.jsx` | JSX | Mockup Studio ortak component'ler |
| `mockup-studio.css` | CSS | Mockup Studio'ya özel stil katmanı |
| `design-canvas.jsx` | JSX | Tasarım canvas — Phase 7 Selection Studio için referans olabilir (background removal, color editor, crop UI) |
| `tweaks-panel.jsx` | JSX | Yan panel tweaking UI — Phase 7 için drawer/panel paterni |

## Kullanım Kuralları

1. **Phase 7 (Selection Studio) brainstorming başlatıldığında:**
   - İlk adım `docs/design/EtsyHub_mockups/EtsyHub Design Spec.md` okumak
   - `design-canvas.jsx` + `tweaks-panel.jsx` Selection Studio için yön verir
   - `tokens.css` Phase 6'da kullanılan token alias'larıyla uyumlu olmalı (drift yoksa direkt reuse)

2. **Phase 8 (Mockup Studio) brainstorming başlatıldığında:**
   - `Mockup Studio Spec.html` birincil kaynak — kapsam, mod listesi
     (canvas/wall art, clipart bundle, sticker sheet, custom upload),
     UI akışı buradan çıkar
   - `Mockup Studio Hi-Fi.html` görsel referans — pixel-level detay
     gerektiğinde
   - `mockup-studio-screens-{a,b}.jsx` + `mockup-studio-shared.jsx`
     component decomposition için yön
   - `mockup-studio.css` token kullanımı — proje token disiplinine
     adapte (check:tokens kuralları)

3. **Genel tasarım dili:**
   - `EtsyHub Design Language.html` ve `tokens.css` Phase 1-6 boyunca
     kuruldu. Phase 7+ yeni token eklemesi gerekiyorsa önce mevcut
     alias'ları kontrol et (Phase 6 Dalga A reviewer notu: hardcoded
     renk yasağı `check:tokens` ile zorunlu)
   - `primitives.jsx` ve `app-shell.jsx` Phase 1'de büyük ölçüde
     implement edildi; mockup ile mevcut kod arasındaki farklar
     brainstorming'de tespit edilmeli

## Phase 6'dan Devralınan Bağlam

Phase 6'dan Phase 7+'a taşınan UI patternları:
- **Drawer (sağ slide-over):** `ReviewDetailPanel.tsx` paterni
  (role="dialog" aria-modal, ESC + backdrop close, useFocusTrap)
- **TypingConfirmation primitive:** `src/components/ui/TypingConfirmation.tsx`
  — destructive bulk action confirmation (phrase="SİL")
- **BulkActionsBar:** sticky bottom + scope-conditional actions
- **Selection store (Zustand):** `src/features/review/stores/selection-store.ts`
  — multi-select pattern, scope/page auto-clear
- **StateMessage primitive:** loading/error/empty state'ler için
  (Phase 6 Dalga A a11y kapanışında reviewer paterniyle hizalandı)

## Phase 6 Carry-Forward Etkileri

Phase 7'ye geçişte aşağıdaki carry-forward'lar hatırlanmalı (closeout
doc'tan):
- `fix-with-ai-actions` — Phase 7 Selection Studio'nun review queue'ya
  bağlanma noktası (drawer'dan "Fix with AI" butonu)
- Phase 6 Dalga B reviewer önerisi B2 (`BulkActionBar` primitive
  reuse): Phase 7'de yeni bulk action ekleyeceksek mevcut primitive
  paterni izle

## Kullanım Discipline'i

Bu hazırlık notu **işaret levhası** — implementasyon başladığında bu
klasör açılır, tasarım kararları buradan türetilir, brainstorming
turunda design spec okuma adımı atlanmaz. Bu disiplin Phase 6'da
"hard reject motoru DEĞİL" felsefesinin Phase 7+'da görsel kararlara
yansıması için aynı netlikte takip edilecek.
