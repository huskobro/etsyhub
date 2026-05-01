// Mockup Studio · Screens B — S7, S8, S9, S10, S11, S12, S13

const {
  I, Icon, Button, Badge, Chip, Input, Card, Thumb, StateMessage, Skeleton,
  MS_DESIGNS, MS_TEMPLATES, MS_PRESETS, MS_QUEUE, MS_SAVED_SETS,
  MSScene, Frame, SafeAreaOverlay, PlacementHandles,
  StatusDot, RatioBadge, WarningBadge,
  CategoryChip, PresetCard, TemplateCard, AssetSourceTile, MockupPreviewThumb,
  BulkBar, QueueSummaryRail, StudioFrame,
} = window;

// ═══════════════════════════════════════════════════════════
// S7 · Render Queue
// ═══════════════════════════════════════════════════════════
function S7_RenderQueue() {
  return (
    <StudioFrame
      title="Render Queue"
      subtitle="Aktif batch · 12 mockup · Dynamic Mockups provider"
      breadcrumb="Render queue"
      actions={<>
        <Button variant="ghost" icon={I.pause || I.plus}>Duraklat</Button>
        <Button variant="secondary" icon={I.refresh || I.plus}>Failed retry · 3</Button>
        <Button variant="primary" iconRight={I.arrowRight || I.plus}>Output gallery →</Button>
      </>}
    >
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        <div>
          {/* Active hero */}
          <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid var(--color-border-subtle)" }}>
              <div style={{ width: 80, height: 60, borderRadius: 4, overflow: "hidden", border: "1px solid var(--color-border)" }}>
                <MSScene template={MS_TEMPLATES[0]} design={MS_DESIGNS[0]} withScan />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-accent)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Şu an render ediliyor</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>Moon phases → Living · ivory · sofa</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>4500×6750 · 2:3 · 8 saniye geçti · ~3 sn kaldı</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--color-accent)" }}>72%</div>
            </div>
            <div style={{ height: 4, background: "var(--color-surface-2)" }}>
              <div style={{ height: "100%", width: "72%", background: "var(--color-accent)" }} />
            </div>
          </Card>

          {/* Queue table */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "32px 80px 1.4fr 1.4fr 100px 70px 110px 36px",
              padding: "10px 14px",
              fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
              textTransform: "uppercase", color: "var(--color-text-muted)",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-surface-2)"
            }}>
              <span></span><span></span>
              <span>Tasarım</span><span>Template</span>
              <span>Status</span><span>Süre</span><span>Progress</span><span></span>
            </div>
            {MS_QUEUE.map((q, i) => <QueueRow key={q.id} q={q} i={i} />)}
          </Card>
        </div>

        {/* Right rail */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <QueueSummaryRail queue={MS_QUEUE} />

          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 10 }}>Provider</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
              <span style={{ fontSize: 13 }}>Dynamic Mockups</span>
              <Badge tone="success" dot>Connected</Badge>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Concurrency</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>3 paralel</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-border-subtle)" }}>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Quota</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>2.480 / 5.000</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Avg render</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>11 sn</span>
            </div>
          </Card>

          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 10 }}>Failed — 3</div>
            {MS_QUEUE.filter(q => q.status === "failed").map((q, i) =>
              <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: i ? "1px solid var(--color-border-subtle)" : "none" }}>
                <StatusDot status="failed" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.design} → {q.template.split("·")[0].trim()}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-danger)" }}>{(q.err || "").replace(/_/g, " ")}</div>
                </div>
                <Button variant="ghost" size="sm" icon={I.refresh || I.plus} />
              </div>
            )}
            <Button variant="secondary" size="sm" style={{ width: "100%", marginTop: 8 }}>Failed Recovery →</Button>
          </Card>
        </aside>
      </div>
    </StudioFrame>
  );
}

