// Mockup Studio · Screens A — S1, S2, S3, S4, S5, S6
// Shell + canvas içinde standalone render edilebilir artboard'lar.

const {
  I, Icon, Button, Badge, Chip, Input, Card, Thumb, StateMessage, Skeleton,
  MS_DESIGNS, MS_TEMPLATES, MS_PRESETS, MS_QUEUE, MS_SAVED_SETS,
  MSScene, Frame, SafeAreaOverlay, PlacementHandles,
  StatusDot, RatioBadge, WarningBadge,
  CategoryChip, PresetCard, TemplateCard, AssetSourceTile, MockupPreviewThumb,
  BulkBar, QueueSummaryRail,
} = window;

// Studio chrome — sade page wrapper, design canvas içinde tek artboard
function StudioFrame({ title, subtitle, breadcrumb, actions, toolbar, children, footer, width = 1440, height = 1040 }) {
  return (
    <div className="eh-app" data-density="user" style={{
      width, height, display: "flex", flexDirection: "column",
      background: "var(--color-bg)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden"
    }}>
      {/* mini topbar — Mockup Studio banner */}
      <div style={{
        height: 48,
        borderBottom: "1px solid var(--color-border)",
        display: "flex", alignItems: "center",
        padding: "0 24px",
        background: "var(--color-surface)",
        gap: 16
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 22, height: 22, borderRadius: 4,
            background: "var(--color-accent)",
            display: "grid", placeItems: "center", color: "#FFF"
          }}>{I.mock || I.image}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>EtsyHub</span>
          <span style={{ color: "var(--color-text-subtle)", margin: "0 4px" }}>/</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Mockup Studio</span>
          {breadcrumb && <>
            <span style={{ color: "var(--color-text-subtle)", margin: "0 4px" }}>/</span>
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{breadcrumb}</span>
          </>}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <Button variant="ghost" size="sm" icon={I.help || I.search}>Yardım</Button>
          <Button variant="ghost" size="sm" icon={I.bookmark || I.image}>Saved sets</Button>
        </div>
      </div>

      {/* page header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.2, color: "var(--color-text)" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 4 }}>{subtitle}</div>}
          </div>
          {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
        </div>
        {toolbar && <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{toolbar}</div>}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 0 }}>{children}</div>

      {footer && <div style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface)", padding: "12px 24px" }}>{footer}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// S1 · Studio Home
// ═══════════════════════════════════════════════════════════
function S1_StudioHome() {
  const recentBatches = [
    { name: "Boho moon · Etsy optimized",  count: 8, when: "2 saat önce", thumbs: ["t-w-01","t-w-04","t-w-03","t-w-08"], hero: 0 },
    { name: "Bookmark launch · pressed flower", count: 6, when: "Dün", thumbs: ["t-b-01","t-b-04","t-b-02","t-b-03"], hero: 0 },
    { name: "Clipart digital · botanical", count: 5, when: "3 gün önce", thumbs: ["t-c-01","t-c-02","t-c-03","t-c-04"], hero: 0 },
  ];
  const popularPresets = MS_PRESETS.filter(p => p.featured).slice(0, 4);

  return (
    <StudioFrame
      title="Studio Home"
      subtitle="Hızlı başla, son batch'lerin ve preset'lerinle çalışmaya devam et"
      actions={<>
        <Button variant="secondary" icon={I.upload || I.plus}>Local upload</Button>
        <Button variant="primary" icon={I.plus}>Yeni batch</Button>
      </>}
    >
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Quickstart — 3 kategori */}
          <section>
            <SectionHead label="Hızlı başla" meta="Tasarımdan batch'e 4 tıklamada" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              <QuickstartTile
                title="Wall art" sub="Framed · gallery wall · room scenes"
                count={8} variant="boho-moon" tone="ivory-wall"
              />
              <QuickstartTile
                title="Bookmark" sub="Single · set of 3 · handheld · book"
                count={6} variant="bookmark-floral" tone="kraft" product="bookmark"
              />
              <QuickstartTile
                title="Clipart bundle" sub="Digital cover · transparent · file delivery"
                count={5} variant="clipart-grid" tone="paper" product="clipart"
              />
            </div>
          </section>

          {/* Recent batches */}
          <section>
            <SectionHead label="Son batch'ler" meta="Her birini aç, yeniden çalıştır, listing'e gönder" link="Tümü" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {recentBatches.map((b, i) => <RecentBatchCard key={i} batch={b} />)}
            </div>
          </section>

          {/* Popular presets */}
          <section>
            <SectionHead label="Featured preset paketleri" meta="Bookmark launch · Etsy optimized · Wall art bundle" link="Tüm preset'ler" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
              {popularPresets.map(p => <PresetCard key={p.id} preset={p} />)}
            </div>
          </section>
        </div>

        {/* Right rail */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* This week */}
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 12 }}>Bu hafta</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
              <Stat label="Render" val="142" />
              <Stat label="Listing'e gönderildi" val="38" />
              <Stat label="Failed retry" val="6" tone="warn" />
              <Stat label="Saved set kullanımı" val="21" />
            </div>
          </Card>

          {/* Active queue */}
          <Card style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Aktif kuyruk</div>
              <Badge tone="accent" dot>3 running</Badge>
            </div>
            {MS_QUEUE.slice(0, 4).map((q, i) => <MiniQueueRow key={i} q={q} />)}
            <Button variant="ghost" size="sm" style={{ width: "100%", marginTop: 8 }}>Kuyruğun tamamı →</Button>
          </Card>

          {/* Saved sets shortcut */}
          <Card style={{ padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Saved sets</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-subtle)" }}>{MS_SAVED_SETS.length}</span>
            </div>
            {MS_SAVED_SETS.slice(0, 3).map(s =>
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 0",
                borderTop: "1px solid var(--color-border-subtle)"
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 4,
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  overflow: "hidden", flexShrink: 0
                }}>
                  <div className={`ms-art ms-art--${s.thumb}`} style={{ position: "relative", width: "100%", height: "100%" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-subtle)", fontFamily: "var(--font-mono)" }}>{s.count} mockup · {s.uses} kullanım</div>
                </div>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </StudioFrame>
  );
}

