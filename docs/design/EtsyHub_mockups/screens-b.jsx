/* global React, PageShell, Button, Badge, Chip, Input, Card, Thumb, StateMessage, Skeleton, I */

// ==========================================================
// EtsyHub · Phase 2 ekranları (B.5 – B.15)
// Hepsi mevcut primitive ailesini kullanır, yeni primitive yok.
// Title-case status badge · aynı accent · aynı hover disiplini.
// ==========================================================

// ─── Mini yardımcılar (local, primitive değil) ────────────
function Toggle({ on, onChange, label }) {
  return (
    <button onClick={() => onChange && onChange(!on)} aria-pressed={on} style={{
      width: 34, height: 20, padding: 2, flexShrink: 0,
      background: on ? "var(--color-accent)" : "var(--color-surface-3)",
      border: "none", borderRadius: 999, cursor: "pointer",
      transition: "background var(--dur-fast)",
      display: "flex", alignItems: "center",
    }} aria-label={label}>
      <span style={{
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff", display: "block",
        transform: on ? "translateX(14px)" : "translateX(0)",
        transition: "transform var(--dur-fast)",
        boxShadow: "0 1px 2px rgba(0,0,0,.2)",
      }}/>
    </button>
  );
}

function SectionTitle({ children, meta }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", marginBottom: "var(--space-3)" }}>
      <div style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>{children}</div>
      {meta && <div style={{ marginLeft: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>{meta}</div>}
    </div>
  );
}

// Thumbnail gallery rule — karışık (Matesy/Etsy tarzı zengin placeholder + neutral karışım)
const kinds = ["boho", "nursery", "christmas", "clipart", "sticker", "poster", "abstract", "landscape"];

// ==========================================================
// B.4 · References grid
// ==========================================================
function References() {
  const items = [
    { k: "boho", title: "Moon phase boho set", coll: "Boho Wall Art", product: "wall art", added: "2 gün önce", variants: 0 },
    { k: "nursery", title: "Little one alphabet", coll: "Nursery Clipart", product: "clipart", added: "4 gün önce", variants: 12 },
    { k: "christmas", title: "Vintage Christmas card", coll: "Holiday 2026", product: "printable", added: "1 hafta önce", variants: 6 },
    { k: "poster", title: "Stay wild typography", coll: "Minimal Posters", product: "poster", added: "1 hafta önce", variants: 18 },
    { k: "clipart", title: "Kids animals bundle", coll: "Nursery Clipart", product: "clipart", added: "2 hafta önce", variants: 0 },
    { k: "landscape", title: "Mountain sunrise", coll: "Boho Wall Art", product: "canvas", added: "2 hafta önce", variants: 9 },
    { k: "abstract", title: "Warm abstract art", coll: null, product: "wall art", added: "3 hafta önce", variants: 24 },
    { k: "sticker", title: "Good vibes stickers", coll: "Sticker Sheets", product: "sticker", added: "1 ay önce", variants: 0 },
  ];

  return (
    <PageShell
      scope="user" active="References"
      title="References"
      subtitle="27 referans · 4 koleksiyonda · üretim için hazır"
      actions={<>
        <Button variant="secondary" icon={I.folder}>Yeni koleksiyon</Button>
        <Button variant="primary" icon={I.sparkle}>Seçileni benzerini yap</Button>
      </>}
      toolbar={<>
        <div style={{ width: 260 }}>
          <Input prefix={I.search} placeholder="Başlık, tag veya koleksiyonda ara"/>
        </div>
        <div style={{ width: 1, height: 20, background: "var(--color-border)" }}/>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-text-subtle)", marginRight: 4 }}>Koleksiyon</span>
        <Chip active>Tümü · 27</Chip>
        <Chip>Boho Wall Art · 8</Chip>
        <Chip>Nursery Clipart · 6</Chip>
        <Chip>Holiday 2026 · 5</Chip>
        <Chip>Minimal Posters · 4</Chip>
        <Chip>Koleksiyonsuz · 4</Chip>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Chip>Ürün: Tümü</Chip>
          <Button variant="ghost" size="sm" icon={I.filter}>Filtre</Button>
        </div>
      </>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
        {items.map((it, i) => <ReferenceCard key={i} {...it} selected={i === 0 || i === 3}/>)}
      </div>
    </PageShell>
  );
}

function ReferenceCard({ k, title, coll, product, added, variants, selected }) {
  const [hover, setHover] = React.useState(false);
  return (
    <Card interactive
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        padding: 0, overflow: "hidden",
        borderColor: selected ? "var(--color-accent)" : undefined,
        boxShadow: selected ? "0 0 0 1px var(--color-accent), var(--shadow-card)" : undefined,
      }}>
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ transform: hover ? "scale(var(--scale-subtle))" : "scale(1)", transition: "transform var(--dur) var(--ease-out)" }}>
          <Thumb kind={k}/>
        </div>
        {selected && <div style={{
          position: "absolute", top: 8, left: 8,
          width: 18, height: 18, borderRadius: 4,
          background: "var(--color-accent)", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{React.cloneElement(I.check, { size: 12 })}</div>}
        {variants > 0 && (
          <div style={{ position: "absolute", bottom: 8, left: 8 }}>
            <Badge tone="neutral"><span style={{ display: "flex", alignItems: "center", gap: 4 }}>{React.cloneElement(I.sparkle, { size: 10 })} {variants} varyasyon</span></Badge>
          </div>
        )}
      </div>
      <div style={{ padding: "var(--space-3)" }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, minWidth: 0 }}>
          {coll ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--color-accent-text)", fontWeight: 500 }}>
              {React.cloneElement(I.folder, { size: 11 })} {coll}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "var(--color-text-subtle)", fontStyle: "italic" }}>Koleksiyonsuz</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>
          <span style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{product}</span>
          <span style={{ marginLeft: "auto" }}>{added}</span>
        </div>
      </div>
    </Card>
  );
}