function QueueRow({ q, i }) {
  const t = MS_TEMPLATES.find(t => q.template.includes(t.name.split("·")[0].trim())) || MS_TEMPLATES[i % MS_TEMPLATES.length];
  const d = MS_DESIGNS.find(d => q.design.includes(d.title.split("·")[0].split(" ")[0])) || MS_DESIGNS[i % MS_DESIGNS.length];
  const tone = q.status === "running" ? "var(--color-accent)"
              : q.status === "done" ? "var(--color-success)"
              : q.status === "failed" ? "var(--color-danger)"
              : "var(--color-text-subtle)";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "32px 80px 1.4fr 1.4fr 100px 70px 110px 36px",
      alignItems: "center",
      padding: "10px 14px",
      fontSize: 13,
      borderBottom: "1px solid var(--color-border-subtle)",
      background: q.status === "running" ? "rgba(232,93,37,0.04)" : "transparent"
    }}>
      <StatusDot status={q.status} />
      <div style={{ width: 60, height: 44, borderRadius: 3, overflow: "hidden", border: "1px solid var(--color-border)" }}>
        <MSScene template={t} design={d} withScrim={q.status === "queued"} scrimLabel="" withScan={q.status === "running"} />
      </div>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.design}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-muted)" }}>{q.template}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: tone, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {q.status}{q.err ? ` · ${q.err.split("_")[0]}` : ""}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-muted)" }}>{q.ts}</span>
      <div style={{ height: 4, background: "var(--color-surface-2)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${q.pct}%`, background: tone }} />
      </div>
      <Button variant="ghost" size="sm" icon={q.status === "failed" ? (I.refresh || I.plus) : (I.more || I.plus)} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// S8 · Output Gallery
// ═══════════════════════════════════════════════════════════
function S8_OutputGallery() {
  // 8 wall-art outputs + 4 bookmark + first one is hero
  const outputs = [
    { d: MS_DESIGNS[0], t: MS_TEMPLATES[0], hero: true,  approved: true },
    { d: MS_DESIGNS[0], t: MS_TEMPLATES[1], hero: false, approved: true },
    { d: MS_DESIGNS[0], t: MS_TEMPLATES[3], hero: false, approved: true },
    { d: MS_DESIGNS[0], t: MS_TEMPLATES[2], hero: false, approved: true },
    { d: MS_DESIGNS[1], t: MS_TEMPLATES[0], hero: false, approved: true },
    { d: MS_DESIGNS[1], t: MS_TEMPLATES[3], hero: false, approved: true },
    { d: MS_DESIGNS[2], t: MS_TEMPLATES[5], hero: false, approved: true },
    { d: MS_DESIGNS[5], t: MS_TEMPLATES[2], hero: false, approved: true },
    { d: MS_DESIGNS[7], t: MS_TEMPLATES[8], hero: false, approved: true },
    { d: MS_DESIGNS[7], t: MS_TEMPLATES[9], hero: false, approved: true },
    { d: MS_DESIGNS[7], t: MS_TEMPLATES[11], hero: false, approved: true },
    { d: MS_DESIGNS[9], t: MS_TEMPLATES[14], hero: false, approved: true },
  ];
  return (
    <StudioFrame
      title="Output Gallery · Boho moon · Etsy optimized"
      subtitle="12 onaylı render · hero seç, sıralayı düzenle, ZIP indir veya doğrudan listing'e gönder"
      breadcrumb="Output gallery"
      actions={<>
        <Button variant="ghost" icon={I.download || I.plus}>Tümünü ZIP indir</Button>
        <Button variant="secondary" icon={I.bookmark || I.plus}>Save as set</Button>
        <Button variant="primary" iconRight={I.arrowRight || I.plus}>Listing'e gönder →</Button>
      </>}
      toolbar={<>
        <Chip active>Tümü · 12</Chip>
        <Chip>Hero candidates · 3</Chip>
        <Chip>Wall-art · 8</Chip>
        <Chip>Bookmark · 4</Chip>
        <span style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />
        <Chip>Listing order</Chip>
        <Chip>Per template</Chip>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>
          <span style={{ color: "#B7975B" }}>★</span> Hero: Living · ivory · Moon phases
        </span>
      </>}
    >
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
        <div>
          {/* Hero featured */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Hero · Etsy thumbnail için en iyi aday</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-muted)" }}>Auto-pick: yüksek kontrast + 2:3 aspect</span>
            </div>
            <div style={{
              position: "relative",
              aspectRatio: "16 / 7",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              border: "2px solid #B7975B",
              boxShadow: "0 16px 36px rgba(40,28,18,0.18)"
            }}>
              <MSScene template={MS_TEMPLATES[0]} design={MS_DESIGNS[0]} />
              <div style={{ position: "absolute", left: 16, top: 16 }}>
                <span className="ms-hero-badge">★ Hero · Best for Etsy thumbnail</span>
              </div>
              <div style={{ position: "absolute", right: 16, top: 16, display: "flex", gap: 6 }}>
                <Button variant="primary" size="sm" icon={I.download || I.plus}>İndir</Button>
                <Button variant="secondary" size="sm" icon={I.refresh || I.plus}>Hero değiştir</Button>
              </div>
            </div>
          </div>

          {/* Gallery order grid */}
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Gallery sırası — 1: hero · 2-9: listing · 10-12: detail</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-muted)" }}>Drag to reorder · Etsy 10 image limiti uygun</span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 14
          }}>
            {outputs.map((o, i) => <OutputCard key={i} o={o} idx={i + 1} hero={i === 0} />)}
          </div>

          <BulkBar count={3} total={12}>
            <Button variant="ghost" style={{ color: "#FFF" }} icon={I.bookmark || I.plus}>Hero candidate</Button>
            <Button variant="ghost" style={{ color: "#FFF" }} icon={I.download || I.plus}>Seçilenleri indir</Button>
            <Button variant="primary" icon={I.arrowRight || I.plus}>Listing'e ekle</Button>
          </BulkBar>
        </div>

        {/* Right rail */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 10 }}>Batch metadata</div>
            <Meta label="Batch" val="Boho moon · Etsy optimized" />
            <Meta label="Tasarım" val="4 design" />
            <Meta label="Mockup" val="12 render" />
            <Meta label="Toplam süre" val="2 dk 18 sn" />
            <Meta label="Hero" val="Living · ivory · Moon" />
            <Meta label="Format" val="JPG 2400×3000 · 92" />
          </Card>

          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 10 }}>Export</div>
            <Button variant="secondary" icon={I.download || I.plus} style={{ width: "100%", marginBottom: 8 }}>ZIP · 12 dosya · 28 MB</Button>
            <Button variant="ghost" icon={I.download || I.plus} style={{ width: "100%", marginBottom: 8 }}>Yalnızca hero (4K)</Button>
            <Button variant="ghost" icon={I.download || I.plus} style={{ width: "100%" }}>Yalnızca seçili</Button>
          </Card>

          <Card style={{ padding: 14 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 10 }}>Listing köprüsü</div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>Bu galeri doğrudan Listing Builder'a aktarılabilir</div>
            <Button variant="primary" icon={I.arrowRight || I.plus} style={{ width: "100%" }}>Send to Listing →</Button>
          </Card>
        </aside>
      </div>
    </StudioFrame>
  );
}