function SectionHead({ label, meta, link }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", marginBottom: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)" }}>{label}</div>
      {meta && <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginLeft: 12 }}>{meta}</div>}
      {link && <a style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-accent)", cursor: "pointer", textDecoration: "none" }}>{link} →</a>}
    </div>
  );
}

function QuickstartTile({ title, sub, count, variant, tone, product = "wall-art" }) {
  const fakeT = { product, scene: tone, ratio: product === "bookmark" ? "1:3" : "2:3", orient: "portrait", frame: product === "wall-art" ? "natural" : "none", room: "living", tags: [] };
  const fakeD = { variant, set: "single" };
  return (
    <Card interactive style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ position: "relative", aspectRatio: "5 / 3", overflow: "hidden", background: "var(--color-surface-2)" }}>
        <MSScene template={fakeT} design={fakeD} />
        <div style={{
          position: "absolute", left: 12, top: 12,
          fontFamily: "var(--font-mono)", fontSize: 10,
          background: "rgba(255,255,255,0.92)", padding: "3px 8px", borderRadius: 999,
          color: "var(--color-text-muted)", letterSpacing: "0.05em", textTransform: "uppercase"
        }}>{count} mockup · preset</div>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{sub}</div>
      </div>
    </Card>
  );
}

function RecentBatchCard({ batch }) {
  const t0 = MS_TEMPLATES.find(t => t.id === batch.thumbs[0]) || MS_TEMPLATES[0];
  return (
    <Card interactive style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ position: "relative", aspectRatio: "5 / 3", overflow: "hidden" }}>
        <MSScene template={t0} design={{ variant: t0.product === "bookmark" ? "bookmark-floral" : t0.product === "clipart" ? "clipart-grid" : "boho-moon" }} />
        <div style={{ position: "absolute", left: 8, top: 8 }}>
          <span className="ms-hero-badge">Hero set</span>
        </div>
      </div>
      <div style={{ padding: 12, borderTop: "1px solid var(--color-border)" }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>{batch.name}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {batch.thumbs.slice(0,4).map((tid, i) => {
              const tt = MS_TEMPLATES.find(t => t.id === tid) || MS_TEMPLATES[i];
              return <div key={i} style={{ width: 22, height: 22, borderRadius: 3, overflow: "hidden", border: "1px solid var(--color-border)" }}>
                <MSScene template={tt} design={{ variant: "abstract-warm" }} />
              </div>;
            })}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-subtle)" }}>{batch.count} · {batch.when}</div>
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, val, tone }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 600, color: tone === "warn" ? "var(--color-warning)" : "var(--color-text)", lineHeight: 1.1 }}>{val}</div>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MiniQueueRow({ q }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 0",
      borderTop: "1px solid var(--color-border-subtle)"
    }}>
      <StatusDot status={q.status} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.design} → {q.template}</div>
        <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>{q.status === "running" ? `${q.pct}% · ${q.ts}` : q.status}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// S2 · Design Selection Drawer (modal)
