// R11 — Dev-only primitives showcase. Static generation timeout
// (build SSG'de tüm UI primitive'lerini render etmeye çalışıyor).
// Force dynamic — production build'de SSG'ye girmesin.
export const dynamic = "force-dynamic";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/ui/FormField";
import { Badge, Tag, type BadgeTone } from "@/components/ui/Badge";
import { ChipFilterDemo, ChipRemovableDemo } from "./ChipDemo";
import { Skeleton, SkeletonCardGrid, SkeletonTable } from "@/components/ui/Skeleton";
import { StateMessage } from "@/components/ui/StateMessage";
import { Thumb, type ThumbKind } from "@/components/ui/Thumb";
import { Card, StatCardBody, AssetCardMeta } from "@/components/ui/Card";
import { NavItem } from "@/components/ui/NavItem";
import {
  Sidebar,
  SidebarGroup,
  SidebarBrand,
} from "@/components/ui/Sidebar";
import { PageShell } from "@/components/ui/PageShell";
import { Toolbar } from "@/components/ui/Toolbar";
import { FilterBar } from "@/components/ui/FilterBar";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { BulkBarDemo } from "./BulkBarDemo";
import { Chip } from "@/components/ui/Chip";

/**
 * Primitives showcase — spec "Primitives showcase" artboard karşılığı.
 * Geliştirme aracı; canvas artboard ile yan yana görsel eşleşme kontrolü için.
 */

const VARIANTS = ["primary", "secondary", "ghost", "destructive"] as const;
const SIZES = ["sm", "md", "lg"] as const;
const THUMB_KINDS: ThumbKind[] = [
  "boho",
  "christmas",
  "nursery",
  "poster",
  "clipart",
  "sticker",
  "abstract",
  "landscape",
  "neutral",
];
const BADGE_TONES: BadgeTone[] = ["neutral", "accent", "success", "warning", "danger", "info"];
const BADGE_LABELS: Record<BadgeTone, string> = {
  neutral: "Clipart",
  accent: "Seçili",
  success: "Yayında",
  warning: "Review",
  danger: "Reddedildi",
  info: "Taslak",
};

function PlusIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 13l-2.8-2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function DotsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="3" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="13" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

function BookmarkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 3h10v18l-5-4-5 4V3z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UnplugIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 2v6M16 2v6M12 10v6M12 16a4 4 0 0 1-4-4V8h8v4a4 4 0 0 1-4 4zM12 22v-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-mono text-xs tracking-wide text-text-muted">{title}</h2>
      <div className="rounded-lg border border-border-subtle bg-surface p-5 shadow-card">
        {children}
      </div>
    </section>
  );
}