function Meta({ label, val }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--color-border-subtle)", fontSize: 12 }}>
      <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono)", color: "var(--color-text)", textAlign: "right" }}>{val}</span>
    </div>
  );
}

function OutputCard({ o, idx, hero }) {
  return (
    <div className="ms-output" style={{
      background: "var(--color-surface)",
      border: `1.5px solid ${hero ? "#B7975B" : "var(--color-border)"}`,
      borderRadius: "var(--radius-md)",
      overflow: "hidden", position: "relative",
      boxShadow: "var(--shadow-card)",
      cursor: "grab"
    }}>
      <div style={{ position: "absolute", top: 8, left: 8, zIndex: 2,
        width: 22, height: 22, borderRadius: 4,
        background: "rgba(26,23,21,0.85)", color: "#FFF",
        display: "grid", placeItems: "center",
        fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600
      }}>{idx}</div>
      {hero && <div style={{ position: "absolute", top: 8, right: 8, zIndex: 2 }}>
        <span className="ms-hero-badge">Hero</span>
      </div>}
      <div style={{ aspectRatio: "4 / 3", position: "relative", overflow: "hidden" }}>
        <MSScene template={o.t} design={o.d} />
      </div>
      <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.t.name.split("·")[0].trim()}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-subtle)" }}>{o.d.title.split("·")[0].trim()}</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <RoundBtnSmall icon="★" />
          <RoundBtnSmall icon="↓" />
        </div>
      </div>
    </div>
  );
}
function RoundBtnSmall({ icon }) {
  return <button style={{
    width: 22, height: 22, borderRadius: 4,
    background: "var(--color-surface-2)", border: "1px solid var(--color-border)",
    fontSize: 12, color: "var(--color-text-muted)", cursor: "pointer", padding: 0
  }}>{icon}</button>;
}