// ═══════════════════════════════════════════════════════════
function S2_DesignDrawer() {
  return (
    <StudioFrame
      title="Studio Home"
      subtitle="Yeni batch — Adım 1: tasarım kaynağı"
      breadcrumb="Yeni batch"
    >
      <div style={{ padding: 24, position: "relative", minHeight: 920 }}>
        {/* faded studio home content behind drawer */}
        <div style={{ opacity: 0.25, pointerEvents: "none" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
            <QuickstartTile title="Wall art" sub="…" count={8} variant="boho-moon" tone="ivory-wall" />
            <QuickstartTile title="Bookmark" sub="…" count={6} variant="bookmark-floral" tone="kraft" product="bookmark" />
            <QuickstartTile title="Clipart" sub="…" count={5} variant="clipart-grid" tone="paper" product="clipart" />
          </div>
        </div>
        <div className="ms-modal-scrim" />

        {/* Drawer panel — right */}
        <div style={{
          position: "absolute", right: 24, top: 24, bottom: 24, width: 720,
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-popover)",
          display: "flex", flexDirection: "column",
          overflow: "hidden"
        }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-accent)" }}>Adım 1 / 4</div>
                <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>Tasarımı seç</div>
                <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}>Mevcut bir tasarım, generated batch veya local upload — hepsi mockup'a hazır</div>
              </div>
              <button style={{
                width: 32, height: 32, borderRadius: 4,
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--color-text-muted)", display: "grid", placeItems: "center"
              }}>{I.close || I.x || I.search}</button>
            </div>
          </div>

          {/* Source tiles */}
          <div style={{ padding: "16px 24px 0", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            <AssetSourceTile icon={I.image} title="Reference Library" meta="412 tasarım" active />
            <AssetSourceTile icon={I.bookmark || I.image} title="Collection" meta="14 koleksiyon" />
            <AssetSourceTile icon={I.upload || I.plus} title="Local upload" meta="PNG · JPG · SVG · PDF" />
            <AssetSourceTile icon={I.eye || I.search} title="Generated" meta="Son 7 gün · 28" />
          </div>

          {/* Filters */}
          <div style={{ padding: "16px 24px 12px", display: "flex", gap: 8, alignItems: "center", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <Input prefix={I.search} placeholder="Tasarım ara…" style={{ flex: 1 }} />
            <Chip active>Tümü · 412</Chip>
            <Chip>Wall art · 287</Chip>
            <Chip>Bookmark · 64</Chip>
            <Chip>Clipart · 41</Chip>
          </div>

          {/* Grid */}
          <div className="ms-rail" style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              {MS_DESIGNS.map((d, i) =>
                <div key={d.id} style={{
                  background: "var(--color-surface)",
                  border: `1.5px solid ${i < 4 ? "var(--color-accent)" : "var(--color-border)"}`,
                  borderRadius: "var(--radius-md)",
                  overflow: "hidden",
                  cursor: "pointer", position: "relative",
                  outline: i < 4 ? "3px solid rgba(232,93,37,0.12)" : "none",
                  outlineOffset: -1.5
                }}>
                  <div style={{ position: "relative", aspectRatio: d.ratio === "1:3" ? "1 / 1.6" : d.ratio === "1:1" ? "1 / 1" : "2 / 3", background: "#FBF8F0", overflow: "hidden" }}>
                    <div className={`ms-art ms-art--${d.variant}`} style={{ position: "absolute", inset: 0 }} />
                    {i < 4 && <div style={{
                      position: "absolute", top: 6, right: 6,
                      width: 22, height: 22, borderRadius: "50%",
                      background: "var(--color-accent)", color: "#FFF",
                      display: "grid", placeItems: "center", fontSize: 12
                    }}>{I.check || "✓"}</div>}
                  </div>
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <RatioBadge ratio={d.ratio} />
                      <span style={{ fontSize: 10, color: "var(--color-text-subtle)", fontFamily: "var(--font-mono)" }}>{d.set}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: "14px 24px", borderTop: "1px solid var(--color-border)", background: "var(--color-surface-2)", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              background: "var(--color-accent)", color: "#FFF",
              padding: "3px 10px", borderRadius: 999, letterSpacing: "0.04em"
            }}>4 tasarım seçildi</span>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>3 wall-art · 1 bookmark</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <Button variant="secondary">İptal</Button>
              <Button variant="primary" iconRight={I.arrowRight || I.chevronRight || I.plus}>Devam — Kategori seç</Button>
            </div>
          </div>
        </div>
      </div>
    </StudioFrame>
  );
}

// ═══════════════════════════════════════════════════════════
// S3 · Category & Preset Picker
// ═══════════════════════════════════════════════════════════
function S3_CategoryPreset() {
  const cats = [
    { key: "wall-art", label: "Wall art", count: 8,  active: true },
    { key: "bookmark", label: "Bookmark", count: 6  },
    { key: "clipart",  label: "Clipart bundle", count: 5 },
    { key: "sticker",  label: "Sticker sheet", count: 4 },
    { key: "tumbler",  label: "Tumbler · mug", count: 3 },
    { key: "tee",      label: "T-shirt", count: 6 },
  ];
  const wallPresets = MS_PRESETS.filter(p => p.for.includes("wall-art"));
  return (
    <StudioFrame
      title="Yeni batch · Adım 2"
      subtitle="Kategori ve preset paketi — kategori, preset'e gidecek template setini belirler"
      breadcrumb="Yeni batch › Kategori & preset"
      actions={<>
        <Button variant="secondary" icon={I.arrowLeft || I.chevronRight}>Geri</Button>
        <Button variant="primary" iconRight={I.arrowRight || I.plus}>Template'leri seç</Button>
      </>}
    >
      <div style={{ padding: 24 }}>

        {/* Selected designs strip */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px",
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)", marginBottom: 24
        }}>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Seçilen tasarımlar</span>
          <div style={{ display: "flex", gap: 6 }}>
            {MS_DESIGNS.slice(0, 4).map(d =>
              <div key={d.id} style={{
                width: 32, height: 32, borderRadius: 4, overflow: "hidden",
                border: "1px solid var(--color-border)"
              }}>
                <div className={`ms-art ms-art--${d.variant}`} style={{ position: "relative", width: "100%", height: "100%" }} />
              </div>
            )}
          </div>
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>4 tasarım · 3 wall-art · 1 bookmark</span>
          <a style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-accent)", cursor: "pointer" }}>Düzenle →</a>
        </div>

        {/* Categories row */}
        <div style={{ marginBottom: 8, fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Kategori</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {cats.map(c => <CategoryChip key={c.key} label={c.label} count={c.count} active={c.active} />)}
        </div>

        {/* Presets */}
        <div style={{ marginBottom: 8, fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Preset paketi · Wall art</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 }}>
          {wallPresets.map((p, i) => <PresetCard key={p.id} preset={p} selected={i === 1} />)}
        </div>

        {/* Preset preview */}
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: 20
        }}>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Etsy Optimized Set</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Etsy thumbnail için en iyi adayı + 7 listing varyasyonu</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <Badge tone="accent" dot>Recommended</Badge>
              <Badge tone="info" dot>Best for Etsy thumbnail</Badge>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 10 }}>
            {MS_TEMPLATES.filter(t => t.product === "wall-art").slice(0, 8).map((t, i) =>
              <div key={t.id} style={{ position: "relative" }}>
                <div style={{
                  aspectRatio: "4 / 5", borderRadius: 4, overflow: "hidden",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)"
                }}>
                  <MSScene template={t} design={{ variant: "boho-moon", set: "single" }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {i === 0 && <span style={{ color: "var(--color-accent)" }}>★ </span>}
                  {t.name.split("·")[0].trim()}
                </div>
              </div>
            )}
          </div>
          <div style={{
            marginTop: 16, padding: "10px 14px",
            background: "var(--color-accent-soft)",
            border: "1px solid rgba(232,93,37,0.20)",
            borderRadius: "var(--radius-md)",
            display: "flex", alignItems: "center", gap: 10
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent)" }} />
            <span style={{ fontSize: 13, color: "var(--color-accent-text)" }}>
              <strong>4 tasarım × 8 mockup = 32 render.</strong> Tahmini süre 2 dk 40 sn · Dynamic Mockups quota: 2.480 / 5.000 kalan
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer" }}>Özelleştir →</span>
          </div>
        </div>
      </div>
    </StudioFrame>
  );
}