export default function PrimitivesShowcasePage() {
  return (
    <main className="mx-auto max-w-content px-6 py-8 space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-xs tracking-wide text-text-muted">Dev · Primitives Showcase</p>
        <h1 className="text-2xl font-semibold">Button</h1>
        <p className="text-text-muted">Spec A.2.2 — variant × size × state matrisi. Canvas artboard ile eşleşme kontrolü için.</p>
      </header>

      <Section title="Variant × Size Matrix">
        <div className="space-y-4">
          {VARIANTS.map((variant) => (
            <div key={variant} className="flex items-center gap-4">
              <span className="w-24 font-mono text-xs tracking-wide text-text-subtle">{variant}</span>
              <div className="flex items-center gap-3">
                {SIZES.map((size) => (
                  <Button key={size} variant={variant} size={size}>
                    Buton {size}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Icon + Text · md">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={<PlusIcon />}>Yeni</Button>
          <Button variant="secondary" icon={<PlusIcon />}>Ekle</Button>
          <Button variant="ghost" icon={<PlusIcon />}>İthal et</Button>
          <Button variant="secondary" iconRight={<ArrowRightIcon />}>İleri</Button>
          <Button variant="destructive" icon={<PlusIcon />}>Arşivle</Button>
        </div>
      </Section>

      <Section title="Icon-only · kare ölçü (sm/md/lg)">
        <div className="space-y-3">
          {VARIANTS.map((variant) => (
            <div key={variant} className="flex items-center gap-4">
              <span className="w-24 font-mono text-xs tracking-wide text-text-subtle">{variant}</span>
              <div className="flex items-center gap-3">
                <Button variant={variant} size="sm" icon={<DotsIcon size={12} />} aria-label="Daha fazla" />
                <Button variant={variant} size="md" icon={<DotsIcon />} aria-label="Daha fazla" />
                <Button variant={variant} size="lg" icon={<DotsIcon size={16} />} aria-label="Daha fazla" />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="State · disabled / loading">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled>Disabled primary</Button>
          <Button variant="secondary" disabled>Disabled secondary</Button>
          <Button variant="ghost" disabled>Disabled ghost</Button>
          <Button variant="destructive" disabled>Disabled destructive</Button>
          <Button variant="primary" loading>Yükleniyor</Button>
          <Button variant="secondary" loading>Yükleniyor</Button>
          <Button variant="primary" size="md" loading aria-label="Yükleniyor" />
        </div>
      </Section>

      <Section title="Focus ring kontrolü">
        <p className="mb-3 text-sm text-text-muted">Tab tuşu ile gezinerek accent ring 2px offset görünmeli.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>
      </Section>

      <header className="space-y-1 pt-4">
        <h1 className="text-2xl font-semibold">Input / Textarea</h1>
        <p className="text-text-muted">Spec A.2.3 — 34h, radius md, prefix/suffix. Focus: accent border (ring yok).</p>
      </header>

      <Section title="Input · default / prefix / suffix / icon-only prefix">
        <div className="grid grid-cols-2 gap-4 max-w-3xl">
          <Input placeholder="Başlık" />
          <Input prefix="@" placeholder="kullanici-adi" />
          <Input prefix={<SearchIcon />} placeholder="Ara" />
          <Input placeholder="0,00" suffix={<span className="font-mono text-sm text-text-muted">USD</span>} />
        </div>
      </Section>

      <Section title="Input · state (default / error / disabled)">
        <div className="grid grid-cols-2 gap-4 max-w-3xl">
          <Input placeholder="Default" defaultValue="Ayşe Yılmaz" />
          <Input state="error" defaultValue="geçersiz@mail" />
          <Input disabled defaultValue="Salt okunur değer" />
          <Input disabled placeholder="Boş disabled" />
        </div>
      </Section>

      <Section title="Textarea · default / min-h-textarea / error / disabled">
        <div className="grid grid-cols-2 gap-4 max-w-3xl">
          <Textarea placeholder="Açıklama yazın..." />
          <Textarea state="error" defaultValue="Çok kısa bir değer" />
          <Textarea disabled defaultValue="Disabled textarea içeriği" />
          <Textarea placeholder="Uzun içerik için vertical resize kullanılabilir" />
        </div>
      </Section>

      <Section title="FormField composition (label + description + error)">
        <div className="grid grid-cols-2 gap-4 max-w-3xl">
          <FormField label="Mağaza adı" description="Etsy mağazanızın açık adı." required>
            <Input placeholder="WarmWallArtCo" />
          </FormField>
          <FormField label="E-posta" error="Geçerli bir e-posta giriniz.">
            <Input type="email" defaultValue="bozuk@mail" />
          </FormField>
          <FormField label="Liste açıklaması" description="Etsy listing açıklaması; markdown yok.">
            <Textarea placeholder="Açıklama..." />
          </FormField>
          <FormField label="Not" error="Not boş bırakılamaz.">
            <Textarea defaultValue="" />
          </FormField>
        </div>
      </Section>

      <header className="space-y-1 pt-4">
        <h1 className="text-2xl font-semibold">Badge / Chip / Tag</h1>
        <p className="text-text-muted">
          Spec A.2.5 — Badge 20h mono tracking-meta, title-case kilidi; Chip 28h filter/toggle; Tag = neutral badge alias.
        </p>
      </header>

      <Section title="Badge · tone matrisi (6)">
        <div className="flex flex-wrap items-center gap-2">
          {BADGE_TONES.map((tone) => (
            <Badge key={tone} tone={tone}>
              {BADGE_LABELS[tone]}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Badge · dot slot">
        <div className="flex flex-wrap items-center gap-2">
          {BADGE_TONES.map((tone) => (
            <Badge key={tone} tone={tone} dot>
              {BADGE_LABELS[tone]}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Badge · title-case kilidi (uppercase YOK)">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">Published</Badge>
          <Badge tone="warning">Needs Review</Badge>
          <Badge tone="danger">Rejected</Badge>
          <Badge tone="info">Draft</Badge>
          <Badge tone="accent">iPhone case</Badge>
        </div>
        <p className="mt-3 font-mono text-xs tracking-wide text-text-subtle">
          children render edildiği gibi gösterilir · normal-case sabit · tracking-meta 0.6px
        </p>
      </Section>

      <Section title="Tag · thumbnail altı neutral badge">
        <div className="flex flex-wrap items-center gap-2">
          <Tag>Clipart</Tag>
          <Tag>Wall art</Tag>
          <Tag>Sticker</Tag>
          <Tag>Printable</Tag>
          <Tag dot>SVG</Tag>
        </div>
      </Section>

      <Section title="Chip · filter toggle (active → accent-soft)">
        <ChipFilterDemo />
      </Section>

      <Section title="Chip · removable (aktif + kaldır slotu)">
        <ChipRemovableDemo />
      </Section>

      <header className="space-y-1 pt-4">
        <h1 className="text-2xl font-semibold">Skeleton</h1>
        <p className="text-text-muted">
          Spec A.2.7 — surface-3 + ehPulse. Shimmer YOK. User grid 6 kart · admin tablo 5 satır sabit.
        </p>
      </header>

      <Section title="Skeleton · atomic (line / text / rect / circle)">
        <div className="max-w-md space-y-3">
          <Skeleton shape="line" />
          <Skeleton shape="text" />
          <div className="flex items-center gap-3">
            <Skeleton shape="circle" />
            <div className="flex-1 space-y-2">
              <Skeleton shape="text" />
              <Skeleton shape="line" className="w-1/2" />
            </div>
          </div>
          <Skeleton shape="rect" />
        </div>
      </Section>

      <Section title="SkeletonCardGrid · user density (6 sabit kart)">
        <SkeletonCardGrid />
      </Section>

      <Section title="SkeletonTable · admin density (5 sabit satır)">
        <SkeletonTable />
      </Section>

      <header className="space-y-1 pt-4">
        <h1 className="text-2xl font-semibold">StateMessage</h1>
        <p className="text-text-muted">
          Spec A.2.8 — 3 tone (neutral/warning/error), 40×40 tone-soft ikon kutusu, 15/600 title, 13 muted body (max-w 360), opsiyonel CTA.
        </p>
      </header>

      <Section title="StateMessage · 3 tone (empty catalog)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-md border border-border bg-surface">
            <StateMessage
              tone="neutral"
              icon={<BookmarkIcon />}
              title="Henüz bookmark yok"
              body="Gezinirken beğendiğin listingleri buraya ekle; ileride referansa taşıyabilirsin."
              action={<Button variant="primary" size="sm">{"İlk bookmark'ı ekle"}</Button>}
            />
          </div>
          <div className="rounded-md border border-border bg-surface">
            <StateMessage
              tone="warning"
              icon={<AlertIcon />}
              title="Review kuyruğu temiz"
              body="Şu an incelenecek tasarım yok. Yeni üretim başlayınca burada gösterilir."
            />
          </div>
          <div className="rounded-md border border-border bg-surface">
            <StateMessage
              tone="error"
              icon={<UnplugIcon />}
              title="Etsy bağlantısı kurulamadı"
              body="Token süresi dolmuş olabilir. Ayarlar → Mağazalar sayfasından yeniden bağla."
              action={<Button variant="secondary" size="sm">Yeniden bağla</Button>}
            />
          </div>
        </div>
      </Section>

      <header className="space-y-1 pt-4">
        <h1 className="text-2xl font-semibold">Thumb / AssetSurface</h1>
        <p className="text-text-muted">
          Spec A.2.9 — 9 kind fallback, 3 aspect, hover scale-subtle (sadece yüzey), selected accent outer ring.
        </p>
      </header>

      <Section title="Thumb · 9 kind (aspect card 4/3)">
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {THUMB_KINDS.map((kind) => (
            <div key={kind} className="space-y-1">
              <Thumb kind={kind} aspect="card" />
              <p className="font-mono text-xs tracking-wide text-text-subtle text-center">
                {kind}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Thumb · aspect (card / portrait / square)">
        <div className="grid grid-cols-3 gap-3 max-w-2xl">
          <div className="space-y-1">
            <Thumb kind="abstract" aspect="card" />
            <p className="font-mono text-xs tracking-wide text-text-subtle text-center">card 4/3</p>
          </div>
          <div className="space-y-1">
            <Thumb kind="nursery" aspect="portrait" />
            <p className="font-mono text-xs tracking-wide text-text-subtle text-center">portrait 2/3</p>
          </div>
          <div className="space-y-1">
            <Thumb kind="clipart" aspect="square" />
            <p className="font-mono text-xs tracking-wide text-text-subtle text-center">square 1/1</p>
          </div>
        </div>
      </Section>

      <Section title="Thumb · selected + overlay slot">
        <div className="grid grid-cols-3 gap-3 max-w-xl">
          <Thumb kind="poster" selected />
          <Thumb kind="sticker" overlay={<Badge tone="accent">Seçili</Badge>} />
          <Thumb kind="neutral" label="Önizleme yok" />
        </div>
      </Section>

      <header className="space-y-1 pt-4">
        <h1 className="text-2xl font-semibold">Card</h1>
        <p className="text-text-muted">
          Spec A.2.3 — stat / asset / list; hover border-strong + shadow-card-hover; kart kutusu scale etmez.
        </p>
      </header>

      <Section title="Card · Stat (mono label + 3xl numeral + trend badge)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="stat">
            <StatCardBody
              label="Yayındaki listing"
              value="248"
              trend={<Badge tone="success" dot>+12</Badge>}
            />
          </Card>
          <Card variant="stat">
            <StatCardBody
              label="Review bekleyen"
              value="17"
              trend={<Badge tone="warning">Review</Badge>}
            />
          </Card>
          <Card variant="stat" selected>
            <StatCardBody
              label="Aylık gelir"
              value="$4.280"
              trend={<Badge tone="accent" dot>Seçili</Badge>}
            />
          </Card>
        </div>
      </Section>

      <Section title="Card · Asset (p-0 · aspect-card full-bleed · 12px meta pad)">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card variant="asset" interactive>
            <Thumb kind="boho" hoverable />
            <AssetCardMeta>
              <h3 className="text-sm font-medium truncate">Boho Sun Wall Art</h3>
              <div className="flex items-center gap-2">
                <Tag>Wall art</Tag>
                <span className="font-mono text-xs text-text-subtle truncate">etsy.com/...</span>
              </div>
            </AssetCardMeta>
          </Card>
          <Card variant="asset" interactive selected>
            <Thumb kind="christmas" hoverable selected />
            <AssetCardMeta>
              <h3 className="text-sm font-medium truncate">Christmas Joy Poster</h3>
              <div className="flex items-center gap-2">
                <Tag>Poster</Tag>
                <span className="font-mono text-xs text-text-subtle truncate">etsy.com/...</span>
              </div>
            </AssetCardMeta>
          </Card>
          <Card variant="asset" interactive>
            <Thumb kind="clipart" hoverable />
            <AssetCardMeta>
              <h3 className="text-sm font-medium truncate">Clipart Bundle 25 PNG</h3>
              <div className="flex items-center gap-2">
                <Tag>Clipart</Tag>
                <span className="font-mono text-xs text-text-subtle truncate">etsy.com/...</span>
              </div>
            </AssetCardMeta>
          </Card>
          <Card variant="asset" interactive>
            <Thumb kind="nursery" hoverable />
            <AssetCardMeta>
              <h3 className="text-sm font-medium truncate">Nursery Little One</h3>
              <div className="flex items-center gap-2">
                <Tag>Printable</Tag>
                <span className="font-mono text-xs text-text-subtle truncate">etsy.com/...</span>
              </div>
            </AssetCardMeta>
          </Card>
        </div>
        <p className="mt-3 font-mono text-xs tracking-wide text-text-subtle">
          Hover: kart border-strong + shadow-card-hover · thumbnail scale-subtle (1.015×) · kart kutusu scale etmez
        </p>
      </Section>

      <Section title="Card · List (sol thumb + sağ meta, selected = accent-soft)">
        <div className="space-y-2 max-w-2xl">
          <Card variant="list" interactive>
            <div className="w-12 shrink-0">
              <Thumb kind="abstract" aspect="square" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Abstract Warm Tones</div>
              <div className="font-mono text-xs text-text-subtle">etsy.com/listing/8421</div>
            </div>
            <Badge tone="success">Yayında</Badge>
          </Card>
          <Card variant="list" interactive selected>
            <div className="w-12 shrink-0">
              <Thumb kind="sticker" aspect="square" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Good Vibes Sticker</div>
              <div className="font-mono text-xs text-text-subtle">etsy.com/listing/7712</div>
            </div>
            <Badge tone="accent">Seçili</Badge>
          </Card>
          <Card variant="list" interactive>
            <div className="w-12 shrink-0">
              <Thumb kind="landscape" aspect="square" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Mountain Landscape Print</div>
              <div className="font-mono text-xs text-text-subtle">etsy.com/listing/9904</div>
            </div>
            <Badge tone="warning">Review</Badge>
          </Card>
        </div>
      </Section>

      <Section title="NavItem — state matrix (inactive / active / disabled)">
        <div className="max-w-xs space-y-0.5 bg-surface-2 p-2 rounded-md">
          <NavItem href="#dashboard" label="Panel" icon={<BookmarkIcon size={14} />} />
          <NavItem href="#bookmarks" label="Bookmark" icon={<BookmarkIcon size={14} />} badge="84" active />
          <NavItem href="#references" label="Referanslar" icon={<BookmarkIcon size={14} />} badge="27" />
          <NavItem href="#variations" label="Üret" icon={<BookmarkIcon size={14} />} disabled meta="P5" />
        </div>
      </Section>

      <Section title="PageShell — user density · mini preview">
        <div className="h-96 overflow-hidden rounded-md border border-border">
          <PageShell
            className="h-full"
            density="user"
            sidebar={
              <Sidebar
                className="h-full"
                brand={<SidebarBrand name="Kivasy" />}
                footer={
                  <>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 font-mono text-xs font-semibold">
                      HC
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">Hüseyin Coşkun</div>
                      <div className="font-mono text-xs text-text-subtle">Üretici</div>
                    </div>
                  </>
                }
              >
                <SidebarGroup title="Üretim">
                  <NavItem href="#dash" label="Panel" icon={<BookmarkIcon size={14} />} active />
                  <NavItem href="#trend" label="Trend Akışı" icon={<BookmarkIcon size={14} />} badge="12" />
                  <NavItem href="#comp" label="Rakipler" icon={<BookmarkIcon size={14} />} />
                </SidebarGroup>
                <SidebarGroup title="Kütüphane">
                  <NavItem href="#book" label="Bookmark" icon={<BookmarkIcon size={14} />} badge="84" />
                  <NavItem href="#ref" label="Referanslar" icon={<BookmarkIcon size={14} />} badge="27" />
                </SidebarGroup>
                <SidebarGroup>
                  <NavItem href="#set" label="Ayarlar" icon={<BookmarkIcon size={14} />} />
                </SidebarGroup>
              </Sidebar>
            }
            title="Bookmark"
            subtitle="84 kayıt · 12 koleksiyon"
            actions={
              <>
                <Button variant="ghost" size="sm" icon={<SearchIcon />}>Ara</Button>
                <Button variant="primary" size="sm" icon={<PlusIcon />}>Yeni bookmark</Button>
              </>
            }
            toolbar={
              <div className="flex items-center gap-2">
                <Tag>Wall art</Tag>
                <Tag>Clipart</Tag>
                <Tag>Nursery</Tag>
              </div>
            }
          >
            <div className="grid grid-cols-3 gap-4">
              <Card variant="asset" interactive>
                <Thumb kind="boho" />
                <AssetCardMeta>
                  <div className="text-sm font-medium truncate">Boho wall art set</div>
                </AssetCardMeta>
              </Card>
              <Card variant="asset" interactive>
                <Thumb kind="clipart" />
                <AssetCardMeta>
                  <div className="text-sm font-medium truncate">Clipart bundle</div>
                </AssetCardMeta>
              </Card>
              <Card variant="asset" interactive>
                <Thumb kind="sticker" />
                <AssetCardMeta>
                  <div className="text-sm font-medium truncate">Sticker sheet</div>
                </AssetCardMeta>
              </Card>
            </div>
          </PageShell>
        </div>
      </Section>

      <Section title="Toolbar — standalone (leading + children + trailing + divider)">
        <Toolbar
          standalone
          leading={
            <div className="w-64">
              <Input placeholder="Başlık, tag veya kaynakta ara" />
            </div>
          }
          trailing={
            <>
              <Button variant="ghost" size="sm">
                Filtre
              </Button>
              <Button variant="secondary" size="sm">
                Grid
              </Button>
            </>
          }
        >
          <FilterBar>
            <Chip active>Tümü · 84</Chip>
            <Chip>Wall art · 31</Chip>
            <Chip>Clipart · 22</Chip>
            <Chip>Printable · 18</Chip>
          </FilterBar>
        </Toolbar>
      </Section>

      <Section title="FilterBar — clear all davranışı">
        <div className="space-y-3">
          <FilterBar clearLabel="Temizle" onClearAll={() => {}}>
            <Chip active>Wall art</Chip>
            <Chip active>Nursery</Chip>
            <Chip>Clipart</Chip>
            <Chip>Sticker</Chip>
          </FilterBar>
          <div className="font-mono text-xs text-text-subtle">
            clearLabel + onClearAll verilmişse sağda mono Temizle butonu
            otomatik yerleşir.
          </div>
        </div>
      </Section>

      <Section title="BulkActionBar — canlı görünürlük + dismiss (selectedCount > 0 iken render eder)">
        <BulkBarDemo />
      </Section>

      <Section title="BulkActionBar — sticky=true (uzun scroll içinde yukarıda kalır)">
        <div className="h-48 overflow-auto rounded-md border border-border bg-surface p-3">
          <BulkActionBar
            sticky
            selectedCount={2}
            label="2 öğe seçildi"
            actions={
              <>
                <Button variant="ghost" size="sm">
                  Referansa ekle
                </Button>
                <Button variant="ghost" size="sm">
                  Arşivle
                </Button>
              </>
            }
            onDismiss={() => {}}
          />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="rounded-sm border border-border-subtle bg-surface-muted px-3 py-2 text-sm text-text-muted"
              >
                Örnek satır {i + 1} · sticky bar yukarıda kalır
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="PageShell + Toolbar + FilterBar + BulkActionBar — bütünleşik preview">
        <div className="h-96 overflow-hidden rounded-md border border-border">
          <PageShell
            className="h-full"
            density="user"
            sidebar={
              <Sidebar
                className="h-full"
                brand={<SidebarBrand name="Kivasy" />}
              >
                <SidebarGroup title="Kütüphane">
                  <NavItem
                    href="#book"
                    label="Bookmark"
                    icon={<BookmarkIcon size={14} />}
                    badge="84"
                    active
                  />
                  <NavItem
                    href="#ref"
                    label="Referanslar"
                    icon={<BookmarkIcon size={14} />}
                    badge="27"
                  />
                </SidebarGroup>
              </Sidebar>
            }
            title="Bookmark"
            subtitle="84 kayıt · son eklenen 2 dakika önce"
            actions={
              <Button variant="primary" size="sm" icon={<PlusIcon />}>
                URL ekle
              </Button>
            }
            toolbar={
              <Toolbar
                leading={
                  <div className="w-64">
                    <Input placeholder="Ara" />
                  </div>
                }
                trailing={
                  <Button variant="ghost" size="sm">
                    Filtre
                  </Button>
                }
              >
                <FilterBar>
                  <Chip active>Tümü · 84</Chip>
                  <Chip>Wall art · 31</Chip>
                  <Chip>Clipart · 22</Chip>
                </FilterBar>
              </Toolbar>
            }
          >
            <div className="space-y-4">
              <BulkActionBar
                selectedCount={3}
                label="3 bookmark seçildi"
                actions={
                  <>
                    <Button variant="ghost" size="sm">
                      Referansa ekle
                    </Button>
                    <Button variant="ghost" size="sm">
                      Arşivle
                    </Button>
                  </>
                }
                onDismiss={() => {}}
              />
              <div className="grid grid-cols-3 gap-4">
                {(["boho", "clipart", "sticker"] as const).map((k) => (
                  <Card key={k} variant="asset" interactive>
                    <Thumb kind={k} />
                    <AssetCardMeta>
                      <div className="text-sm font-medium truncate">
                        {k} örnek kart
                      </div>
                      <div className="font-mono text-xs text-text-subtle">
                        etsy.com/listing
                      </div>
                    </AssetCardMeta>
                  </Card>
                ))}
              </div>
            </div>
          </PageShell>
        </div>
      </Section>

      <Section title="PageShell — admin density (sidebar scope=admin)">
        <div className="h-64 overflow-hidden rounded-md border border-border">
          <PageShell
            className="h-full"
            density="admin"
            sidebar={
              <Sidebar
                className="h-full"
                brand={<SidebarBrand name="Kivasy" scope="admin" />}
              >
                <SidebarGroup title="İzleme">
                  <NavItem href="#over" label="Overview" icon={<BookmarkIcon size={14} />} active />
                  <NavItem href="#jobs" label="Job Monitor" icon={<BookmarkIcon size={14} />} badge="42" />
                </SidebarGroup>
                <SidebarGroup title="Sistem">
                  <NavItem href="#prov" label="Providers" icon={<BookmarkIcon size={14} />} />
                </SidebarGroup>
              </Sidebar>
            }
            title="Job Monitor"
            subtitle="42 aktif iş"
            actions={<Button variant="ghost" size="sm">CSV export</Button>}
          >
            <div className="text-sm text-text-muted">
              Admin density: p-4 · body 13 · row 48. Content scroll bu kutuda kısıtlıdır.
            </div>
          </PageShell>
        </div>
      </Section>
    </main>
  );
}