// ═══════════════════════════════════════════════════════════
// S9 · Send to Listing
// ═══════════════════════════════════════════════════════════
function S9_SendToListing() {
  const slots = [
    { idx: 1, hero: true,  filled: true, t: MS_TEMPLATES[0], d: MS_DESIGNS[0], note: "Hero · thumbnail" },
    { idx: 2, filled: true, t: MS_TEMPLATES[3], d: MS_DESIGNS[0], note: "Gallery wall" },
    { idx: 3, filled: true, t: MS_TEMPLATES[1], d: MS_DESIGNS[0], note: "Charcoal" },
    { idx: 4, filled: true, t: MS_TEMPLATES[2], d: MS_DESIGNS[5], note: "Nursery" },
    { idx: 5, filled: true, t: MS_TEMPLATES[5], d: MS_DESIGNS[2], note: "Landscape" },
    { idx: 6, filled: true, t: MS_TEMPLATES[6], d: MS_DESIGNS[1], note: "Square brass" },
    { idx: 7, filled: true, t: MS_TEMPLATES[8],  d: MS_DESIGNS[6], note: "Bookmark" },
    { idx: 8, filled: true, t: MS_TEMPLATES[11], d: MS_DESIGNS[7], note: "Bookmark set" },
    { idx: 9, filled: false, note: "Boş — sürükle bırak" },
    { idx: 10,filled: false, note: "Boş — sürükle bırak" },
  ];
  return (
    <StudioFrame
      title="Send to Listing"
      subtitle="Mockup Studio çıktısını Listing Builder'a aktar — hero + 9 gallery slot"
      breadcrumb="Send to Listing"
      actions={<>
        <Button variant="ghost">İptal</Button>
        <Button variant="secondary" icon={I.image || I.plus}>Append to gallery</Button>
        <Button variant="primary" iconRight={I.arrowRight || I.plus}>Replace gallery & open Listing</Button>
      </>}
    >
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>

        {/* Source — output gallery */}
        <aside>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 10 }}>Kaynak — Output gallery · 12</div>
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", padding: 12, display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, maxHeight: 540, overflow: "auto" }}>
            {[
              [MS_TEMPLATES[0], MS_DESIGNS[0]], [MS_TEMPLATES[3], MS_DESIGNS[0]],
              [MS_TEMPLATES[1], MS_DESIGNS[0]], [MS_TEMPLATES[2], MS_DESIGNS[5]],
              [MS_TEMPLATES[5], MS_DESIGNS[2]], [MS_TEMPLATES[6], MS_DESIGNS[1]],
              [MS_TEMPLATES[8], MS_DESIGNS[6]], [MS_TEMPLATES[11], MS_DESIGNS[7]],
              [MS_TEMPLATES[14], MS_DESIGNS[9]], [MS_TEMPLATES[15], MS_DESIGNS[9]],
              [MS_TEMPLATES[10], MS_DESIGNS[8]], [MS_TEMPLATES[7], MS_DESIGNS[4]],
            ].map(([t, d], i) =>
              <div key={i} style={{ aspectRatio: "1 / 1", borderRadius: 4, overflow: "hidden", border: "1px solid var(--color-border)", position: "relative" }}>
                <MSScene template={t} design={d} />
                {i === 0 && <div style={{ position: "absolute", top: 4, left: 4 }}><span className="ms-hero-badge" style={{ padding: "2px 5px", fontSize: 8 }}>Hero</span></div>}
              </div>
            )}
          </div>

          <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--color-surface-2)", borderRadius: 6, fontSize: 12, color: "var(--color-text-muted)" }}>
            <strong style={{ color: "var(--color-text)", display: "block", marginBottom: 4 }}>Mod seçimi</strong>
            <Chip active>Replace gallery</Chip><Chip style={{ marginLeft: 4 }}>Append</Chip><Chip style={{ marginLeft: 4 }}>Send selected</Chip>
          </div>
        </aside>

        {/* Target — listing slot grid */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Hedef — Listing Builder · Gallery slots (10 max)</span>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-muted)" }}>Listing: <strong>Moon Phases · Boho Wall Art Set</strong> · DRAFT</span>
          </div>

          <div style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: 16
          }}>
            {/* hero row */}
            <div style={{ marginBottom: 16 }}>
              <SlotCard slot={slots[0]} large />
            </div>
            {/* 3x3 gallery */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {slots.slice(1, 10).map(s => <SlotCard key={s.idx} slot={s} />)}
            </div>

            {/* Digital previews group */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "baseline", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>Digital product previews</span>
                <span style={{ marginLeft: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>Etsy listing — file delivery preview</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-muted)" }}>3 önizleme</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[MS_TEMPLATES[14], MS_TEMPLATES[15], MS_TEMPLATES[17]].map((t, i) =>
                  <div key={i} style={{ aspectRatio: "4 / 3", border: "1px solid var(--color-border)", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                    <MSScene template={t} design={MS_DESIGNS[9]} />
                    <div style={{ position: "absolute", left: 6, top: 6, fontFamily: "var(--font-mono)", fontSize: 9, background: "rgba(255,255,255,0.92)", padding: "2px 5px", borderRadius: 3, color: "var(--color-text-muted)" }}>DIGITAL PREVIEW</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudioFrame>
  );
}

function SlotCard({ slot, large }) {
  const isHero = slot.hero;
  return (
    <div style={{
      position: "relative",
      aspectRatio: large ? "16 / 7" : "1 / 1",
      borderRadius: 6,
      overflow: "hidden",
      border: `1.5px solid ${isHero ? "#B7975B" : slot.filled ? "var(--color-border)" : "transparent"}`,
      background: slot.filled ? "var(--color-surface)" : "var(--color-surface-2)",
      backgroundImage: slot.filled ? "none" : "repeating-linear-gradient(45deg, transparent 0 6px, rgba(26,23,21,0.04) 6px 12px)",
      borderStyle: slot.filled ? "solid" : "dashed",
    }}>
      {slot.filled
        ? <>
            <MSScene template={slot.t} design={slot.d} />
            <div style={{ position: "absolute", top: 6, left: 6, width: 20, height: 20, borderRadius: 4, background: "rgba(26,23,21,0.85)", color: "#FFF", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>{slot.idx}</div>
            {isHero && <div style={{ position: "absolute", top: 6, right: 6 }}><span className="ms-hero-badge">★ Hero</span></div>}
            <div style={{ position: "absolute", bottom: 6, left: 6, fontFamily: "var(--font-mono)", fontSize: 10, background: "rgba(255,255,255,0.92)", padding: "2px 6px", borderRadius: 3, color: "var(--color-text-muted)" }}>{slot.note}</div>
          </>
        : <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, color: "var(--color-text-subtle)", marginBottom: 4 }}>＋</div>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)", letterSpacing: "0.04em" }}>SLOT {slot.idx}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-subtle)" }}>{slot.note}</div>
            </div>
          </div>
      }
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// S10 · Saved Sets
// ═══════════════════════════════════════════════════════════
function S10_SavedSets() {
  return (
    <StudioFrame
      title="Saved Sets"
      subtitle="Favorites · Recent · Preset packs — herhangi birini yeni batch'in başlangıcı yap"
      breadcrumb="Saved sets"
      actions={<>
        <Button variant="secondary" icon={I.plus}>Yeni preset oluştur</Button>
        <Button variant="primary" icon={I.refresh || I.plus}>Tekrar kullan</Button>
      </>}
      toolbar={<>
        <Chip active>Tümü · 18</Chip>
        <Chip>Favorites · 6</Chip>
        <Chip>Recent · 8</Chip>
        <Chip>Preset packs · 6</Chip>
        <span style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />
        <Chip>Wall art</Chip>
        <Chip>Bookmark</Chip>
        <Chip>Clipart</Chip>
      </>}
    >
      <div style={{ padding: 24 }}>

        {/* Featured presets */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 10 }}>Featured preset packs</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {MS_PRESETS.filter(p => p.featured).map(p => <FeaturedSetCard key={p.id} preset={p} />)}
          </div>
        </div>

        {/* Saved sets */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 10 }}>Senin set'lerin</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {MS_SAVED_SETS.map(s => <SavedSetCard key={s.id} set={s} />)}
          </div>
        </div>

        {/* Bookmark / clipart / wall art ready packs */}
        <div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 10 }}>Hazır başlangıç pack'leri</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            <ReadyPackCard
              title="Bookmark Launch · 6 mockup"
              tag="Bookmark"
              templates={[MS_TEMPLATES[8], MS_TEMPLATES[9], MS_TEMPLATES[10], MS_TEMPLATES[11]]}
              variant="bookmark-floral"
            />
            <ReadyPackCard
              title="Clipart Digital · 5 listing"
              tag="Clipart"
              templates={[MS_TEMPLATES[14], MS_TEMPLATES[15], MS_TEMPLATES[16], MS_TEMPLATES[17]]}
              variant="clipart-grid"
            />
            <ReadyPackCard
              title="Wall Art Bundle · 12 sahne"
              tag="Wall art · Premium"
              templates={[MS_TEMPLATES[0], MS_TEMPLATES[1], MS_TEMPLATES[2], MS_TEMPLATES[3]]}
              variant="boho-moon"
            />
          </div>
        </div>
      </div>
    </StudioFrame>
  );
}