// ═══════════════════════════════════════════════════════════
// S4 · Template Library Grid
// ═══════════════════════════════════════════════════════════
function S4_TemplateLibrary() {
  return (
    <StudioFrame
      title="Template Library"
      subtitle="Tüm sahneler — kategoriye, oda tipine, stile ve orana göre filtrele"
      actions={<>
        <Button variant="secondary" icon={I.bookmark || I.plus}>Saved sets</Button>
        <Button variant="primary" iconRight={I.arrowRight || I.plus}>Seçilenleri batch'e ekle · 6</Button>
      </>}
      toolbar={<>
        <Input prefix={I.search} placeholder="Template ara…" style={{ width: 280 }} />
        <Chip active>Wall art · 8</Chip>
        <Chip>Bookmark · 6</Chip>
        <Chip>Clipart · 4</Chip>
        <span style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />
        <Chip>Portrait</Chip>
        <Chip>Landscape</Chip>
        <Chip>Square</Chip>
        <span style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />
        <Chip>Living</Chip>
        <Chip>Nursery</Chip>
        <Chip>Office</Chip>
        <Chip>Desk · flat lay</Chip>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-text-muted)" }}>
          Sırala: <strong style={{ color: "var(--color-text)" }}>Recommended</strong>
        </span>
      </>}
    >
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "240px 1fr", gap: 24 }}>
        {/* Left taxonomy rail */}
        <aside>
          <TaxonomyGroup title="Aspect ratio" items={[
            { label: "Tümü", count: 18, active: true },
            { label: "2:3 portrait", count: 9 },
            { label: "3:2 landscape", count: 1 },
            { label: "1:1 square", count: 2 },
            { label: "1:3 bookmark", count: 6 },
            { label: "4:3 cover", count: 2 },
          ]} />
          <TaxonomyGroup title="Style" items={[
            { label: "Boho", count: 4 },
            { label: "Modern minimal", count: 3 },
            { label: "Nursery soft", count: 2 },
            { label: "Seasonal", count: 2 },
            { label: "Cozy desk", count: 2 },
          ]} />
          <TaxonomyGroup title="Frame" items={[
            { label: "Natural pine", count: 3 },
            { label: "Black", count: 2 },
            { label: "White", count: 2 },
            { label: "Brass", count: 1 },
            { label: "Unframed", count: 1 },
            { label: "No frame", count: 9 },
          ]} />
          <TaxonomyGroup title="Tags" items={[
            { label: "Recommended", count: 9 },
            { label: "Premium", count: 6 },
            { label: "Recent", count: 7 },
            { label: "Favorite", count: 4 },
          ]} />
        </aside>

        {/* Grid */}
        <div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14
          }}>
            {MS_TEMPLATES.map((t, i) =>
              <TemplateCard key={t.id} template={t} selected={[0,1,2,8,9,14].includes(i)} />
            )}
          </div>
          <BulkBar count={6} total={18}>
            <Button variant="ghost" style={{ color: "#FFF" }} icon={I.bookmark || I.plus}>Save as set</Button>
            <Button variant="primary" icon={I.plus}>Batch'e ekle · 6</Button>
          </BulkBar>
        </div>
      </div>
    </StudioFrame>
  );
}