// ==========================================================
// B.5 · Collections list / grid
// ==========================================================
function Collections() {
  const items = [
    { title: "Boho Wall Art", count: 8, thumbs: ["boho", "abstract", "landscape", "poster"], updated: "2g önce", accent: true },
    { title: "Nursery Clipart", count: 6, thumbs: ["nursery", "clipart", "nursery", "clipart"], updated: "4g önce" },
    { title: "Holiday 2026", count: 5, thumbs: ["christmas", "christmas", "poster", "sticker"], updated: "1h önce" },
    { title: "Minimal Posters", count: 4, thumbs: ["poster", "poster", "abstract", "abstract"], updated: "1h önce" },
    { title: "Sticker Sheets", count: 3, thumbs: ["sticker", "sticker", "sticker"], updated: "2h önce" },
    { title: "Tasarım arşivi 2025", count: 47, thumbs: ["abstract", "boho", "landscape", "nursery"], updated: "1a önce" },
  ];
  return (
    <PageShell
      scope="user" active="Collections"
      title="Collections"
      subtitle="6 koleksiyon · 73 referans"
      actions={<Button variant="primary" icon={I.plus}>Yeni koleksiyon</Button>}
      toolbar={<>
        <div style={{ width: 260 }}>
          <Input prefix={I.search} placeholder="Koleksiyon adı ara"/>
        </div>
        <Chip>Sırala: Son güncelleme</Chip>
      </>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
        {items.map((c, i) => <CollectionCard key={i} {...c}/>)}
      </div>
    </PageShell>
  );
}

function CollectionCard({ title, count, thumbs, updated, accent }) {
  const [hover, setHover] = React.useState(false);
  return (
    <Card interactive
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: 0, overflow: "hidden" }}>
      {/* 2×2 mosaic */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
        gap: 2, aspectRatio: "16 / 9",
        background: "var(--color-border-subtle)",
      }}>
        {thumbs.slice(0, 4).map((k, i) => (
          <div key={i} style={{ overflow: "hidden", position: "relative" }}>
            <div style={{
              position: "absolute", inset: 0,
              transform: hover ? "scale(var(--scale-subtle))" : "scale(1)",
              transition: "transform var(--dur) var(--ease-out)",
            }}>
              <Thumb kind={k} aspect="auto" style={{ width: "100%", height: "100%", borderRadius: 0, aspectRatio: "auto" }}/>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: "var(--space-4)", display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {accent && <div style={{ width: 3, height: 14, background: "var(--color-accent)", borderRadius: 2 }}/>}
            <div style={{ fontSize: "var(--text-md)", fontWeight: 600, letterSpacing: 0 }}>{title}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>
            <span>{count} referans</span>
            <span>·</span>
            <span>{updated}</span>
          </div>
        </div>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4, display: "flex" }}>{I.dots}</button>
      </div>
    </Card>
  );
}

// ==========================================================
// B.6 · Admin Product Types
// ==========================================================
function AdminProductTypes() {
  const rows = [
    { name: "Canvas Wall Art", slug: "canvas-wall-art", aspect: "2:3", active: true, recipes: 3, usage: 412 },
    { name: "Printable Wall Art", slug: "printable", aspect: "2:3", active: true, recipes: 4, usage: 287 },
    { name: "Clipart Bundle", slug: "clipart-bundle", aspect: "1:1", active: true, recipes: 2, usage: 198 },
    { name: "Sticker Sheet", slug: "sticker-sheet", aspect: "1:1", active: true, recipes: 1, usage: 86 },
    { name: "T-Shirt DTG", slug: "tshirt-dtg", aspect: "4:5", active: false, recipes: 0, usage: 0 },
    { name: "Hoodie Print", slug: "hoodie-print", aspect: "4:5", active: false, recipes: 0, usage: 0 },
    { name: "DTF Transfer", slug: "dtf-transfer", aspect: "4:5", active: false, recipes: 0, usage: 0 },
  ];
  return (
    <PageShell
      scope="admin" active="Product Types"
      title="Product Types"
      subtitle="7 tip · 4 aktif"
      actions={<Button variant="primary" size="sm" icon={I.plus}>Yeni tip</Button>}
      toolbar={<>
        <div style={{ width: 240 }}>
          <Input prefix={I.search} placeholder="Tip adı ara"/>
        </div>
        <Chip active>Tümü · 7</Chip>
        <Chip>Aktif · 4</Chip>
        <Chip>Pasif · 3</Chip>
      </>}
    >
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={miniRow({ head: true })}>
          <HeadCell style={{ flex: 2 }}>Tip</HeadCell>
          <HeadCell style={{ width: 110 }}>Slug</HeadCell>
          <HeadCell style={{ width: 70 }}>Aspect</HeadCell>
          <HeadCell style={{ width: 70, textAlign: "right" }}>Recipe</HeadCell>
          <HeadCell style={{ width: 80, textAlign: "right" }}>Usage</HeadCell>
          <HeadCell style={{ width: 80 }}>Durum</HeadCell>
          <HeadCell style={{ width: 28 }}></HeadCell>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={miniRow({})}
            onMouseOver={e => e.currentTarget.style.background = "var(--color-surface-2)"}
            onMouseOut={e => e.currentTarget.style.background = "var(--color-surface)"}>
            <div style={{ flex: 2, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                <Thumb kind={productTypeThumb(r.slug)} aspect="1/1"/>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
                {r.active ? null : <div style={{ fontSize: 11, color: "var(--color-text-subtle)" }}>Kullanıcı panelinde gizli</div>}
              </div>
            </div>
            <Cell style={{ width: 110, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>{r.slug}</Cell>
            <Cell style={{ width: 70, fontFamily: "var(--font-mono)", fontSize: 11 }}>{r.aspect}</Cell>
            <Cell style={{ width: 70, textAlign: "right", fontFamily: "var(--font-mono)" }}>{r.recipes}</Cell>
            <Cell style={{ width: 80, textAlign: "right", fontFamily: "var(--font-mono)", color: r.usage === 0 ? "var(--color-text-subtle)" : "var(--color-text)" }}>{r.usage}</Cell>
            <Cell style={{ width: 80 }}>
              <Toggle on={r.active} label="active"/>
            </Cell>
            <Cell style={{ width: 28 }}>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4, display: "flex" }}>{I.dots}</button>
            </Cell>
          </div>
        ))}
      </Card>
    </PageShell>
  );
}
function productTypeThumb(slug) {
  if (slug.includes("canvas") || slug.includes("printable")) return "landscape";
  if (slug.includes("clipart")) return "clipart";
  if (slug.includes("sticker")) return "sticker";
  return "neutral";
}