function FeaturedSetCard({ preset }) {
  return (
    <Card interactive style={{ padding: 16, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{preset.name}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>{preset.desc}</div>
        </div>
        {preset.premium ? <Badge tone="warning">Premium</Badge> : <Badge tone="accent" dot>Featured</Badge>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-subtle)" }}>{preset.count} mockup · {preset.for.join(" · ")}</span>
        <Button variant="ghost" size="sm" iconRight={I.arrowRight || I.plus}>Kullan</Button>
      </div>
    </Card>
  );
}

function SavedSetCard({ set }) {
  return (
    <Card interactive style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ position: "relative", aspectRatio: "5 / 3", overflow: "hidden", background: "#F8F2E5" }}>
        <div className={`ms-art ms-art--${set.thumb}`} style={{ position: "absolute", inset: 0, opacity: 0.65 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 0%, rgba(26,23,21,0.55) 100%)" }} />
        <div style={{ position: "absolute", left: 12, bottom: 12, color: "#FFF" }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{set.name}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.8 }}>{set.count} mockup · {set.uses} kullanım</div>
        </div>
        <div style={{ position: "absolute", right: 8, top: 8 }}>
          {set.type === "favorite" ? <Badge tone="accent" dot>Favorite</Badge> : <Badge tone="info" dot>Preset</Badge>}
        </div>
      </div>
      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-subtle)" }}>Güncellendi · {set.updated}</span>
        <Button variant="ghost" size="sm" iconRight={I.arrowRight || I.plus}>Reuse</Button>
      </div>
    </Card>
  );
}