function TaxonomyGroup({ title, items }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
        textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 8
      }}>{title}</div>
      {items.map(item =>
        <div key={item.label} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "5px 8px", marginLeft: -8, borderRadius: 4,
          background: item.active ? "var(--color-accent-soft)" : "transparent",
          color: item.active ? "var(--color-accent-text)" : "var(--color-text)",
          fontSize: 13, cursor: "pointer"
        }}>
          <span style={{ fontWeight: item.active ? 500 : 400 }}>{item.label}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: item.active ? "var(--color-accent-text)" : "var(--color-text-subtle)" }}>{item.count}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// S5 · Placement Editor
// ═══════════════════════════════════════════════════════════
function S5_PlacementEditor() {
  const tpl = MS_TEMPLATES[0]; // living · ivory · sofa
  const dsg = MS_DESIGNS[0];   // moon phase boho

  return (
    <StudioFrame
      title="Placement Editor"
      subtitle="Moon phases · ivory boho — Living room · ivory wall"
      breadcrumb="Editor"
      actions={<>
        <Button variant="ghost" icon={I.arrowLeft || I.chevronRight}>Vazgeç</Button>
        <Button variant="secondary" icon={I.bookmark || I.plus}>Save as variant</Button>
        <Button variant="primary" icon={I.check || I.plus}>Apply to batch</Button>
      </>}
    >
      <div style={{ padding: 0, display: "grid", gridTemplateColumns: "260px 1fr 320px", height: "100%" }}>

        {/* Left rail — design + variants */}
        <div style={{ borderRight: "1px solid var(--color-border)", padding: 16, background: "var(--color-surface)", overflow: "auto" }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 8 }}>Tasarım</div>
          <div style={{
            background: "#FBF8F0", border: "1px solid var(--color-border)",
            borderRadius: 6, padding: 12, marginBottom: 14
          }}>
            <div style={{ aspectRatio: "2 / 3", borderRadius: 4, overflow: "hidden", marginBottom: 10, position: "relative" }}>
              <div className="ms-art ms-art--boho-moon" style={{ position: "absolute", inset: 0 }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{dsg.title}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-subtle)", marginTop: 2 }}>{dsg.res} · 2:3</div>
          </div>

          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 8 }}>Variants — bu batch için</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {MS_TEMPLATES.filter(t => t.product === "wall-art").slice(0, 6).map((t, i) =>
              <div key={t.id} style={{
                aspectRatio: "1 / 1.2", borderRadius: 4, overflow: "hidden",
                border: `1.5px solid ${i === 0 ? "var(--color-accent)" : "var(--color-border)"}`,
                position: "relative", cursor: "pointer"
              }}>
                <MSScene template={t} design={{ variant: "boho-moon" }} />
                {i === 0 && <div style={{
                  position: "absolute", left: 4, top: 4,
                  width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent)",
                  boxShadow: "0 0 0 3px rgba(232,93,37,0.18)"
                }} />}
              </div>
            )}
          </div>

          <div style={{ marginTop: 18, fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 8 }}>Layer</div>
          {[
            { ic: I.image, label: "Moon phases artwork", note: "2:3 · 4500×6750" },
            { ic: I.frame || I.image, label: "Frame · natural pine", note: "ms-frame-01" },
            { ic: I.wall || I.image, label: "Scene · ivory wall", note: "living-01" },
          ].map((l, i) =>
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px",
              background: i === 0 ? "var(--color-accent-soft)" : "transparent",
              borderRadius: 4, cursor: "pointer"
            }}>
              <span style={{ color: i === 0 ? "var(--color-accent)" : "var(--color-text-muted)" }}>{l.ic}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: i === 0 ? 500 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-subtle)" }}>{l.note}</div>
              </div>
            </div>
          )}
        </div>

        {/* Center — canvas */}
        <div style={{ position: "relative", background: "#1A1715", display: "flex", flexDirection: "column" }}>
          {/* Top toolbar */}
          <div style={{
            position: "absolute", left: 16, top: 16, zIndex: 5,
            display: "flex", gap: 6,
            background: "rgba(255,255,255,0.96)",
            border: "1px solid var(--color-border)",
            borderRadius: 6, padding: 4
          }}>
            <ToolBtn icon={I.cursor || I.arrow || I.search} active />
            <ToolBtn icon={I.move || I.plus} />
            <ToolBtn icon={I.rotate || I.refresh || I.plus} />
            <span style={{ width: 1, background: "var(--color-border)" }} />
            <ToolBtn icon={I.zoomIn || I.plus} />
            <ToolBtn icon={I.zoomOut || I.minus || I.search} />
            <ToolBtn icon={I.fit || I.image} label="Fit" />
            <ToolBtn icon={I.refresh || I.plus} label="Reset" />
          </div>

          <div style={{
            position: "absolute", right: 16, top: 16, zIndex: 5,
            display: "flex", gap: 8, alignItems: "center"
          }}>
            <SwatchToggle label="Safe area" active />
            <SwatchToggle label="Bleed" />
            <SwatchToggle label="Grid" />
          </div>

          <div style={{
            position: "absolute", bottom: 16, left: 16, right: 16, zIndex: 5,
            display: "flex", alignItems: "center", gap: 10
          }}>
            <div style={{
              background: "rgba(255,255,255,0.96)",
              border: "1px solid var(--color-border)",
              padding: "6px 12px", borderRadius: 6,
              fontFamily: "var(--font-mono)", fontSize: 11
            }}>
              <span style={{ color: "var(--color-text-muted)" }}>X</span> 34% &nbsp;
              <span style={{ color: "var(--color-text-muted)" }}>Y</span> 12% &nbsp;
              <span style={{ color: "var(--color-text-muted)" }}>W</span> 32% &nbsp;
              <span style={{ color: "var(--color-text-muted)" }}>H</span> 50% &nbsp;
              <span style={{ color: "var(--color-text-muted)" }}>R</span> 0°
            </div>
            <div style={{
              background: "rgba(255,255,255,0.96)",
              border: "1px solid var(--color-border)",
              padding: "6px 10px", borderRadius: 6,
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: "var(--font-mono)", fontSize: 11
            }}>
              <Button variant="ghost" size="sm">−</Button>
              <span>120%</span>
              <Button variant="ghost" size="sm">+</Button>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <Button variant="secondary" size="sm" icon={I.refresh || I.plus}>Reset placement</Button>
              <Button variant="primary" size="sm" icon={I.eye || I.search}>Preview render</Button>
            </div>
          </div>

          {/* Canvas */}
          <div style={{ flex: 1, padding: 64, display: "grid", placeItems: "center" }}>
            <div style={{
              width: 720, aspectRatio: "16 / 10",
              background: "var(--color-surface)",
              boxShadow: "0 24px 56px rgba(0,0,0,0.45)",
              position: "relative", overflow: "hidden",
              borderRadius: 4
            }}>
              <MSScene template={tpl} design={dsg} withSafeArea withHandles />
            </div>
          </div>
        </div>

        {/* Right panel — properties + warnings */}
        <div style={{ borderLeft: "1px solid var(--color-border)", padding: 16, background: "var(--color-surface)", overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

          <Section title="Placement">
            <FieldRow label="Position">
              <Input value="34%" style={{ width: 80 }} />
              <Input value="12%" style={{ width: 80 }} />
            </FieldRow>
            <FieldRow label="Size">
              <Input value="32%" style={{ width: 80 }} />
              <Input value="50%" style={{ width: 80 }} />
            </FieldRow>
            <FieldRow label="Rotate">
              <Input value="0°" style={{ width: 80 }} />
              <Button variant="ghost" size="sm">Center</Button>
            </FieldRow>
            <FieldRow label="Scale fit">
              <Chip active>Fill</Chip><Chip>Contain</Chip><Chip>Cover</Chip>
            </FieldRow>
          </Section>

          <Section title="Frame & background">
            <FieldRow label="Frame">
              <select style={inputSel}>
                <option>Natural pine</option>
                <option>Walnut</option>
                <option>Black</option>
                <option>White</option>
                <option>Unframed</option>
              </select>
            </FieldRow>
            <FieldRow label="Mat">
              <Chip active>White</Chip><Chip>Cream</Chip><Chip>None</Chip>
            </FieldRow>
            <FieldRow label="Wall tone">
              <Chip active>Ivory</Chip><Chip>Charcoal</Chip><Chip>Boho</Chip>
            </FieldRow>
          </Section>

          <Section title="Warnings">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <WarningRow tone="success" title="Resolution OK" body="4500×6750 px · 300dpi · large print uyumlu" />
              <WarningRow tone="warning" title="Safe area: ±2% pay var" body="Üst kenara çok yakın — 4% kaydır" action="Auto-fix" />
              <WarningRow tone="info" title="Ratio match" body="Tasarım 2:3 · template 2:3 · uygun" />
            </div>
          </Section>

          <Section title="Apply scope">
            <FieldRow label="Apply to">
              <Chip active>This mockup</Chip>
            </FieldRow>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip>All wall-art templates</Chip>
              <Chip>All in this batch</Chip>
              <Chip>Save as default for design</Chip>
            </div>
          </Section>

        </div>
      </div>
    </StudioFrame>
  );
}

