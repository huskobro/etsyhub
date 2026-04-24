import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/ui/FormField";

/**
 * Primitives showcase — spec "Primitives showcase" artboard karşılığı.
 * Geliştirme aracı; canvas artboard ile yan yana görsel eşleşme kontrolü için.
 */

const VARIANTS = ["primary", "secondary", "ghost", "destructive"] as const;
const SIZES = ["sm", "md", "lg"] as const;

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
    </main>
  );
}