function ReadyPackCard({ title, tag, templates, variant }) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gridTemplateRows: "repeat(2,1fr)", aspectRatio: "5 / 3" }}>
        {templates.map((t, i) =>
          <div key={i} style={{ borderRight: i % 2 === 0 ? "1px solid var(--color-border-subtle)" : "none", borderBottom: i < 2 ? "1px solid var(--color-border-subtle)" : "none", overflow: "hidden", position: "relative" }}>
            <MSScene template={t} design={{ variant }} />
          </div>
        )}
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Chip active style={{ padding: "1px 6px", fontSize: 10 }}>{tag}</Chip>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        <Button variant="primary" size="sm" style={{ marginTop: 10, width: "100%" }} iconRight={I.arrowRight || I.plus}>Bu pack ile başla</Button>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// S11 · Failed Render Recovery
// ═══════════════════════════════════════════════════════════
function S11_FailedRecovery() {
  const failed = [
    { d: MS_DESIGNS[2], t: MS_TEMPLATES[0], err: "ratio_mismatch", detail: "Tasarım 3:2 landscape, template 2:3 portrait — kırpma riski" },
    { d: MS_DESIGNS[3], t: MS_TEMPLATES[6], err: "low_resolution", detail: "Template 4500px gerektiriyor, tasarım 2400px" },
    { d: MS_DESIGNS[5], t: MS_TEMPLATES[6], err: "safe_area_overflow", detail: "Tasarımın %4'ü güvenli alan dışında — kenar metni kırpılır" },
  ];

  return (
    <StudioFrame
      title="Failed Render Recovery"
      subtitle="Batch'ten 3 öğe başarısız oldu — onar, swap'la, çıkar veya tüm batch'i bozmadan kurtar"
      breadcrumb="Render queue › Failed"
      actions={<>
        <Button variant="ghost">Sadece failed olanları çıkar</Button>
        <Button variant="secondary" icon={I.swap || I.plus}>Compatible template'lere swap</Button>
        <Button variant="primary" icon={I.refresh || I.plus}>Retry · 3</Button>
      </>}
    >
      <div style={{ padding: 24 }}>

        {/* Banner */}
        <div style={{
          background: "var(--color-danger-soft)",
          border: "1px solid rgba(177,58,40,0.25)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
          marginBottom: 24,
          display: "flex", alignItems: "center", gap: 14
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-danger)" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-danger)" }}>3 mockup başarısız oldu — batch'in kalanı (9 / 12) sağlam</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>1 ratio mismatch · 1 low resolution · 1 safe area overflow. Provider hatası değil; tasarım/template uyuşmazlığı.</div>
          </div>
          <Button variant="primary" icon={I.refresh || I.plus}>Hepsini retry</Button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {failed.map((f, i) => <FailedRow key={i} f={f} />)}
        </div>
      </div>
    </StudioFrame>
  );
}