// ==========================================================
// B.7 · Admin Feature Flags
// ==========================================================
function AdminFeatureFlags() {
  const flags = [
    { key: "trend_cluster_detection", name: "Trend Cluster Detection", desc: "Benzer yeni listingleri trend grubu olarak kümeler", scope: "user", state: "on", rollout: 100, env: "prod" },
    { key: "ai_review_v2", name: "AI Review v2", desc: "Gibberish + watermark + artifact detection", scope: "user", state: "rollout", rollout: 45, env: "prod" },
    { key: "chrome_extension", name: "Chrome Extension Import", desc: "Bookmarklet ile tek tık bookmark", scope: "user", state: "beta", rollout: 10, env: "prod" },
    { key: "dtf_product_type", name: "DTF Transfer Product Type", desc: "DTF ürün tipini kullanıcı paneline aç", scope: "user", state: "off", rollout: 0, env: "prod" },
    { key: "cost_guardrails", name: "Cost Guardrails", desc: "Günlük/aylık AI üretim limiti", scope: "user", state: "on", rollout: 100, env: "prod" },
    { key: "prompt_playground", name: "Prompt Playground", desc: "Admin prompt test ortamı", scope: "admin", state: "on", rollout: 100, env: "prod" },
    { key: "similarity_search", name: "Visual Similarity Search", desc: "Embedding tabanlı benzer görsel araması", scope: "user", state: "off", rollout: 0, env: "dev" },
  ];
  return (
    <PageShell
      scope="admin" active="Feature Flags"
      title="Feature Flags"
      subtitle="7 flag · 3 prod açık · 2 rollout"
      actions={<Button variant="primary" size="sm" icon={I.plus}>Yeni flag</Button>}
      toolbar={<>
        <div style={{ width: 240 }}>
          <Input prefix={I.search} placeholder="Flag anahtarı veya isim ara"/>
        </div>
        <Chip active>Tümü · 7</Chip>
        <Chip>Prod · 6</Chip>
        <Chip>Dev · 1</Chip>
        <Chip>Açık · 3</Chip>
        <Chip>Rollout · 2</Chip>
      </>}
    >
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={miniRow({ head: true })}>
          <HeadCell style={{ flex: 2 }}>Flag</HeadCell>
          <HeadCell style={{ width: 70 }}>Kapsam</HeadCell>
          <HeadCell style={{ width: 70 }}>Ortam</HeadCell>
          <HeadCell style={{ width: 110 }}>Durum</HeadCell>
          <HeadCell style={{ width: 110 }}>Rollout</HeadCell>
          <HeadCell style={{ width: 90 }}>Toggle</HeadCell>
          <HeadCell style={{ width: 28 }}></HeadCell>
        </div>
        {flags.map((f, i) => (
          <div key={i} style={miniRow({})}
            onMouseOver={e => e.currentTarget.style.background = "var(--color-surface-2)"}
            onMouseOut={e => e.currentTarget.style.background = "var(--color-surface)"}>
            <div style={{ flex: 2, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>{f.key}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 1 }}>{f.name}</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{f.desc}</div>
            </div>
            <Cell style={{ width: 70 }}>
              <Badge tone="neutral">{f.scope}</Badge>
            </Cell>
            <Cell style={{ width: 70 }}>
              <Badge tone={f.env === "prod" ? "info" : "warning"}>{f.env}</Badge>
            </Cell>
            <Cell style={{ width: 110 }}>
              <Badge
                tone={{ on: "success", off: "neutral", rollout: "warning", beta: "info" }[f.state]}
                dot>
                {{ on: "Açık", off: "Kapalı", rollout: "Rollout", beta: "Beta" }[f.state]}
              </Badge>
            </Cell>
            <Cell style={{ width: 110 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 4, background: "var(--color-surface-3)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${f.rollout}%`, height: "100%", background: f.rollout === 100 ? "var(--color-success)" : "var(--color-accent)" }}/>
                </div>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", width: 32, textAlign: "right" }}>{f.rollout}%</span>
              </div>
            </Cell>
            <Cell style={{ width: 90 }}>
              <Toggle on={f.state === "on" || f.state === "rollout" || f.state === "beta"} label={f.key}/>
            </Cell>
            <Cell style={{ width: 28 }}>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4, display: "flex" }}>{I.dots}</button>
            </Cell>
          </div>
        ))}
      </Card>
    </PageShell>
  );
}