const inputSel = {
  height: 32, padding: "0 10px",
  border: "1px solid var(--color-border)", borderRadius: 4,
  background: "var(--color-surface)", fontSize: 13, fontFamily: "var(--font-sans)",
  color: "var(--color-text)", flex: 1
};

function ToolBtn({ icon, active, label }) {
  return (
    <button style={{
      height: 28, minWidth: 28,
      padding: label ? "0 8px" : 0,
      borderRadius: 4, border: "none",
      background: active ? "var(--color-accent-soft)" : "transparent",
      color: active ? "var(--color-accent)" : "var(--color-text-muted)",
      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 12, fontFamily: "var(--font-mono)"
    }}>{icon}{label}</button>
  );
}

function SwatchToggle({ label, active }) {
  return (
    <button style={{
      height: 28, padding: "0 10px",
      borderRadius: 4, border: `1px solid ${active ? "var(--color-accent)" : "rgba(255,255,255,0.20)"}`,
      background: active ? "var(--color-accent)" : "rgba(255,255,255,0.10)",
      color: active ? "#FFF" : "rgba(255,255,255,0.85)",
      fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.04em",
      cursor: "pointer"
    }}>{label}</button>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
        textTransform: "uppercase", color: "var(--color-text-muted)",
        marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid var(--color-border-subtle)"
      }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--color-text-muted)", width: 64, flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", gap: 6, flex: 1, alignItems: "center" }}>{children}</div>
    </div>
  );
}

