import { Button } from "@/components/ui/Button";

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
    </main>
  );
}