// ==========================================================
// B.8 · Competitors
// ==========================================================
function Competitors() {
  const stores = [
    { name: "BohoNestStudio", url: "bohoneststudio.etsy.com", avatar: "#C1582C", listings: 847, reviews: 12420, rating: 4.9, tracking: "14g", growth: "+8%" },
    { name: "LittleOneArts", url: "littleonearts.etsy.com", avatar: "#E8D4B8", listings: 312, reviews: 4820, rating: 4.8, tracking: "7g", growth: "+14%" },
    { name: "VintageJoyShop", url: "vintagejoyshop.etsy.com", avatar: "#1E3A2E", listings: 1204, reviews: 28300, rating: 4.9, tracking: "30g", growth: "+3%" },
  ];
  const topListings = [
    { k: "boho", title: "Boho moon phase wall art set of 3", store: "BohoNestStudio", reviews: 482, price: "$24.99", window: "30g", trend: "+18%" },
    { k: "poster", title: "Stay wild typography poster", store: "BohoNestStudio", reviews: 391, price: "$18.50", window: "30g", trend: "+12%" },
    { k: "nursery", title: "Nursery alphabet printable set", store: "LittleOneArts", reviews: 358, price: "$12.00", window: "30g", trend: "+22%" },
    { k: "christmas", title: "Vintage Christmas card set 6 designs", store: "VintageJoyShop", reviews: 312, price: "$8.99", window: "30g", trend: "+4%" },
    { k: "abstract", title: "Warm abstract canvas gallery set", store: "BohoNestStudio", reviews: 287, price: "$32.00", window: "30g", trend: "+9%" },
    { k: "clipart", title: "Woodland animals clipart bundle 48 PNG", store: "LittleOneArts", reviews: 234, price: "$9.99", window: "30g", trend: "+15%" },
    { k: "landscape", title: "Mountain sunrise canvas print", store: "BohoNestStudio", reviews: 218, price: "$28.00", window: "30g", trend: "+7%" },
    { k: "sticker", title: "Good vibes sticker sheet 12 designs", store: "VintageJoyShop", reviews: 198, price: "$6.50", window: "30g", trend: "+5%" },
  ];

  return (
    <PageShell
      scope="user" active="Competitors"
      title="Competitors"
      subtitle="3 mağaza takipte · son tarama 2 saat önce"
      actions={<>
        <Button variant="secondary" icon={I.download}>Export CSV</Button>
        <Button variant="primary" icon={I.plus}>Mağaza ekle</Button>
      </>}
    >
      {/* Store add shortcut */}
      <Card style={{ padding: "var(--space-4)", marginBottom: "var(--space-5)", display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.8, color: "var(--color-text-muted)", flexShrink: 0 }}>Hızlı ekle</div>
        <div style={{ flex: 1, maxWidth: 460 }}>
          <Input prefix={I.store} placeholder="shop name veya https://www.etsy.com/shop/..."/>
        </div>
        <Button variant="primary" icon={I.sparkle}>Analiz et</Button>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>Yorum sayısı · satış sinyali olarak</span>
      </Card>

      {/* Tracked stores */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        {stores.map((s, i) => (
          <Card key={i} interactive style={{ padding: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 6,
                background: s.avatar, flexShrink: 0,
              }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0 }}>{s.name}</div>
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.url}</div>
              </div>
              <Badge tone="success">{s.growth}</Badge>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-2)", marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border-subtle)" }}>
              <StatMini label="Listing" val={s.listings.toLocaleString()}/>
              <StatMini label="Yorum" val={s.reviews.toLocaleString()}/>
              <StatMini label="Rating" val={s.rating}/>
            </div>
            <div style={{ marginTop: "var(--space-3)", display: "flex", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>{s.tracking} takipte</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                <Button variant="ghost" size="sm" icon={I.eye}>Analiz</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Top-reviewed listings */}
      <SectionTitle meta="son 30 gün · yorum sayısı bazlı satış sinyali">En çok yorum alan ürünler</SectionTitle>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={miniRow({ head: true })}>
          <HeadCell style={{ width: 44 }}></HeadCell>
          <HeadCell style={{ flex: 2 }}>Ürün</HeadCell>
          <HeadCell style={{ width: 140 }}>Mağaza</HeadCell>
          <HeadCell style={{ width: 70, textAlign: "right" }} sort>Yorum</HeadCell>
          <HeadCell style={{ width: 70, textAlign: "right" }}>Trend</HeadCell>
          <HeadCell style={{ width: 70, textAlign: "right" }}>Fiyat</HeadCell>
          <HeadCell style={{ width: 180 }}>Aksiyon</HeadCell>
        </div>
        {topListings.map((l, i) => (
          <div key={i} style={miniRow({})}
            onMouseOver={e => e.currentTarget.style.background = "var(--color-surface-2)"}
            onMouseOut={e => e.currentTarget.style.background = "var(--color-surface)"}>
            <div style={{ width: 44 }}>
              <div style={{ width: 36, height: 36, borderRadius: 4, overflow: "hidden" }}>
                <Thumb kind={l.k} aspect="1/1"/>
              </div>
            </div>
            <div style={{ flex: 2, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</div>
            </div>
            <Cell style={{ width: 140, fontSize: 12, color: "var(--color-text-muted)" }}>{l.store}</Cell>
            <Cell style={{ width: 70, textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 500 }}>{l.reviews}</Cell>
            <Cell style={{ width: 70, textAlign: "right" }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-success)" }}>{l.trend}</span>
            </Cell>
            <Cell style={{ width: 70, textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>{l.price}</Cell>
            <Cell style={{ width: 180 }}>
              <div style={{ display: "flex", gap: 4 }}>
                <Button variant="ghost" size="sm" icon={I.bookmark}>Bookmark</Button>
                <Button variant="ghost" size="sm" icon={I.wand}>Benzerini</Button>
              </div>
            </Cell>
          </div>
        ))}
      </Card>
    </PageShell>
  );
}
function StatMini({ label, val }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-text-muted)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2, letterSpacing: 0 }}>{val}</div>
    </div>
  );
}

// ==========================================================
// B.9 · Trend Stories
// ==========================================================
function TrendStories() {
  const clusters = [
    { title: "Moon phase wall art", count: 14, kinds: ["boho", "abstract", "landscape", "boho", "poster", "abstract"], heat: "yüksek" },
    { title: "Nursery name signs", count: 9, kinds: ["nursery", "nursery", "clipart", "nursery", "poster"], heat: "yüksek" },
    { title: "Vintage Christmas", count: 12, kinds: ["christmas", "christmas", "poster", "christmas"], heat: "yükseliyor" },
    { title: "Typography posters", count: 7, kinds: ["poster", "poster", "abstract", "poster"], heat: "yükseliyor" },
  ];
  const stories = [
    { k: "boho", title: "Boho moon phases in muted sage", store: "BohoNestStudio", time: "12 dk önce", tag: "wall art" },
    { k: "nursery", title: "Watercolor alphabet nursery art", store: "LittleOneArts", time: "28 dk önce", tag: "printable" },
    { k: "christmas", title: "Retro Christmas card duo", store: "VintageJoyShop", time: "1 s önce", tag: "card" },
    { k: "poster", title: "Stay wild · typography poster", store: "BohoNestStudio", time: "2 s önce", tag: "poster" },
    { k: "abstract", title: "Warm sunset abstract canvas", store: "BohoNestStudio", time: "3 s önce", tag: "canvas" },
    { k: "clipart", title: "Woodland animal stickers 12pc", store: "LittleOneArts", time: "4 s önce", tag: "clipart" },
    { k: "landscape", title: "Mountain sunrise print set", store: "VintageJoyShop", time: "6 s önce", tag: "wall art" },
    { k: "sticker", title: "Good vibes sheet", store: "LittleOneArts", time: "8 s önce", tag: "sticker" },
  ];

  return (
    <PageShell
      scope="user" active="Trend Stories"
      title="Trend Stories"
      subtitle="48 yeni listing · 3 mağazadan · son 24 saat"
      actions={<>
        <Button variant="secondary" icon={I.filter}>Filtre</Button>
        <Button variant="primary" icon={I.bookmark}>Seçileni bookmark</Button>
      </>}
    >
      {/* Trend clusters */}
      <SectionTitle meta="aynı konuda ≥4 mağaza">Yükselen trendler</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
        {clusters.map((c, i) => <TrendClusterCard key={i} {...c}/>)}
      </div>

      {/* Story feed */}
      <SectionTitle meta="mağaza bazlı son listingler">Yeni listingler</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
        {stories.map((s, i) => <StoryCard key={i} {...s}/>)}
      </div>
    </PageShell>
  );
}

