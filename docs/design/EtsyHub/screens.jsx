/* global React, PageShell, Button, Badge, Chip, Input, Card, Thumb, StateMessage, Skeleton, I */

// ─────────────────────────────────────────────────────────
// SCREEN 1 · Dashboard (direction only)
// ─────────────────────────────────────────────────────────
function Dashboard() {
  return (
    <PageShell
      scope="user" active="Dashboard"
      title="Bugün"
      subtitle="24 Nisan 2026 · Cuma"
      actions={<>
        <Button variant="secondary" icon={I.bookmark}>Bookmark ekle</Button>
        <Button variant="primary" icon={I.sparkle}>Yeni varyasyon üret</Button>
      </>}
    >
      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        {[
          { label: "Bekleyen review", val: "12", trend: "+4", tone: "warning" },
          { label: "Hazır listing", val: "7", trend: "bugün", tone: "success" },
          { label: "Aktif job", val: "3", trend: "çalışıyor", tone: "accent" },
          { label: "Günlük hedef", val: "18/25", trend: "%72", tone: "neutral" },
        ].map((s, i) => (
          <Card key={i} style={{ padding: "var(--space-4)" }}>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-text-muted)" }}>{s.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              <div style={{ fontSize: "var(--text-3xl)", fontWeight: 600, lineHeight: 1, letterSpacing: 0 }}>{s.val}</div>
              <Badge tone={s.tone}>{s.trend}</Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Two-col: activity + queue */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-4)" }}>
        {/* Son joblar */}
        <Card style={{ padding: 0 }}>
          <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)", display: "flex", alignItems: "center" }}>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Son işler</div>
            <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>son 24 saat</div>
          </div>
          {[
            { kind: "boho", title: "Boho wall art · 12 varyasyon", time: "2 dk", status: "Review", statusTone: "warning" },
            { kind: "christmas", title: "Christmas printable set", time: "14 dk", status: "Hazır", statusTone: "success" },
            { kind: "nursery", title: "Nursery clipart bundle · 25 PNG", time: "1 s", status: "Üretiliyor", statusTone: "accent" },
            { kind: "poster", title: "Minimalist poster serisi", time: "3 s", status: "Draft", statusTone: "neutral" },
            { kind: "sticker", title: "Good vibes sticker sheet", time: "4 s", status: "Hazır", statusTone: "success" },
          ].map((job, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "var(--space-3) var(--space-4)",
              borderBottom: i < 4 ? "1px solid var(--color-border-subtle)" : "none",
            }}>
              <div style={{ width: 48, flexShrink: 0 }}>
                <Thumb kind={job.kind}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{job.title}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>{job.time} önce</div>
              </div>
              <Badge tone={job.statusTone} dot>{job.status}</Badge>
            </div>
          ))}
        </Card>

        {/* Review queue */}
        <Card style={{ padding: 0 }}>
          <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)" }}>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Review bekleyen</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>Düşük AI kalite skorlu tasarımlar</div>
          </div>
          <div style={{ padding: "var(--space-3)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
            {["abstract", "boho", "nursery", "clipart"].map((k, i) => (
              <div key={i} style={{ position: "relative" }}>
                <Thumb kind={k}/>
                <div style={{ position: "absolute", top: 6, left: 6 }}>
                  <Badge tone={i === 2 ? "danger" : "warning"}>{[58, 72, 41, 67][i]}</Badge>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: "var(--space-3) var(--space-4)", borderTop: "1px solid var(--color-border-subtle)" }}>
            <Button variant="secondary" size="sm" iconRight={I.chevR} style={{ width: "100%" }}>Review queue'ya git</Button>
          </div>
        </Card>
      </div>

      {/* Trend signals */}
      <div style={{ marginTop: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "baseline", marginBottom: "var(--space-3)" }}>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Yükselen trendler</div>
          <div style={{ marginLeft: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>8 mağaza · son 48 saat</div>
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-accent)", cursor: "pointer", fontWeight: 500 }}>Tümü →</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-3)" }}>
          {[
            { k: "boho", title: "Moon phase wall art", count: 14 },
            { k: "nursery", title: "Nursery name signs", count: 9 },
            { k: "christmas", title: "Vintage Christmas", count: 12 },
            { k: "poster", title: "Typography posters", count: 7 },
          ].map((t, i) => (
            <Card key={i} interactive style={{ padding: 0, overflow: "hidden" }}>
              <Thumb kind={t.k}/>
              <div style={{ padding: "var(--space-3)" }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{t.title}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)", marginTop: 3 }}>{t.count} yeni listing</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

// ─────────────────────────────────────────────────────────
// SCREEN 2 · Bookmarks grid
// ─────────────────────────────────────────────────────────
function BookmarksGrid({ empty, loading }) {
  const items = [
    { k: "boho", title: "Moon & stars boho print", src: "etsy.com", platform: "etsy", tag: "wall art" },
    { k: "nursery", title: "Little one nursery art", src: "pinterest.com", platform: "pinterest", tag: "printable" },
    { k: "christmas", title: "Vintage Christmas joy", src: "etsy.com", platform: "etsy", tag: "wall art" },
    { k: "clipart", title: "Kids animals clipart 24 PNG", src: "creativemarket.com", platform: "upload", tag: "clipart" },
    { k: "poster", title: "Stay wild typography poster", src: "etsy.com", platform: "etsy", tag: "poster" },
    { k: "sticker", title: "Good vibes sticker", src: "instagram.com", platform: "instagram", tag: "sticker" },
    { k: "abstract", title: "Sunset abstract canvas", src: "amazon.com", platform: "amazon", tag: "canvas" },
    { k: "landscape", title: "Mountain landscape set", src: "etsy.com", platform: "etsy", tag: "wall art" },
  ];

  return (
    <PageShell
      scope="user" active="Bookmarks"
      title="Bookmarks"
      subtitle="84 kayıt · son eklenen 2 dakika önce"
      actions={<>
        <Button variant="secondary" icon={I.download}>Export</Button>
        <Button variant="primary" icon={I.plus}>URL ekle</Button>
      </>}
      toolbar={<>
        <div style={{ width: 260 }}>
          <Input prefix={I.search} placeholder="Başlık, tag veya kaynakta ara"/>
        </div>
        <div style={{ width: 1, height: 20, background: "var(--color-border)" }}/>
        <Chip active>Tümü · 84</Chip>
        <Chip>Wall art · 31</Chip>
        <Chip>Clipart · 22</Chip>
        <Chip>Printable · 18</Chip>
        <Chip>Sticker · 9</Chip>
        <Chip>Canvas · 4</Chip>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Button variant="ghost" size="sm" icon={I.filter}>Filtre</Button>
          <div style={{ display: "flex", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <button style={{ padding: "6px 10px", background: "var(--color-surface-2)", border: "none", color: "var(--color-text)", cursor: "pointer", display: "flex" }}>{I.grid}</button>
            <button style={{ padding: "6px 10px", background: "var(--color-surface)", border: "none", borderLeft: "1px solid var(--color-border)", color: "var(--color-text-subtle)", cursor: "pointer", display: "flex" }}>{I.list}</button>
          </div>
        </div>
      </>}
    >
      {empty ? (
        <div style={{ marginTop: "var(--space-8)" }}>
          <StateMessage
            tone="neutral"
            icon={I.bookmark}
            title="Henüz bookmark yok"
            body="Etsy, Pinterest, Amazon veya herhangi bir URL'yi yapıştırarak fikir toplamaya başla. Topladığın bookmark'ları sonradan referans havuzuna taşıyabilir, benzerini ürettirebilirsin."
            action={<div style={{ display: "flex", gap: 8 }}>
              <Button variant="primary" icon={I.plus}>İlk bookmark'ını ekle</Button>
              <Button variant="secondary">Chrome extension</Button>
            </div>}
          />
        </div>
      ) : (
        <>
          {/* Bulk bar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-4)",
            background: "var(--color-accent-soft)",
            border: "1px solid transparent",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 3,
              background: "var(--color-accent)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{React.cloneElement(I.check, { size: 12 })}</div>
            <span style={{ color: "var(--color-accent-text)", fontWeight: 500 }}>3 bookmark seçildi</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <Button variant="ghost" size="sm" icon={I.folder}>Referansa ekle</Button>
              <Button variant="ghost" size="sm" icon={I.layers}>Koleksiyona</Button>
              <Button variant="ghost" size="sm" icon={I.wand}>Benzerini yap</Button>
              <Button variant="ghost" size="sm" icon={I.trash}>Arşivle</Button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ aspectRatio: "var(--aspect-card)", background: "var(--color-surface-3)", animation: "ehPulse 1.4s ease-in-out infinite" }}/>
                  <div style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <Skeleton w="80%" h={14}/>
                    <Skeleton w="50%" h={10}/>
                  </div>
                </Card>
              ))
              : items.map((b, i) => <BookmarkCard key={i} {...b} selected={i < 3}/>)}
          </div>
        </>
      )}
    </PageShell>
  );
}

function BookmarkCard({ k, title, src, platform, tag, selected }) {
  const [hover, setHover] = React.useState(false);
  return (
    <Card interactive style={{
      padding: 0, overflow: "hidden",
      borderColor: selected ? "var(--color-accent)" : undefined,
      boxShadow: selected ? "0 0 0 1px var(--color-accent), var(--shadow-card)" : undefined,
    }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
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
        <div style={{
          position: "absolute", top: 8, right: 8,
          opacity: hover ? 1 : 0, transition: "opacity var(--dur-fast)",
          display: "flex", gap: 4,
        }}>
          <button style={btnIconFloat}>{I.folder}</button>
          <button style={btnIconFloat}>{I.wand}</button>
          <button style={btnIconFloat}>{I.dots}</button>
        </div>
      </div>
      <div style={{ padding: "var(--space-3)" }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <Badge tone="neutral">{tag}</Badge>
          <span style={{ fontSize: 11, color: "var(--color-text-subtle)", fontFamily: "var(--font-mono)" }}>{src}</span>
        </div>
      </div>
    </Card>
  );
}
const btnIconFloat = {
  width: 26, height: 26, borderRadius: 4,
  background: "rgba(255,255,255,.92)", border: "none",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: "var(--color-text)",
  boxShadow: "0 1px 2px rgba(0,0,0,.08)",
};

// ─────────────────────────────────────────────────────────
// SCREEN 3 · Admin Users table
// ─────────────────────────────────────────────────────────
function AdminUsers() {
  const rows = [
    { name: "Ayşe Demir", email: "ayse@bohoworks.co", stores: 2, plan: "Pro", jobs: 412, cost: "$18.42", status: "active", joined: "2025-11-04" },
    { name: "Can Yıldız", email: "can.y@studio.co", stores: 1, plan: "Starter", jobs: 86, cost: "$3.71", status: "active", joined: "2026-01-12" },
    { name: "Elif Öztürk", email: "elif@craftly.io", stores: 3, plan: "Pro", jobs: 724, cost: "$32.08", status: "active", joined: "2025-08-22" },
    { name: "Mert Koç", email: "mert@mertprints.com", stores: 1, plan: "Starter", jobs: 12, cost: "$0.84", status: "trial", joined: "2026-04-19" },
    { name: "Seda Arslan", email: "seda@nesthome.shop", stores: 2, plan: "Pro", jobs: 198, cost: "$9.22", status: "active", joined: "2025-12-01" },
    { name: "Burak Aydın", email: "burak@pixelwalls.co", stores: 1, plan: "Starter", jobs: 0, cost: "$0.00", status: "suspended", joined: "2026-02-03" },
    { name: "Deniz Çelik", email: "deniz.c@gmail.com", stores: 0, plan: "Free", jobs: 4, cost: "$0.12", status: "trial", joined: "2026-04-21" },
    { name: "Fatma Şahin", email: "fatma@atelyem.store", stores: 2, plan: "Pro", jobs: 567, cost: "$24.11", status: "active", joined: "2025-10-15" },
  ];
  const statusTone = { active: "success", trial: "info", suspended: "danger" };
  const statusLabel = { active: "Aktif", trial: "Deneme", suspended: "Askıda" };

  return (
    <PageShell
      scope="admin" active="Users"
      title="Kullanıcılar"
      subtitle="842 kullanıcı · 38 son 7 gün"
      actions={<>
        <Button variant="secondary" size="sm" icon={I.download}>CSV export</Button>
        <Button variant="primary" size="sm" icon={I.plus}>Kullanıcı davet et</Button>
      </>}
      toolbar={<>
        <div style={{ width: 280 }}>
          <Input prefix={I.search} placeholder="İsim, email veya mağaza ara"/>
        </div>
        <Chip>Plan: Tümü</Chip>
        <Chip>Status: Aktif</Chip>
        <Chip>Son giriş: 30g</Chip>
        <div style={{ marginLeft: "auto", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
          8 / 842 görüntüleniyor
        </div>
      </>}
    >
      <div style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={adminRow({ head: true })}>
          <div style={{ width: 28 }}>
            <div style={{ width: 14, height: 14, border: "1.5px solid var(--color-border-strong)", borderRadius: 3 }}/>
          </div>
          <HeadCell style={{ flex: 2 }} sort="asc">Kullanıcı</HeadCell>
          <HeadCell style={{ width: 70 }}>Mağaza</HeadCell>
          <HeadCell style={{ width: 80 }}>Plan</HeadCell>
          <HeadCell style={{ width: 70, textAlign: "right" }}>Jobs</HeadCell>
          <HeadCell style={{ width: 80, textAlign: "right" }}>Maliyet</HeadCell>
          <HeadCell style={{ width: 100 }}>Durum</HeadCell>
          <HeadCell style={{ width: 110 }}>Kayıt</HeadCell>
          <HeadCell style={{ width: 28 }}></HeadCell>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={adminRow({ selected: i === 1 })}
            onMouseOver={e => { if (i !== 1) e.currentTarget.style.background = "var(--color-surface-2)"; }}
            onMouseOut={e => { if (i !== 1) e.currentTarget.style.background = "var(--color-surface)"; }}>
            <div style={{ width: 28 }}>
              <div style={{
                width: 14, height: 14, borderRadius: 3,
                border: `1.5px solid ${i === 1 ? "var(--color-accent)" : "var(--color-border-strong)"}`,
                background: i === 1 ? "var(--color-accent)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
              }}>{i === 1 && React.cloneElement(I.check, { size: 10 })}</div>
            </div>
            <div style={{ flex: 2, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: `hsl(${i * 47}, 30%, 75%)`,
                color: "var(--color-text)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 600, flexShrink: 0,
              }}>{r.name.split(" ").map(n => n[0]).join("")}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>{r.email}</div>
              </div>
            </div>
            <Cell style={{ width: 70 }}>{r.stores}</Cell>
            <Cell style={{ width: 80 }}>{r.plan === "Pro" ? <Badge tone="accent">Pro</Badge> : <span style={{ color: "var(--color-text-muted)" }}>{r.plan}</span>}</Cell>
            <Cell style={{ width: 70, textAlign: "right", fontFamily: "var(--font-mono)" }}>{r.jobs}</Cell>
            <Cell style={{ width: 80, textAlign: "right", fontFamily: "var(--font-mono)" }}>{r.cost}</Cell>
            <Cell style={{ width: 100 }}><Badge tone={statusTone[r.status]} dot>{statusLabel[r.status]}</Badge></Cell>
            <Cell style={{ width: 110, fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>{r.joined}</Cell>
            <Cell style={{ width: 28 }}>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4, display: "flex" }}>{I.dots}</button>
            </Cell>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "var(--space-3)", display: "flex", alignItems: "center", fontSize: 12, color: "var(--color-text-muted)" }}>
        <span>1-8 / 842</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <Button variant="ghost" size="sm">Önceki</Button>
          <Button variant="secondary" size="sm">Sonraki</Button>
        </div>
      </div>
    </PageShell>
  );
}
function adminRow({ head, selected }) {
  return {
    display: "flex", alignItems: "center", gap: 12,
    padding: "0 var(--space-4)",
    height: head ? 36 : 48,
    background: selected ? "var(--color-accent-soft)" : (head ? "var(--color-surface-2)" : "var(--color-surface)"),
    borderBottom: "1px solid var(--color-border-subtle)",
    fontSize: head ? 11 : 13,
    fontFamily: head ? "var(--font-mono)" : "var(--font-sans)",
    textTransform: head ? "uppercase" : "none",
    letterSpacing: head ? 0.6 : 0,
    color: head ? "var(--color-text-muted)" : "var(--color-text)",
    cursor: head ? "default" : "pointer",
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

// ─────────────────────────────────────────────────────────
// SCREEN 4 · Login / Register
// ─────────────────────────────────────────────────────────
function Login() {
  return (
    <div className="eh-app" data-density="user" style={{
      width: "100%", height: "100%", display: "flex",
      background: "var(--color-bg)",
    }}>
      {/* Brand panel */}
      <div style={{
        flex: 1, position: "relative", overflow: "hidden",
        background: "var(--color-surface-2)",
        borderRight: "1px solid var(--color-border)",
        padding: "var(--space-10)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Brand lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: "var(--color-accent)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 14,
          }}>E</div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>EtsyHub</div>
        </div>

        {/* Marquee copy */}
        <div style={{ marginTop: "auto", maxWidth: 420 }}>
          <div style={{
            fontSize: 11, fontFamily: "var(--font-mono)",
            textTransform: "uppercase", letterSpacing: 1,
            color: "var(--color-accent-text)",
          }}>Üretim kokpiti</div>
          <div style={{
            fontSize: 34, fontWeight: 600, lineHeight: 1.15,
            marginTop: "var(--space-3)", letterSpacing: 0,
          }}>Fikirden Etsy<br/>draft'ına sekiz<br/>adımda.</div>
          <div style={{ color: "var(--color-text-muted)", marginTop: "var(--space-4)", fontSize: 14, lineHeight: 1.55, maxWidth: 380 }}>
            Bookmark topla, referans havuzu kur, varyasyon ürettir, AI review'dan geçir, mockup hazırla, listing yaz. Tek akış, karmaşa yok.
          </div>

          {/* Asset strip preview */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-3)", marginTop: "var(--space-8)", maxWidth: 380 }}>
            {["boho", "nursery", "christmas", "poster"].map(k => (
              <div key={k} style={{
                borderRadius: "var(--radius-sm)", overflow: "hidden",
                border: "1px solid var(--color-border)",
              }}>
                <Thumb kind={k} aspect="1/1"/>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "var(--space-10)", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)" }}>
          v0.4.1 · localhost:3000
        </div>
      </div>

      {/* Form panel */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "var(--space-10)",
      }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div style={{ display: "flex", gap: 2, background: "var(--color-surface-2)", borderRadius: "var(--radius-md)", padding: 3, marginBottom: "var(--space-6)" }}>
            <button style={tabBtn(true)}>Giriş yap</button>
            <button style={tabBtn(false)}>Hesap oluştur</button>
          </div>

          <div style={{ fontSize: "var(--text-2xl)", fontWeight: 600, letterSpacing: 0 }}>Tekrar hoş geldin</div>
          <div style={{ color: "var(--color-text-muted)", marginTop: 4, fontSize: 13 }}>Kaldığın yerden devam et.</div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-6)" }}>
            <FieldLabel>Email</FieldLabel>
            <Input placeholder="sen@magazan.co"/>

            <div style={{ display: "flex", alignItems: "center", marginTop: "var(--space-2)" }}>
              <FieldLabel>Şifre</FieldLabel>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-accent)", cursor: "pointer" }}>Unuttun mu?</span>
            </div>
            <Input placeholder="••••••••••" type="password"/>

            <Button variant="primary" size="lg" style={{ marginTop: "var(--space-4)", width: "100%" }}>Giriş yap</Button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "var(--space-4) 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--color-border)" }}/>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: 0.6 }}>veya</div>
              <div style={{ flex: 1, height: 1, background: "var(--color-border)" }}/>
            </div>

            <Button variant="secondary" size="lg" style={{ width: "100%" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" style={{ marginRight: 4 }}>
                <path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.6-.2-2.3H12v4.3h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8z"/>
                <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.8C3.8 20.6 7.6 23 12 23z"/>
                <path fill="#FBBC05" d="M5.7 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2c-.8 1.5-1.2 3.1-1.2 4.9s.4 3.4 1.2 4.9l3.7-2.8z"/>
                <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.3 1.6l3.2-3.2C17.5 2 14.8 1 12 1 7.6 1 3.8 3.4 2 7.1l3.7 2.8C6.6 7.4 9.1 5.4 12 5.4z"/>
              </svg>
              Google ile devam et
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
function tabBtn(active) {
  return {
    flex: 1, height: 32, border: "none", cursor: "pointer",
    background: active ? "var(--color-surface)" : "transparent",
    color: active ? "var(--color-text)" : "var(--color-text-muted)",
    fontSize: 13, fontWeight: 500, fontFamily: "var(--font-sans)",
    borderRadius: "var(--radius-sm)",
    boxShadow: active ? "var(--shadow-card)" : "none",
  };
}
function FieldLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text)" }}>{children}</div>;
}

Object.assign(window, { Dashboard, BookmarksGrid, AdminUsers, Login });