function WarningRow({ tone, title, body, action }) {
  const map = {
    success: { bg: "var(--color-success-soft)", fg: "var(--color-success)", bd: "rgba(47,122,75,0.20)" },
    warning: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)", bd: "rgba(180,116,21,0.25)" },
    danger:  { bg: "var(--color-danger-soft)",  fg: "var(--color-danger)",  bd: "rgba(177,58,40,0.25)" },
    info:    { bg: "var(--color-info-soft)",    fg: "var(--color-info)",    bd: "rgba(45,95,143,0.25)" },
  };
  const m = map[tone] || map.info;
  return (
    <div style={{
      background: m.bg, border: `1px solid ${m.bd}`, borderRadius: 4,
      padding: "8px 10px", display: "flex", alignItems: "flex-start", gap: 8
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.fg, marginTop: 6, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: m.fg }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 1 }}>{body}</div>
      </div>
      {action && <button style={{
        fontSize: 11, fontFamily: "var(--font-mono)",
        color: m.fg, background: "transparent",
        border: `1px solid ${m.bd}`, borderRadius: 3,
        padding: "2px 6px", cursor: "pointer"
      }}>{action}</button>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// S6 · Batch Review (12 öğe)
// ═══════════════════════════════════════════════════════════
function S6_BatchReview() {
  const items = [];
  const designs = [MS_DESIGNS[0], MS_DESIGNS[1], MS_DESIGNS[2], MS_DESIGNS[5]];
  const tpls = MS_TEMPLATES.filter(t => t.product === "wall-art").slice(0, 3);
  designs.forEach(d => tpls.forEach(t => items.push({ design: d, template: t })));
  // 12 elements
  const states = ["hero","approved","approved","approved","approved","approved","ratio","approved","safe","retry","approved","mixed"];

  return (
    <StudioFrame
      title="Batch Review · Boho moon · Etsy optimized"
      subtitle="12 mockup hazır — onayla, çıkar, sıralayı düzenle, hero seç"
      breadcrumb="Yeni batch › Review"
      actions={<>
        <Button variant="ghost">Tümünü işaretle</Button>
        <Button variant="secondary" icon={I.refresh || I.plus}>Re-render</Button>
        <Button variant="primary" iconRight={I.arrowRight || I.plus}>Approve & queue · 10</Button>
      </>}
      toolbar={<>
        <Chip active>Tümü · 12</Chip>
        <Chip>Approved · 9</Chip>
        <Chip>Warnings · 2</Chip>
        <Chip>Retry · 1</Chip>
        <span style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />
        <Chip>Wall-art</Chip>
        <Chip>Per design</Chip>
        <Chip>Per template</Chip>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>Hero: ★ Living · ivory · Moon phases</span>
      </>}
      footer={<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          background: "var(--color-accent)", color: "#FFF",
          padding: "3px 10px", borderRadius: 999
        }}>10 / 12 onaylı</span>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>1 hero · 9 listing · 2 uyarılı</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Button variant="ghost">Bookmark this batch</Button>
          <Button variant="secondary" icon={I.refresh || I.plus}>Replace templates</Button>
          <Button variant="primary" iconRight={I.arrowRight || I.plus}>Send to Render queue</Button>
        </span>
      </div>}
    >
      <div style={{ padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {items.map((it, i) => <BatchTile key={i} item={it} state={states[i]} hero={i === 0} />)}
        </div>
      </div>
    </StudioFrame>
  );
}

function BatchTile({ item, state, hero }) {
  const isWarn = state === "ratio" || state === "safe";
  const isRetry = state === "retry";
  const showCheck = state === "approved" || state === "hero";

  return (
    <div className="ms-output" style={{
      background: "var(--color-surface)",
      border: `1.5px solid ${hero ? "#B7975B" : isWarn ? "var(--color-warning)" : isRetry ? "var(--color-danger)" : "var(--color-border)"}`,
      borderRadius: "var(--radius-md)",
      overflow: "hidden", position: "relative",
      boxShadow: "var(--shadow-card)"
    }}>
      <div style={{ position: "relative", aspectRatio: "4 / 3", overflow: "hidden" }}>
        <MSScene template={item.template} design={item.design} withScrim={isRetry} scrimLabel="Retry needed" />

        {/* top-left badges */}
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
          {hero && <span className="ms-hero-badge">★ Hero candidate</span>}
          {isWarn && <WarningBadge kind={state === "ratio" ? "ratio" : "safe"} />}
          {isRetry && <WarningBadge kind="failed" />}
        </div>
        {/* top-right checkbox */}
        <div style={{ position: "absolute", top: 8, right: 8 }}>
          <span style={{
            width: 22, height: 22, borderRadius: 4, display: "grid", placeItems: "center",
            background: showCheck ? "var(--color-accent)" : "rgba(255,255,255,0.92)",
            border: showCheck ? "none" : "1px solid var(--color-border)",
            color: showCheck ? "#FFF" : "var(--color-text-muted)",
            fontSize: 12, cursor: "pointer"
          }}>{showCheck ? "✓" : ""}</span>
        </div>

        {/* hover row — bottom */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "8px 10px",
          background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.65) 100%)",
          display: "flex", gap: 6, justifyContent: "flex-end"
        }}>
          <RoundIconBtn icon={I.edit || I.search} title="Editor" />
          <RoundIconBtn icon={I.refresh || I.plus} title="Retry" />
          <RoundIconBtn icon={I.swap || I.plus} title="Replace template" />
          <RoundIconBtn icon={I.trash || I.x || I.minus || I.search} title="Remove" />
        </div>
      </div>
      <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.template.name.split("·")[0].trim()}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.design.title}</div>
        </div>
        <RatioBadge ratio={item.template.ratio} mismatch={state === "ratio"} />
      </div>
    </div>
  );
}

function RoundIconBtn({ icon, title }) {
  return (
    <button title={title} style={{
      width: 26, height: 26, borderRadius: 4,
      background: "rgba(255,255,255,0.92)",
      border: "none", cursor: "pointer",
      display: "grid", placeItems: "center",
      color: "var(--color-text)"
    }}>{icon}</button>
  );
}

Object.assign(window, {
  StudioFrame,
  S1_StudioHome, S2_DesignDrawer, S3_CategoryPreset,
  S4_TemplateLibrary, S5_PlacementEditor, S6_BatchReview,
});