function TrendClusterCard({ title, count, kinds, heat }) {
  const [hover, setHover] = React.useState(false);
  return (
    <Card interactive
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: 0, overflow: "hidden" }}>
      {/* Stacked thumb mosaic */}
      <div style={{
        position: "relative", aspectRatio: "4 / 3",
        background: "var(--color-border-subtle)",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          display: "grid", gridTemplateColumns: "2fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2,
        }}>
          <div style={{ gridRow: "1 / span 2", overflow: "hidden" }}>
            <div style={{ width: "100%", height: "100%", transform: hover ? "scale(var(--scale-subtle))" : "scale(1)", transition: "transform var(--dur) var(--ease-out)" }}>
              <Thumb kind={kinds[0]} aspect="auto" style={{ height: "100%", borderRadius: 0, aspectRatio: "auto" }}/>
            </div>
          </div>
          <div style={{ overflow: "hidden" }}><Thumb kind={kinds[1]} aspect="auto" style={{ height: "100%", borderRadius: 0, aspectRatio: "auto" }}/></div>
          <div style={{ overflow: "hidden" }}><Thumb kind={kinds[2]} aspect="auto" style={{ height: "100%", borderRadius: 0, aspectRatio: "auto" }}/></div>
        </div>
        <div style={{ position: "absolute", top: 8, left: 8 }}>
          <Badge tone={heat === "yüksek" ? "accent" : "warning"} dot>{heat}</Badge>
        </div>
        <div style={{ position: "absolute", bottom: 8, right: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 8px", borderRadius: 3,
            background: "rgba(26,23,21,.82)", color: "#fff",
            fontSize: 11, fontFamily: "var(--font-mono)",
          }}>{React.cloneElement(I.trend, { size: 11 })} {count}</span>
        </div>
      </div>
      <div style={{ padding: "var(--space-3)" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginTop: 4 }}>{count} yeni listing · son 48s</div>
      </div>
    </Card>
  );
}

function StoryCard({ k, title, store, time, tag }) {
  const [hover, setHover] = React.useState(false);
  return (
    <Card interactive
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ transform: hover ? "scale(var(--scale-subtle))" : "scale(1)", transition: "transform var(--dur) var(--ease-out)" }}>
          <Thumb kind={k} aspect="var(--aspect-portrait)"/>
        </div>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          padding: "var(--space-6) var(--space-3) var(--space-3)",
          background: "linear-gradient(180deg, transparent 0%, rgba(26,23,21,.75) 100%)",
          color: "#fff",
        }}>
          <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3, textShadow: "0 1px 2px rgba(0,0,0,.3)" }}>{title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 10, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,.85)" }}>
            <span>{store}</span>
            <span>·</span>
            <span>{time}</span>
          </div>
        </div>
        <div style={{
          position: "absolute", top: 8, right: 8,
          opacity: hover ? 1 : 0, transition: "opacity var(--dur-fast)",
          display: "flex", gap: 4,
        }}>
          <button style={storyBtn}>{I.bookmark}</button>
          <button style={storyBtn}>{I.folder}</button>
          <button style={storyBtn}>{I.wand}</button>
        </div>
        <div style={{ position: "absolute", top: 8, left: 8 }}>
          <Badge tone="neutral">{tag}</Badge>
        </div>
      </div>
    </Card>
  );
}
const storyBtn = {
  width: 28, height: 28, borderRadius: 4,
  background: "rgba(255,255,255,.95)", border: "none",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: "var(--color-text)",
};

// ==========================================================
// B.10 · Confirm dialog catalog (3 tone)
// ==========================================================
function ConfirmDialogs() {
  return (
    <CanvasBackdrop label="Confirm dialog · destructive / warning / neutral">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-6)", padding: "var(--space-8)" }}>
        <DialogCard tone="danger" icon={I.trash}
          title="Bu bookmark'ı sil"
          body="3 bookmark kalıcı olarak silinecek. Referans havuzundaki bağlantılı referanslar etkilenmez."
          cancel="Vazgeç" confirm="Kalıcı olarak sil" confirmVariant="destructive"/>
        <DialogCard tone="warning" icon={I.alert}
          title="15 listing'i Etsy'ye draft olarak gönder"
          body="Tahmini maliyet $0.00 (draft ücretsiz). Gönderildikten sonra Etsy paneli üzerinden aktive edilmelidir."
          cancel="İncele" confirm="Onayla ve gönder"/>
        <DialogCard tone="neutral" icon={I.folder}
          title="Yeni koleksiyon oluştur"
          body="Seçili 3 referans yeni koleksiyona eklenecek."
          extra={<Input placeholder="Koleksiyon adı" style={{ marginTop: 8 }}/>}
          cancel="Vazgeç" confirm="Oluştur"/>
      </div>
    </CanvasBackdrop>
  );
}
function DialogCard({ tone, icon, title, body, extra, cancel, confirm, confirmVariant = "primary" }) {
  const toneColor = {
    danger: "var(--color-danger)",
    warning: "var(--color-warning)",
    neutral: "var(--color-text-muted)",
  }[tone];
  const toneBg = {
    danger: "var(--color-danger-soft)",
    warning: "var(--color-warning-soft)",
    neutral: "var(--color-surface-2)",
  }[tone];
  return (
    <div style={{
      width: 360, background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "var(--shadow-popover)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "var(--space-5) var(--space-5) var(--space-4)", display: "flex", gap: "var(--space-3)" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "var(--radius-md)",
          background: toneBg, color: toneColor,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>{React.cloneElement(icon, { size: 18 })}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 600, letterSpacing: 0 }}>{title}</div>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5, marginTop: 4 }}>{body}</div>
          {extra}
        </div>
      </div>
      <div style={{
        display: "flex", gap: 8, justifyContent: "flex-end",
        padding: "var(--space-3) var(--space-5)",
        borderTop: "1px solid var(--color-border-subtle)",
        background: "var(--color-surface-2)",
      }}>
        <Button variant="ghost" size="sm">{cancel}</Button>
        <Button variant={confirmVariant === "destructive" ? "primary" : "primary"} size="sm"
          style={confirmVariant === "destructive" ? { background: "var(--color-danger)", borderColor: "var(--color-danger)" } : undefined}>
          {confirm}
        </Button>
      </div>
    </div>
  );
}