function FailedRow({ f }) {
  const errLabel = {
    ratio_mismatch: "Ratio mismatch",
    low_resolution: "Low resolution",
    safe_area_overflow: "Safe area overflow",
  }[f.err];
  return (
    <Card style={{ padding: 0, overflow: "hidden", border: "1.5px solid var(--color-danger)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "200px 200px 1fr 280px", alignItems: "stretch" }}>
        {/* Original (failed) */}
        <div style={{ position: "relative", borderRight: "1px solid var(--color-border-subtle)" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <MSScene template={f.t} design={f.d} withScrim scrimLabel="Failed" />
          </div>
          <div style={{ position: "absolute", left: 8, top: 8 }}>
            <Badge tone="danger" dot>Failed</Badge>
          </div>
        </div>

        {/* Suggested swap (compatible) */}
        <div style={{ position: "relative", borderRight: "1px solid var(--color-border-subtle)", background: "var(--color-success-soft)" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <MSScene template={MS_TEMPLATES[5]} design={f.d} />
          </div>
          <div style={{ position: "absolute", left: 8, top: 8 }}>
            <Badge tone="success" dot>Compatible swap</Badge>
          </div>
        </div>

        {/* Detail */}
        <div style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-danger)" }}>{errLabel}</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{f.d.title} → {f.t.name.split("·")[0].trim()}</div>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{f.detail}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <RatioBadge ratio={f.d.ratio} />
            <span style={{ fontSize: 11, color: "var(--color-text-subtle)", fontFamily: "var(--font-mono)" }}>tasarım</span>
            <span style={{ color: "var(--color-text-subtle)" }}>→</span>
            <RatioBadge ratio={f.t.ratio} mismatch={f.err === "ratio_mismatch"} />
            <span style={{ fontSize: 11, color: "var(--color-text-subtle)", fontFamily: "var(--font-mono)" }}>template</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: 16, borderLeft: "1px solid var(--color-border-subtle)", display: "flex", flexDirection: "column", gap: 8, justifyContent: "center", background: "var(--color-surface-2)" }}>
          <Button variant="primary" icon={I.swap || I.plus} style={{ width: "100%" }}>Bu swap'la değiştir</Button>
          <Button variant="secondary" icon={I.refresh || I.plus} style={{ width: "100%" }}>Aynı template'le retry</Button>
          <Button variant="ghost" icon={I.edit || I.search} style={{ width: "100%" }}>Editor'da aç</Button>
          <Button variant="ghost" icon={I.trash || I.x || I.minus || I.search} style={{ width: "100%", color: "var(--color-danger)" }}>Batch'ten çıkar</Button>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// S12 · First-time Onboarding
// ═══════════════════════════════════════════════════════════
function S12_Onboarding() {
  return (
    <StudioFrame
      title="Mockup Studio'ya hoş geldin"
      subtitle="3 adımda ilk batch'ini al — tasarım seç, preset uygula, render et"
      breadcrumb="İlk kullanım"
    >
      <div style={{ padding: 32, display: "grid", gridTemplateColumns: "1fr", gap: 24, maxWidth: 1180, margin: "0 auto" }}>

        {/* Stepper hero */}
        <div style={{ position: "relative" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, position: "relative" }}>
            {/* connector */}
            <div style={{ position: "absolute", left: "16%", right: "16%", top: 22, height: 2, background: "var(--color-border)", zIndex: 0 }} />
            {[
              { n: 1, label: "Tasarımı seç", sub: "Reference / Collection / Local / Generated", active: true },
              { n: 2, label: "Preset uygula", sub: "Bookmark · Clipart · Wall art preset paketleri" },
              { n: 3, label: "Batch render", sub: "Review → queue → output gallery → listing" },
            ].map((s, i) =>
              <div key={i} style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%",
                  background: s.active ? "var(--color-accent)" : "var(--color-surface)",
                  color: s.active ? "#FFF" : "var(--color-text)",
                  border: `2px solid ${s.active ? "var(--color-accent)" : "var(--color-border-strong)"}`,
                  display: "grid", placeItems: "center",
                  fontSize: 17, fontWeight: 600, fontFamily: "var(--font-mono)",
                  boxShadow: s.active ? "0 0 0 6px rgba(232,93,37,0.12)" : "none"
                }}>{s.n}</div>
                <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4, maxWidth: 280 }}>{s.sub}</div>
              </div>
            )}
          </div>
        </div>

        {/* 3 entry use-cases */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 12, textAlign: "center" }}>
            Bir başlangıç noktası seç — her biri 3 dakikalık örnek batch
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            <OnboardEntry
              title="Bookmark"
              sub="Pressed flower bookmark · 6 mockup"
              kpis={[{l:"Mockup",v:"6"},{l:"Süre",v:"~1 dk"},{l:"Set",v:"Single + 3 + handheld + book"}]}
              tpl={MS_TEMPLATES[8]} variant="bookmark-floral"
            />
            <OnboardEntry
              title="Clipart bundle"
              sub="Botanical clipart · 5 digital listing"
              kpis={[{l:"Mockup",v:"5"},{l:"Süre",v:"~50 sn"},{l:"Format",v:"PNG · SVG · PDF"}]}
              tpl={MS_TEMPLATES[14]} variant="clipart-grid"
              accent
            />
            <OnboardEntry
              title="Wall art"
              sub="Boho moon · Etsy optimized · 8 mockup"
              kpis={[{l:"Mockup",v:"8"},{l:"Süre",v:"~2 dk"},{l:"Sahne",v:"Living + nursery + office"}]}
              tpl={MS_TEMPLATES[0]} variant="boho-moon"
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16 }}>
          <Button variant="ghost">Tur'u atla</Button>
          <Button variant="primary" iconRight={I.arrowRight || I.plus}>İlk batch'imi başlat</Button>
        </div>
      </div>
    </StudioFrame>
  );
}

function OnboardEntry({ title, sub, kpis, tpl, variant, accent }) {
  return (
    <Card interactive style={{
      padding: 0, overflow: "hidden", cursor: "pointer",
      borderColor: accent ? "var(--color-accent)" : "var(--color-border)",
      outline: accent ? "3px solid rgba(232,93,37,0.10)" : "none",
      outlineOffset: -1
    }}>
      <div style={{ aspectRatio: "5 / 3", position: "relative", overflow: "hidden" }}>
        <MSScene template={tpl} design={{ variant }} />
        {accent && <div style={{ position: "absolute", top: 12, left: 12 }}><Badge tone="accent" dot>Recommended</Badge></div>}
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2, marginBottom: 12 }}>{sub}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, marginBottom: 12 }}>
          {kpis.map((k, i) =>
            <div key={i}>
              <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{k.v}</div>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{k.l}</div>
            </div>
          )}
        </div>
        <Button variant={accent ? "primary" : "secondary"} size="sm" style={{ width: "100%" }} iconRight={I.arrowRight || I.plus}>Bu örnekle başla</Button>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════
