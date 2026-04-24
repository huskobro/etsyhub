/* global React, Button, Badge, Chip, Input, Card, Thumb, StateMessage, Skeleton, I */

// Primitives showcase — Bölüm A.2'nin canlı katalogu
function PrimitivesSheet() {
  return (
    <div className="eh-app" data-density="user" style={{
      width: "100%", height: "100%", overflow: "auto",
      padding: "var(--space-8)", background: "var(--color-bg)",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 1, color: "var(--color-accent-text)" }}>Bölüm A.2</div>
        <div style={{ fontSize: 32, fontWeight: 600, marginTop: 4 }}>UI Language Kit</div>
        <div style={{ color: "var(--color-text-muted)", maxWidth: 600, marginTop: 8, lineHeight: 1.55 }}>
          Editoryal kokpit yönü. Tüm primitive'ler token-first; arbitrary value yok. Warm off-white yüzey, #E85D25 aksan, Inter + IBM Plex Mono.
        </div>

        <Section title="Tipografi">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "var(--space-4)" }}>
            <TypeRow size={32} label="3xl · Dashboard numeral">412</TypeRow>
            <TypeRow size={24} label="2xl · Sayfa başlığı">Bookmarks</TypeRow>
            <TypeRow size={20} label="xl · Section title">Son işler</TypeRow>
            <TypeRow size={17} label="lg · Card title">Moon & stars boho print</TypeRow>
            <TypeRow size={14} label="base · User body">Varsayılan metin, user paneli density'si.</TypeRow>
            <TypeRow size={13} label="sm · Admin body">Admin tablo satırı, sıkı yoğunluk.</TypeRow>
            <TypeRow size={11} label="xs mono · Meta" mono>ETSY · 2 DK ÖNCE · $18.42</TypeRow>
          </div>
        </Section>

        <Section title="Renk · Surfaces + Text">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--space-3)", padding: "var(--space-4)" }}>
            {[
              ["bg", "#FAFAF7", "text"],
              ["surface", "#FFFFFF", "text"],
              ["surface-2", "#F3F2EC", "text"],
              ["surface-3", "#EBE9E2", "text"],
              ["border", "#E7E5DF", "text"],
              ["border-strong", "#D6D3CA", "text"],
              ["text", "#1A1715", "invert"],
              ["text-muted", "#6B655F", "invert"],
              ["text-subtle", "#9A948D", "invert"],
              ["accent", "#E85D25", "invert"],
              ["accent-soft", "#FBEADF", "accent-text"],
              ["accent-hover", "#D14E1A", "invert"],
            ].map(([n, hex, tone]) => (
              <div key={n} style={{
                padding: 12, borderRadius: "var(--radius-sm)",
                background: hex, color: tone === "invert" ? "#fff" : tone === "accent-text" ? "var(--color-accent-text)" : "var(--color-text)",
                border: "1px solid var(--color-border)",
                fontSize: 11, lineHeight: 1.3,
              }}>
                <div style={{ fontWeight: 500 }}>{n}</div>
                <div style={{ fontFamily: "var(--font-mono)", marginTop: 2, opacity: 0.75 }}>{hex}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Renk · Status">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-3)", padding: "var(--space-4)" }}>
            {["success", "warning", "danger", "info"].map(t => (
              <div key={t} style={{
                padding: 16, borderRadius: "var(--radius-md)",
                background: `var(--color-${t}-soft)`,
                color: `var(--color-${t})`,
                border: "1px solid transparent",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                  var(--color-{t}) / soft
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Button · varyantlar + boyutlar">
          <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: 16 }}>
            <Row label="Primary">
              <Button variant="primary" size="sm">Kaydet</Button>
              <Button variant="primary">Kaydet</Button>
              <Button variant="primary" size="lg">Kaydet</Button>
              <Button variant="primary" icon={I.plus}>Yeni ekle</Button>
              <Button variant="primary" icon={I.sparkle}>Varyasyon üret</Button>
            </Row>
            <Row label="Secondary">
              <Button variant="secondary" size="sm">İptal</Button>
              <Button variant="secondary">İptal</Button>
              <Button variant="secondary" size="lg">İptal</Button>
              <Button variant="secondary" icon={I.download}>Export</Button>
            </Row>
            <Row label="Ghost / Icon-only">
              <Button variant="ghost">Temizle</Button>
              <Button variant="ghost" icon={I.filter}>Filtre</Button>
              <Button variant="ghost" icon={I.dots}/>
              <Button variant="secondary" icon={I.more}/>
            </Row>
            <Row label="Destructive">
              <Button variant="destructive" icon={I.trash}>Sil</Button>
              <Button variant="destructive">Arşivle</Button>
            </Row>
          </div>
        </Section>

        <Section title="Input · Select · Textarea">
          <div style={{ padding: "var(--space-4)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div>
              <FieldLabel>Başlık</FieldLabel>
              <Input placeholder="Bookmark başlığı"/>
            </div>
            <div>
              <FieldLabel>URL</FieldLabel>
              <Input prefix={I.search} placeholder="https://"/>
            </div>
            <div>
              <FieldLabel>Etiketler</FieldLabel>
              <div style={{
                minHeight: 80, padding: 10,
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                display: "flex", flexWrap: "wrap", gap: 6, alignContent: "flex-start",
              }}>
                <Chip>wall art</Chip>
                <Chip>boho</Chip>
                <Chip>moon</Chip>
                <span style={{ color: "var(--color-text-subtle)", fontSize: 13, alignSelf: "center" }}>+ etiket ekle</span>
              </div>
            </div>
            <div>
              <FieldLabel>Notlar</FieldLabel>
              <textarea placeholder="Bu referansla ilgili notların..." style={{
                width: "100%", minHeight: "var(--min-h-textarea)", padding: 10,
                fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--color-text)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                resize: "vertical", outline: "none", letterSpacing: 0,
              }}/>
            </div>
          </div>
        </Section>

        <Section title="Badge · Chip · Tag">
          <div style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: 14 }}>
            <Row label="Status (mono uppercase)">
              <Badge tone="success" dot>hazır</Badge>
              <Badge tone="warning" dot>review</Badge>
              <Badge tone="danger" dot>hata</Badge>
              <Badge tone="accent" dot>üretiliyor</Badge>
              <Badge tone="info" dot>deneme</Badge>
              <Badge tone="neutral">draft</Badge>
            </Row>
            <Row label="Score badges">
              <Badge tone="success">92</Badge>
              <Badge tone="warning">67</Badge>
              <Badge tone="danger">41</Badge>
            </Row>
            <Row label="Filter chips">
              <Chip active>Tümü · 84</Chip>
              <Chip>Wall art · 31</Chip>
              <Chip>Clipart · 22</Chip>
              <Chip onRemove={() => {}}>Boho</Chip>
            </Row>
          </div>
        </Section>

        <Section title="Card · tip tip">
          <div style={{ padding: "var(--space-4)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
            <Card style={{ padding: 16 }}>
              <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-text-muted)" }}>Stat card</div>
              <div style={{ fontSize: 32, fontWeight: 600, marginTop: 6 }}>412</div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>bu ay üretilen</div>
            </Card>
            <Card interactive style={{ padding: 0, overflow: "hidden" }}>
              <Thumb kind="boho"/>
              <div style={{ padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Moon & stars boho print</div>
                <Badge tone="neutral">wall art</Badge>
              </div>
            </Card>
            <Card style={{ padding: 16, display: "flex", gap: 12 }}>
              <Thumb kind="clipart" style={{ width: 60, height: 60 }} aspect="1/1"/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Kids animals</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>24 PNG · 1.2 MB</div>
              </div>
            </Card>
          </div>
        </Section>

        <Section title="Asset thumbnails">
          <div style={{ padding: "var(--space-4)", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-3)" }}>
            {["boho", "christmas", "nursery", "poster", "clipart", "sticker", "abstract", "landscape"].map(k => (
              <div key={k}>
                <Thumb kind={k}/>
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.6, color: "var(--color-text-subtle)", marginTop: 6 }}>{k}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="State message (empty / warning / error)">
          <div style={{ padding: "var(--space-4)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)" }}>
            <Card><StateMessage tone="neutral" icon={I.bookmark} title="Henüz bookmark yok" body="URL yapıştırarak başla." action={<Button variant="primary" size="sm" icon={I.plus}>Ekle</Button>}/></Card>
            <Card><StateMessage tone="warning" icon={I.alert} title="Quota'ya yaklaştın" body="Bu ay 480/500 üretim kullandın." action={<Button variant="secondary" size="sm">Planı yükselt</Button>}/></Card>
            <Card><StateMessage tone="error" icon={I.x} title="Job başarısız" body="3 tasarım üretilemedi. Provider hatası." action={<Button variant="secondary" size="sm">Tekrar dene</Button>}/></Card>
          </div>
        </Section>

        <Section title="Skeleton (sade pulse)">
          <div style={{ padding: "var(--space-4)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)" }}>
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ aspectRatio: "var(--aspect-card)", background: "var(--color-surface-3)", animation: "ehPulse 1.4s ease-in-out infinite" }}/>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton w="80%" h={14}/>
                <Skeleton w="45%" h={10}/>
              </div>
            </Card>
            <Card style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton w="60%" h={18}/>
              <Skeleton w="100%" h={10}/>
              <Skeleton w="100%" h={10}/>
              <Skeleton w="70%" h={10}/>
            </Card>
            <Card style={{ padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <Skeleton w={40} h={40} r={20}/>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton w="70%" h={12}/>
                <Skeleton w="50%" h={10}/>
              </div>
            </Card>
          </div>
        </Section>

        <Section title="Confirm dialogs · üç ton">
          <div style={{ padding: "var(--space-4)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-4)" }}>
            {[
              { tone: "neutral", icon: I.alert, title: "Koleksiyona taşı", body: "3 bookmark \"Nursery Wall Art\" koleksiyonuna taşınacak.", cta: "Taşı", variant: "primary" },
              { tone: "warning", icon: I.alert, title: "Bu tasarımı reject et", body: "Reject edilen tasarımlar arşive gider, mockup/listing üretmez.", cta: "Reject", variant: "secondary" },
              { tone: "danger", icon: I.trash, title: "Bookmark'ları sil", body: "Seçili 12 bookmark kalıcı olarak silinecek. Bu işlem geri alınamaz.", cta: "Sil", variant: "destructive" },
            ].map((d, i) => (
              <div key={i} style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: 20, boxShadow: "var(--shadow-popover)",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "var(--radius-md)",
                    background: `var(--color-${d.tone === "neutral" ? "accent" : d.tone}-soft)`,
                    color: `var(--color-${d.tone === "neutral" ? "accent" : d.tone})`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>{d.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{d.title}</div>
                    <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6, lineHeight: 1.5 }}>{d.body}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
                  <Button variant="secondary" size="sm">İptal</Button>
                  {d.tone === "danger" ? <Button variant="destructive" size="sm">{d.cta}</Button> : <Button variant={d.variant} size="sm">{d.cta}</Button>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: "var(--space-8)" }}>
      <div style={{
        fontSize: 11, fontFamily: "var(--font-mono)",
        textTransform: "uppercase", letterSpacing: 0.8,
        color: "var(--color-text-muted)",
        padding: "0 var(--space-4) var(--space-2)",
      }}>{title}</div>
      <div style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
      }}>{children}</div>
    </div>
  );
}
function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{
        width: 110, fontSize: 11, fontFamily: "var(--font-mono)",
        textTransform: "uppercase", letterSpacing: 0.6,
        color: "var(--color-text-subtle)",
      }}>{label}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{children}</div>
    </div>
  );
}
function TypeRow({ size, label, mono, children }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
      <div style={{
        width: 230, fontSize: 11, fontFamily: "var(--font-mono)",
        color: "var(--color-text-subtle)", textTransform: "uppercase", letterSpacing: 0.6,
      }}>{label}</div>
      <div style={{ fontSize: size, fontWeight: size >= 24 ? 600 : 500, fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)", letterSpacing: 0 }}>{children}</div>
    </div>
  );
}
function FieldLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text)", marginBottom: 6 }}>{children}</div>;
}

Object.assign(window, { PrimitivesSheet });