function CanvasBackdrop({ children, label }) {
  return (
    <div className="eh-app" style={{
      width: "100%", height: "100%",
      background: "var(--color-bg)",
      position: "relative",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "var(--space-4) var(--space-6)",
        borderBottom: "1px solid var(--color-border-subtle)",
        fontSize: 11, fontFamily: "var(--font-mono)",
        textTransform: "uppercase", letterSpacing: 0.8, color: "var(--color-text-subtle)",
      }}>{label}</div>
      <div style={{ flex: 1, background: "var(--color-surface-2)", overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}

// ==========================================================
// B.11 · Empty state catalog (4 örnek)
// ==========================================================
function EmptyStates() {
  const examples = [
    {
      tone: "neutral", icon: I.bookmark,
      title: "Henüz bookmark yok",
      body: "Etsy, Pinterest, Amazon veya herhangi bir URL'yi yapıştırarak fikir toplamaya başla.",
      action: <><Button variant="primary" size="sm" icon={I.plus}>İlk bookmark'ını ekle</Button><Button variant="secondary" size="sm">Chrome extension</Button></>,
      meta: "Bookmarks · ilk kullanım",
    },
    {
      tone: "neutral", icon: I.folder,
      title: "Bu koleksiyonda hiç referans yok",
      body: "Bookmark havuzundan taşı veya direkt URL ile referans ekle.",
      action: <><Button variant="primary" size="sm" icon={I.plus}>Referans ekle</Button><Button variant="ghost" size="sm">Bookmark'lardan seç</Button></>,
      meta: "Collection detail · boş koleksiyon",
    },
    {
      tone: "warning", icon: I.alert,
      title: "Review queue temiz",
      body: "Bekleyen düşük skorlu tasarım yok. Yeni varyasyon ürettiğinde otomatik kontrole alınır.",
      action: <Button variant="secondary" size="sm" icon={I.sparkle}>Yeni varyasyon üret</Button>,
      meta: "Review Queue · beklenen pozitif boş",
    },
    {
      tone: "error", icon: I.x,
      title: "Etsy bağlantısı kurulamadı",
      body: "Token süresi dolmuş veya kullanıcı yetkiyi iptal etmiş. Yeniden bağlanarak listing'leri göndermeye devam edebilirsin.",
      action: <><Button variant="primary" size="sm">Etsy'ye yeniden bağlan</Button><Button variant="ghost" size="sm">Hata detayı</Button></>,
      meta: "Listings · hata hali",
    },
  ];
  return (
    <CanvasBackdrop label="Empty state · StateMessage primitive · 4 ton">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", padding: "var(--space-6)" }}>
        {examples.map((e, i) => (
          <Card key={i} style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              padding: "6px 12px", fontSize: 10, fontFamily: "var(--font-mono)",
              textTransform: "uppercase", letterSpacing: 0.8, color: "var(--color-text-subtle)",
              borderBottom: "1px solid var(--color-border-subtle)",
              background: "var(--color-surface-2)",
            }}>{e.meta}</div>
            <div style={{ padding: "var(--space-6) 0" }}>
              <StateMessage tone={e.tone} icon={e.icon} title={e.title} body={e.body}
                action={<div style={{ display: "flex", gap: 8, justifyContent: "center" }}>{e.action}</div>}/>
            </div>
          </Card>
        ))}
      </div>
    </CanvasBackdrop>
  );
}

// ==========================================================
// B.12 · Skeleton / loading catalog
// ==========================================================
function SkeletonCatalog() {
  return (
    <CanvasBackdrop label="Skeleton · sade pulse · user grid · admin row · detail layout">
      <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* User grid loading — 6 fixed cards */}
        <div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.8, color: "var(--color-text-subtle)", marginBottom: "var(--space-3)" }}>User grid loading · 6 sabit kart</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--space-4)" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ aspectRatio: "var(--aspect-card)", background: "var(--color-surface-3)", animation: "ehPulse 1.4s ease-in-out infinite" }}/>
                <div style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <Skeleton w="85%" h={12}/>
                  <Skeleton w="55%" h={10}/>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Admin row loading — 5 fixed rows */}
        <div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.8, color: "var(--color-text-subtle)", marginBottom: "var(--space-3)" }}>Admin tablo loading · 5 sabit satır</div>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={miniRow({ head: true })}>
              <HeadCell style={{ flex: 2 }}>Kullanıcı</HeadCell>
              <HeadCell style={{ width: 80 }}>Plan</HeadCell>
              <HeadCell style={{ width: 70, textAlign: "right" }}>Jobs</HeadCell>
              <HeadCell style={{ width: 100 }}>Durum</HeadCell>
              <HeadCell style={{ width: 110 }}>Kayıt</HeadCell>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={miniRow({})}>
                <div style={{ flex: 2, display: "flex", alignItems: "center", gap: 10 }}>
                  <Skeleton w={28} h={28} r={99}/>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <Skeleton w={140} h={10}/>
                    <Skeleton w={180} h={8}/>
                  </div>
                </div>
                <Cell style={{ width: 80 }}><Skeleton w={50} h={18} r={4}/></Cell>
                <Cell style={{ width: 70 }}><Skeleton w={40} h={10} style={{ marginLeft: "auto" }}/></Cell>
                <Cell style={{ width: 100 }}><Skeleton w={70} h={18} r={4}/></Cell>
                <Cell style={{ width: 110 }}><Skeleton w={80} h={10}/></Cell>
              </div>
            ))}
          </Card>
        </div>

        {/* Detail layout loading — hero + sidebar */}
        <div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.8, color: "var(--color-text-subtle)", marginBottom: "var(--space-3)" }}>Detay sayfası loading · hero + meta + sidebar</div>
          <Card style={{ padding: "var(--space-5)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-6)" }}>
              <div>
                <Skeleton w="100%" h={320} r={6}/>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Skeleton w={60} h={60} r={4}/>
                  <Skeleton w={60} h={60} r={4}/>
                  <Skeleton w={60} h={60} r={4}/>
                  <Skeleton w={60} h={60} r={4}/>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Skeleton w="60%" h={20}/>
                <Skeleton w="40%" h={12}/>
                <div style={{ height: 12 }}/>
                <Skeleton w="100%" h={10}/>
                <Skeleton w="90%" h={10}/>
                <Skeleton w="70%" h={10}/>
                <div style={{ height: 16 }}/>
                <Skeleton w="100%" h={36} r={6}/>
                <Skeleton w="100%" h={36} r={6}/>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </CanvasBackdrop>
  );
}