// S13 · Admin Template Management
// ═══════════════════════════════════════════════════════════
function S13_AdminTemplates() {
  const adminRows = MS_TEMPLATES.slice(0, 14).map((t, i) => ({
    ...t,
    active: i !== 5 && i !== 13,
    placeholder: !!t.tags && t.tags.includes("kraft"),
    safeArea: ["6%","8%","4%","6%","6%","6%","8%","6%","12%","12%","8%","12%","10%","6%"][i],
    coords: ["x:34 y:12 w:32 h:50","x:36 y:14 w:30 h:48","x:36 y:18 w:28 h:42","x:16/40/64","x:30 y:20 w:40 h:36","x:26 y:20 w:48 h:32","x:36 y:18 w:28 h:44","x:34 y:14 w:32 h:50","x:42 y:12 w:14 h:70","x:62 y:10 w:8 h:70","x:44 y:12 w:12 h:62","x:22/44/66","x:fan-5","x:42 y:12 w:14 h:70"][i],
    use: [842,612,498,1024,221,87,156,310,720,564,402,389,205,68][i],
  }));
  return (
    <StudioFrame
      title="Admin · Mockup Template Catalog"
      subtitle="Tüm template'lerin tek panelde yönetimi — kategori, oran, tag, placeholder ve safe area"
      breadcrumb="Admin / Mockup Templates"
      actions={<>
        <Button variant="ghost" icon={I.upload || I.plus}>CSV import</Button>
        <Button variant="secondary" icon={I.bookmark || I.plus}>Preset paketleri</Button>
        <Button variant="primary" icon={I.plus}>Yeni template</Button>
      </>}
      toolbar={<>
        <Input prefix={I.search} placeholder="Template ara…" style={{ width: 260 }} />
        <Chip active>Tümü · {adminRows.length}</Chip>
        <Chip>Active · 12</Chip>
        <Chip>Inactive · 2</Chip>
        <Chip>Premium · 6</Chip>
        <Chip>Recommended · 9</Chip>
        <span style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />
        <Chip>Wall art</Chip>
        <Chip>Bookmark</Chip>
        <Chip>Clipart</Chip>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>~20 dk önce sync</span>
      </>}
    >
      <div className="eh-app" data-density="admin" style={{ padding: 16 }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {/* head */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "32px 64px 2fr 100px 90px 1.4fr 80px 100px 80px 90px 36px",
            padding: "8px 12px",
            fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
            textTransform: "uppercase", color: "var(--color-text-muted)",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-surface-2)", gap: 8, alignItems: "center"
          }}>
            <span></span><span></span>
            <span>Name / scene</span>
            <span>Product</span>
            <span>Ratio</span>
            <span>Tags</span>
            <span>Coords</span>
            <span>Safe area</span>
            <span>Usage</span>
            <span>Status</span>
            <span></span>
          </div>
          {adminRows.map((r, i) => <AdminTemplateRow key={r.id} r={r} alt={i % 2 === 0} />)}
        </Card>
      </div>
    </StudioFrame>
  );
}

function AdminTemplateRow({ r, alt }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "32px 64px 2fr 100px 90px 1.4fr 80px 100px 80px 90px 36px",
      gap: 8, alignItems: "center",
      padding: "8px 12px",
      fontSize: 13, fontFamily: "var(--font-sans)",
      borderBottom: "1px solid var(--color-border-subtle)",
      background: alt ? "transparent" : "rgba(243,242,236,0.4)"
    }}>
      <input type="checkbox" />
      <div style={{ width: 56, height: 42, borderRadius: 3, overflow: "hidden", border: "1px solid var(--color-border)" }}>
        <MSScene template={r} design={{ variant: r.product === "bookmark" ? "bookmark-floral" : r.product === "clipart" ? "clipart-grid" : "abstract-warm" }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-subtle)" }}>id: {r.id} · scene: {r.scene} · room: {r.room}</div>
      </div>
      <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{r.product}</span>
      <RatioBadge ratio={r.ratio} />
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {r.tags.slice(0, 3).map(tag => <Chip key={tag} style={{ padding: "1px 5px", fontSize: 10 }}>{tag}</Chip>)}
        {r.recommended && <Badge tone="accent">★</Badge>}
        {r.premium && <Badge tone="warning">$</Badge>}
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.coords}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>{r.safeArea}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.use}</span>
      <span>{r.active
        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-success)" }} />Active</span>
        : <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-text-subtle)" }} />Inactive</span>}
      </span>
      <Button variant="ghost" size="sm">⋯</Button>
    </div>
  );
}

Object.assign(window, {
  S7_RenderQueue, S8_OutputGallery, S9_SendToListing,
  S10_SavedSets, S11_FailedRecovery, S12_Onboarding, S13_AdminTemplates,
});