// ==========================================================
// B.13 · Selection Studio
// ==========================================================
function SelectionStudio() {
  return (
    <PageShell
      scope="user" active="Selection"
      title="Selection Studio"
      subtitle="Boho wall art · 12 varyasyon · 4 seçildi"
      actions={<>
        <Button variant="secondary" icon={I.download}>Export</Button>
        <Button variant="primary" icon={I.mock}>Mockup'a ilerle</Button>
      </>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "var(--space-4)", height: "calc(100% - var(--space-2))" }}>
        {/* Canvas */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {/* Preview */}
          <Card style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--color-surface-2)" }}>
            <div style={{ width: "100%", maxWidth: 420 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Badge tone="accent" dot>Varyant 03 / 12</Badge>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>4961 × 7016 · 300 DPI</span>
              </div>
              <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--color-border)", background: "#fff" }}>
                <Thumb kind="boho" aspect="var(--aspect-portrait)"/>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, justifyContent: "center" }}>
                <Button variant="ghost" size="sm" icon={I.chevR} style={{ transform: "scaleX(-1)" }}>Önceki</Button>
                <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>03 / 12</span>
                <Button variant="ghost" size="sm" iconRight={I.chevR}>Sonraki</Button>
              </div>
            </div>
          </Card>

          {/* Filmstrip */}
          <Card style={{ padding: "var(--space-3)" }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-text-muted)", marginBottom: 8 }}>Varyantlar</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 6 }}>
              {Array.from({ length: 12 }).map((_, i) => {
                const selected = [0, 2, 5, 8].includes(i);
                const active = i === 2;
                return (
                  <div key={i} style={{
                    position: "relative", cursor: "pointer",
                    borderRadius: 4, overflow: "hidden",
                    border: active ? "2px solid var(--color-accent)" : "2px solid transparent",
                  }}>
                    <Thumb kind={["boho", "abstract", "boho", "landscape", "boho", "boho", "abstract", "boho", "boho", "poster", "boho", "abstract"][i]} aspect="var(--aspect-portrait)"/>
                    {selected && (
                      <div style={{
                        position: "absolute", top: 3, left: 3,
                        width: 14, height: 14, borderRadius: 3,
                        background: "var(--color-accent)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{React.cloneElement(I.check, { size: 9 })}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Edit sidebar */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <div style={{ fontSize: "var(--text-md)", fontWeight: 600 }}>Edit</div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>Varyant 03 düzenleniyor</div>
          </div>

          <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-text-muted)", marginBottom: 8 }}>AI Kalite</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: 0, color: "var(--color-success)" }}>92</div>
              <Badge tone="success" dot>Onaylandı</Badge>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10, fontSize: 11, color: "var(--color-text-muted)" }}>
              {[
                ["Çözünürlük", "4961×7016 · OK", "success"],
                ["Text detection", "Temiz", "success"],
                ["Artifact check", "Minor, görmezden gel", "warning"],
                ["Trademark risk", "Yok", "success"],
              ].map(([k, v, t], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: t === "success" ? "var(--color-success)" : "var(--color-warning)" }}/>
                  <span style={{ flex: 1 }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-text-muted)" }}>Edit prompt</div>
            <div style={{
              minHeight: "var(--min-h-textarea)", padding: "var(--space-3)",
              border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)",
              background: "var(--color-surface)", fontSize: 13, color: "var(--color-text-muted)",
              fontFamily: "var(--font-sans)", letterSpacing: 0,
            }}>rengi daha sıcak ve muted yap, arka planı sadeleştir</div>
            <Button variant="primary" size="sm" icon={I.sparkle}>Edit uygula</Button>
          </div>

          <div style={{ padding: "var(--space-3) var(--space-4)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-text-muted)", marginBottom: 2 }}>Hızlı işlem</div>
            <QuickEdit label="Background remove" icon={I.image}/>
            <QuickEdit label="Upscale 2×" icon={I.sparkle}/>
            <QuickEdit label="Crop · 2:3 portrait" icon={I.layers}/>
            <QuickEdit label="Transparent PNG kontrolü" icon={I.check}/>
          </div>

          <div style={{ marginTop: "auto", padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--color-border-subtle)", display: "flex", gap: 8 }}>
            <Button variant="secondary" size="sm" style={{ flex: 1 }}>Reddet</Button>
            <Button variant="primary" size="sm" style={{ flex: 1 }} icon={I.check}>Seçime ekle</Button>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
function QuickEdit({ label, icon }) {
  return (
    <button style={{
      display: "flex", alignItems: "center", gap: 8,
      height: 32, padding: "0 10px",
      background: "transparent", border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)",
      fontSize: 13, color: "var(--color-text)", cursor: "pointer",
      fontFamily: "var(--font-sans)", letterSpacing: 0,
    }}
    onMouseOver={e => e.currentTarget.style.borderColor = "var(--color-border-strong)"}
    onMouseOut={e => e.currentTarget.style.borderColor = "var(--color-border)"}>
      <span style={{ color: "var(--color-text-muted)", display: "flex" }}>{React.cloneElement(icon, { size: 14 })}</span>
      <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
    </button>
  );
}

// ==========================================================
// B.14 · Mockup Studio
// ==========================================================
function MockupStudio() {
  const templates = [
    { name: "Living room · ivory wall", kind: "landscape", dim: "1920×1200" },
    { name: "Minimal gallery · oak frame", kind: "poster", dim: "1200×1500" },
    { name: "Nursery · soft crib", kind: "nursery", dim: "1600×1200" },
    { name: "Flat lay · paper stack", kind: "poster", dim: "1500×1500" },
    { name: "Closeup · canvas edge", kind: "landscape", dim: "1800×1200" },
    { name: "Desk · muted", kind: "poster", dim: "1500×1000" },
  ];
  return (
    <PageShell
      scope="user" active="Mockups"
      title="Mockup Studio"
      subtitle="Boho wall art · 4 tasarım × 3 mockup = 12 çıktı"
      actions={<>
        <Button variant="secondary" icon={I.plus}>Kendi mockup'ını yükle</Button>
        <Button variant="primary" icon={I.send}>Listing'e ilerle</Button>
      </>}
      toolbar={<>
        <Chip active>Wall art · 18</Chip>
        <Chip>Poster · 12</Chip>
        <Chip>Canvas · 8</Chip>
        <Chip>Clipart cover · 4</Chip>
        <Chip>Sticker sheet · 2</Chip>
        <div style={{ marginLeft: "auto", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>Dynamic Mockups · provider</div>
      </>}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "var(--space-4)" }}>
        <div>
          {/* Featured preview */}
          <Card style={{ padding: 0, overflow: "hidden", marginBottom: "var(--space-4)" }}>
            <div style={{ position: "relative", aspectRatio: "16 / 9", overflow: "hidden" }}>
              <MockupScene/>
              <div style={{ position: "absolute", top: 12, left: 12 }}>
                <Badge tone="accent" dot>Rendered</Badge>
              </div>
              <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 4 }}>
                <button style={storyBtn}>{I.download}</button>
                <button style={storyBtn}>{I.dots}</button>
              </div>
              <div style={{
                position: "absolute", bottom: 12, left: 12, right: 12,
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px",
                background: "rgba(26,23,21,.82)", color: "#fff",
                borderRadius: "var(--radius-md)",
              }}>
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>Living room · ivory wall</span>
                <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "var(--font-mono)", opacity: .7 }}>1920 × 1200 · 18.4 MB</span>
              </div>
            </div>
          </Card>

          {/* Template grid */}
          <SectionTitle meta="6 template">Mockup templates</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)" }}>
            {templates.map((t, i) => (
              <Card key={i} interactive style={{
                padding: 0, overflow: "hidden",
                borderColor: i === 0 ? "var(--color-accent)" : undefined,
                boxShadow: i === 0 ? "0 0 0 1px var(--color-accent), var(--shadow-card)" : undefined,
              }}>
                <div style={{ position: "relative", aspectRatio: "4 / 3", overflow: "hidden" }}>
                  <MockupScene variant={i}/>
                  {i === 0 && (
                    <div style={{ position: "absolute", top: 6, left: 6 }}>
                      <Badge tone="accent" dot>Aktif</Badge>
                    </div>
                  )}
                </div>
                <div style={{ padding: "var(--space-2) var(--space-3)", display: "flex", alignItems: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{t.name}</div>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>{t.dim}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Render queue sidebar */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)", display: "flex", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "var(--text-md)", fontWeight: 600 }}>Render queue</div>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>12 çıktı · 8 hazır · 3 üretiliyor · 1 kuyrukta</div>
            </div>
          </div>
          <div style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { title: "Design 01 · Living room", status: "Hazır", tone: "success", pct: 100 },
              { title: "Design 01 · Gallery frame", status: "Hazır", tone: "success", pct: 100 },
              { title: "Design 01 · Nursery crib", status: "Hazır", tone: "success", pct: 100 },
              { title: "Design 02 · Living room", status: "Üretiliyor", tone: "accent", pct: 62 },
              { title: "Design 02 · Gallery frame", status: "Üretiliyor", tone: "accent", pct: 38 },
              { title: "Design 02 · Nursery crib", status: "Üretiliyor", tone: "accent", pct: 14 },
              { title: "Design 03 · Living room", status: "Kuyrukta", tone: "neutral", pct: 0 },
            ].map((q, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                  <Thumb kind={i < 3 ? "landscape" : i < 6 ? "boho" : "poster"} aspect="1/1"/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <div style={{ flex: 1, height: 3, background: "var(--color-surface-3)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ width: `${q.pct}%`, height: "100%", background: q.tone === "success" ? "var(--color-success)" : q.tone === "accent" ? "var(--color-accent)" : "var(--color-border-strong)" }}/>
                    </div>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)", width: 48, textAlign: "right" }}>{q.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <Button variant="secondary" size="sm" style={{ width: "100%" }} icon={I.download}>Hepsini ZIP olarak indir</Button>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

// Mockup scene — bir oda / gallery metaforu, pure CSS
function MockupScene({ variant = 0 }) {
  const scenes = [
    // 0: Living room · ivory wall
    {
      bg: "linear-gradient(180deg, #F0EAE0 0%, #E6DDCE 60%, #C9B999 100%)",
      floor: "linear-gradient(180deg, #8B6F4E, #6B5238)",
      art: "boho",
      frameColor: "#2B2620",
      sofa: true,
    },
    // 1: Gallery · oak
    {
      bg: "linear-gradient(180deg, #F5F3ED 0%, #E8E3D6 100%)",
      floor: null,
      art: "poster",
      frameColor: "#B08D5E",
      sofa: false,
    },
    // 2: Nursery · crib
    {
      bg: "linear-gradient(180deg, #F5E8DC 0%, #E8D4B8 100%)",
      floor: "linear-gradient(180deg, #D4B896, #B89870)",
      art: "nursery",
      frameColor: "#E85D25",
      sofa: false,
    },
    // 3: Flat lay
    {
      bg: "#EBE4D6",
      floor: null,
      art: "poster",
      frameColor: null,
      sofa: false,
    },
    // 4: Canvas edge closeup
    {
      bg: "#F3EDE3",
      floor: null,
      art: "landscape",
      frameColor: "#1A1715",
      sofa: false,
    },
    // 5: Desk muted
    {
      bg: "linear-gradient(180deg, #E0DAC9 0%, #C9BFA6 100%)",
      floor: null,
      art: "poster",
      frameColor: "#3A322A",
      sofa: false,
    },
  ];
  const s = scenes[variant] || scenes[0];
  return (
    <div style={{ position: "absolute", inset: 0, background: s.bg }}>
      {s.floor && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "30%", background: s.floor }}/>}
      {/* Art frame centered */}
      <div style={{
        position: "absolute",
        left: "50%", top: s.sofa ? "28%" : "32%",
        transform: "translate(-50%, 0)",
        width: s.sofa ? "26%" : "32%",
        aspectRatio: "2 / 3",
        background: s.frameColor || "transparent",
        padding: s.frameColor ? 6 : 0,
        boxShadow: s.frameColor ? "0 6px 18px rgba(0,0,0,.18)" : "0 4px 12px rgba(0,0,0,.12)",
      }}>
        <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
          <Thumb kind={s.art} aspect="auto" style={{ width: "100%", height: "100%", borderRadius: 0, aspectRatio: "auto" }}/>
        </div>
      </div>
      {/* Sofa silhouette */}
      {s.sofa && (
        <div style={{
          position: "absolute", left: "15%", right: "15%", bottom: "10%",
          height: "22%", background: "#8B6550", borderRadius: "8px 8px 3px 3px",
          boxShadow: "inset 0 -8px 12px rgba(0,0,0,.15)",
        }}/>
      )}
    </div>
  );
}

// ─── Shared mini row + head cell (admin density) ─────────
function miniRow({ head, selected }) {
  return {
    display: "flex", alignItems: "center", gap: 12,
    padding: "0 var(--space-4)",
    height: head ? 34 : 48,
    background: selected ? "var(--color-accent-soft)" : (head ? "var(--color-surface-2)" : "var(--color-surface)"),
    borderBottom: "1px solid var(--color-border-subtle)",
    fontSize: head ? 11 : 13,
    fontFamily: head ? "var(--font-mono)" : "var(--font-sans)",
    textTransform: head ? "uppercase" : "none",
    letterSpacing: head ? 0.6 : 0,
    color: head ? "var(--color-text-muted)" : "var(--color-text)",
    cursor: head ? "default" : "pointer",
    transition: "background var(--dur-fast)",
  };
}
function HeadCell({ children, style, sort }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 4, ...style }}>
    {children}
    {sort && <span style={{ color: "var(--color-accent)" }}>↓</span>}
  </div>;
}
function Cell({ children, style }) {
  return <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...style }}>{children}</div>;
}

Object.assign(window, {
  References, Collections, AdminProductTypes, AdminFeatureFlags,
  Competitors, TrendStories, ConfirmDialogs, EmptyStates, SkeletonCatalog,
  SelectionStudio, MockupStudio,
});
