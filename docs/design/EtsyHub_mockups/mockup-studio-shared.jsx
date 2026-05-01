// Mockup Studio · Shared atoms, mock data, scene builders
// Token-pure, primitives üzerine.

const { I, Icon, Button, Badge, Chip, Input, Card, Thumb, StateMessage, Skeleton } = window;

// ───────────────────────────────────────────────────────────
// MOCK DATA — gerçekçi ve zengin
// ───────────────────────────────────────────────────────────
const MS_DESIGNS = [
  { id: "d-001", title: "Moon phases · ivory boho",        kind: "wall-art",  category: "wall-art", ratio: "2:3",  variant: "boho-moon",       set: "single",       res: "4500×6750" },
  { id: "d-002", title: "Terracotta abstract · trio",      kind: "wall-art",  category: "wall-art", ratio: "2:3",  variant: "abstract-warm",   set: "set-of-3",     res: "3600×5400" },
  { id: "d-003", title: "Mountain fog landscape",          kind: "wall-art",  category: "wall-art", ratio: "3:2",  variant: "landscape",       set: "single",       res: "5400×3600" },
  { id: "d-004", title: "Wildflower meadow · vintage",     kind: "wall-art",  category: "wall-art", ratio: "2:3",  variant: "floral",          set: "single",       res: "4000×6000" },
  { id: "d-005", title: "Christmas wreath · holiday red",  kind: "wall-art",  category: "seasonal",ratio: "1:1",  variant: "seasonal",        set: "single",       res: "3600×3600" },
  { id: "d-006", title: "Hot air balloon · soft pastel",   kind: "wall-art",  category: "nursery", ratio: "2:3",  variant: "nursery-balloon", set: "single",       res: "3600×5400" },
  { id: "d-007", title: "Quote · stay curious",            kind: "bookmark",  category: "bookmark",ratio: "1:3",  variant: "bookmark-quote",  set: "single",       res: "900×2700" },
  { id: "d-008", title: "Pressed flower bookmark · 3pcs",  kind: "bookmark",  category: "bookmark",ratio: "1:3",  variant: "bookmark-floral", set: "set-of-3",     res: "900×2700" },
  { id: "d-009", title: "Reader's set · 5 bookmarks",      kind: "bookmark",  category: "bookmark",ratio: "1:3",  variant: "bookmark-floral", set: "set-of-5",     res: "900×2700" },
  { id: "d-010", title: "Botanical clipart · 24 pcs PNG",  kind: "clipart",   category: "clipart", ratio: "1:1",  variant: "clipart-grid",    set: "bundle-24",    res: "300dpi" },
  { id: "d-011", title: "Watercolor fruit · 12 pcs",       kind: "clipart",   category: "clipart", ratio: "1:1",  variant: "clipart-grid",    set: "bundle-12",    res: "300dpi" },
  { id: "d-012", title: "Halloween icons · 30 pcs SVG",    kind: "clipart",   category: "seasonal",ratio: "1:1",  variant: "clipart-grid",    set: "bundle-30",    res: "vector" },
];

const MS_TEMPLATES = [
  // wall art
  { id: "t-w-01", name: "Living room · ivory wall · sofa",   product: "wall-art", scene: "ivory-wall", ratio: "2:3", orient: "portrait",  frame: "natural", room: "living",   style: "boho",      tags: ["boho","living","framed"],     premium: false, recommended: true,  favorite: true,  recent: true  },
  { id: "t-w-02", name: "Living room · charcoal · console",  product: "wall-art", scene: "charcoal",   ratio: "2:3", orient: "portrait",  frame: "black",   room: "living",   style: "modern",    tags: ["modern","living","framed"],   premium: true,  recommended: true,  favorite: false, recent: true  },
  { id: "t-w-03", name: "Nursery · soft pink · bed",         product: "wall-art", scene: "nursery",    ratio: "2:3", orient: "portrait",  frame: "white",   room: "nursery",  style: "soft",      tags: ["nursery","soft","framed"],    premium: false, recommended: true,  favorite: true,  recent: false },
  { id: "t-w-04", name: "Boho gallery wall · 3-up",          product: "wall-art", scene: "boho",       ratio: "2:3", orient: "portrait",  frame: "natural", room: "living",   style: "boho",      tags: ["boho","gallery","set-of-3"],  premium: true,  recommended: true,  favorite: false, recent: true  },
  { id: "t-w-05", name: "Modern minimalist · unframed",      product: "wall-art", scene: "ivory-wall", ratio: "2:3", orient: "portrait",  frame: "unframed",room: "office",   style: "minimal",   tags: ["minimal","unframed"],         premium: false, recommended: false, favorite: false, recent: false },
  { id: "t-w-06", name: "Landscape over sofa",                product: "wall-art", scene: "ivory-wall", ratio: "3:2", orient: "landscape", frame: "walnut",  room: "living",   style: "rustic",    tags: ["rustic","landscape"],         premium: false, recommended: false, favorite: false, recent: false },
  { id: "t-w-07", name: "Square print · brass frame",         product: "wall-art", scene: "boho",       ratio: "1:1", orient: "square",    frame: "brass",   room: "entry",    style: "luxe",      tags: ["luxe","square"],              premium: true,  recommended: false, favorite: false, recent: false },
  { id: "t-w-08", name: "Holiday mantel scene",               product: "wall-art", scene: "ivory-wall", ratio: "2:3", orient: "portrait",  frame: "white",   room: "living",   style: "seasonal",  tags: ["seasonal","holiday"],         premium: false, recommended: false, favorite: false, recent: false },
  // bookmark
  { id: "t-b-01", name: "Bookmark · kraft desk · single",    product: "bookmark", scene: "kraft",      ratio: "1:3", orient: "portrait", frame: "none",   room: "desk",     style: "neutral",   tags: ["bookmark","kraft","single"],  premium: false, recommended: true,  favorite: true,  recent: true  },
  { id: "t-b-02", name: "Bookmark · inside open book",       product: "bookmark", scene: "paper",      ratio: "1:3", orient: "portrait", frame: "none",   room: "desk",     style: "neutral",   tags: ["bookmark","book","in-use"],   premium: false, recommended: true,  favorite: true,  recent: true  },
  { id: "t-b-03", name: "Bookmark · handheld · ivory",       product: "bookmark", scene: "ivory-wall", ratio: "1:3", orient: "portrait", frame: "none",   room: "studio",   style: "neutral",   tags: ["bookmark","hand","scale"],    premium: true,  recommended: true,  favorite: false, recent: true  },
  { id: "t-b-04", name: "Bookmark · set of 3 flat lay",      product: "bookmark", scene: "kraft",      ratio: "1:3", orient: "portrait", frame: "none",   room: "desk",     style: "neutral",   tags: ["bookmark","set","flatlay"],   premium: false, recommended: true,  favorite: false, recent: false },
  { id: "t-b-05", name: "Bookmark · set of 5 fan",           product: "bookmark", scene: "paper",      ratio: "1:3", orient: "portrait", frame: "none",   room: "desk",     style: "neutral",   tags: ["bookmark","set-of-5"],        premium: true,  recommended: false, favorite: false, recent: false },
  { id: "t-b-06", name: "Bookmark · book + tea cup",         product: "bookmark", scene: "kraft",      ratio: "1:3", orient: "portrait", frame: "none",   room: "desk",     style: "cozy",      tags: ["bookmark","cozy"],            premium: false, recommended: false, favorite: false, recent: false },
  // clipart
  { id: "t-c-01", name: "Clipart · digital cover",           product: "clipart",  scene: "paper",      ratio: "4:3", orient: "landscape",frame: "none",   room: "digital",  style: "listing",   tags: ["clipart","cover","listing"],  premium: false, recommended: true,  favorite: true,  recent: true  },
  { id: "t-c-02", name: "Clipart · transparent grid",        product: "clipart",  scene: "transparent",ratio: "1:1", orient: "square",   frame: "none",   room: "digital",  style: "listing",   tags: ["clipart","transparent","grid"],premium: false, recommended: true,  favorite: false, recent: true  },
  { id: "t-c-03", name: "Clipart · zoom detail trio",        product: "clipart",  scene: "paper",      ratio: "4:3", orient: "landscape",frame: "none",   room: "digital",  style: "listing",   tags: ["clipart","detail","zoom"],    premium: true,  recommended: true,  favorite: false, recent: false },
  { id: "t-c-04", name: "Clipart · file delivery preview",   product: "clipart",  scene: "paper",      ratio: "4:3", orient: "landscape",frame: "none",   room: "digital",  style: "listing",   tags: ["clipart","files","format"],   premium: false, recommended: false, favorite: false, recent: false },
];

const MS_PRESETS = [
  { id: "p-starter",  name: "Starter Set",                  count: 5,  desc: "Her ürün için minimum kapsama set'i",          for: ["wall-art","bookmark","clipart"], featured: false, premium: false },
  { id: "p-etsy",     name: "Etsy Optimized Set",           count: 8,  desc: "Etsy thumbnail + 7 listing varyasyonu",        for: ["wall-art","bookmark","clipart"], featured: true,  premium: false },
  { id: "p-bookmark", name: "Bookmark Launch Set",          count: 6,  desc: "Single + set of 3 + handheld + book in-use",   for: ["bookmark"],                       featured: true,  premium: false },
  { id: "p-clipart",  name: "Clipart Digital Listing Set",  count: 5,  desc: "Cover + transparent grid + zoom + format",     for: ["clipart"],                        featured: true,  premium: false },
  { id: "p-wallart",  name: "Wall Art Bundle Set",          count: 12, desc: "3 oda × 4 frame · gallery wall + framed",      for: ["wall-art"],                       featured: true,  premium: true  },
  { id: "p-seasonal", name: "Seasonal Promo Set",           count: 7,  desc: "Holiday + nursery + seasonal scene mix",       for: ["wall-art","clipart"],             featured: false, premium: true  },
];

// Render queue örnek satırları
const MS_QUEUE = [
  { id: "q-01", design: "Moon phases",  template: "Living · ivory · sofa",  status: "running",  pct: 72, ts: "00:08", err: null },
  { id: "q-02", design: "Moon phases",  template: "Charcoal · console",     status: "running",  pct: 41, ts: "00:14", err: null },
  { id: "q-03", design: "Moon phases",  template: "Nursery · soft pink",    status: "queued",   pct: 0,  ts: "—",     err: null },
  { id: "q-04", design: "Terracotta",   template: "Living · ivory · sofa",  status: "done",     pct: 100,ts: "00:11", err: null },
  { id: "q-05", design: "Terracotta",   template: "Boho gallery 3-up",      status: "done",     pct: 100,ts: "00:13", err: null },
  { id: "q-06", design: "Mountain fog", template: "Landscape over sofa",    status: "done",     pct: 100,ts: "00:09", err: null },
  { id: "q-07", design: "Mountain fog", template: "Living · ivory · sofa",  status: "failed",   pct: 0,  ts: "—",     err: "ratio_mismatch" },
  { id: "q-08", design: "Wildflower",   template: "Boho gallery 3-up",      status: "queued",   pct: 0,  ts: "—",     err: null },
  { id: "q-09", design: "Wildflower",   template: "Square · brass frame",   status: "failed",   pct: 0,  ts: "—",     err: "low_resolution" },
  { id: "q-10", design: "Christmas",    template: "Holiday mantel",         status: "running",  pct: 18, ts: "00:03", err: null },
  { id: "q-11", design: "Balloon",      template: "Nursery · soft pink",    status: "queued",   pct: 0,  ts: "—",     err: null },
  { id: "q-12", design: "Balloon",      template: "Square · brass frame",   status: "failed",   pct: 0,  ts: "—",     err: "safe_area_overflow" },
];

// Saved sets · presets
const MS_SAVED_SETS = [
  { id: "s-01", name: "Boho hero pack", count: 6, type: "favorite", thumb: "boho-moon",       updated: "2 gün önce", uses: 14 },
  { id: "s-02", name: "Bookmark launch reused", count: 6, type: "preset", thumb: "bookmark-floral", updated: "5 gün önce", uses: 21 },
  { id: "s-03", name: "Nursery soft", count: 4, type: "favorite", thumb: "nursery-balloon", updated: "1 hf önce", uses: 9 },
  { id: "s-04", name: "Etsy optimized · wall art", count: 8, type: "preset", thumb: "abstract-warm", updated: "3 gün önce", uses: 33 },
  { id: "s-05", name: "Clipart digital starter",  count: 5, type: "preset", thumb: "clipart-grid",   updated: "1 gün önce", uses: 18 },
  { id: "s-06", name: "Seasonal promo · holiday", count: 7, type: "favorite", thumb: "seasonal",     updated: "4 gün önce", uses: 6  },
];

Object.assign(window, { MS_DESIGNS, MS_TEMPLATES, MS_PRESETS, MS_QUEUE, MS_SAVED_SETS });

// ───────────────────────────────────────────────────────────
// MS scene helpers (CSS sahne builder)
// ───────────────────────────────────────────────────────────

// Tek bir sahne — template + design birleşimi
function MSScene({ template, design, withSafeArea, withHandles, withScrim, scrimLabel, withScan, style }) {
  const t = template || {};
  const d = design || {};
  const sceneClass = `ms-scene ms-scene--${t.scene || "ivory-wall"}`;
  const variant = d.variant || "abstract-warm";

  return (
    <div className={sceneClass} style={{ width: "100%", height: "100%", ...style }}>
      {t.scene === "ivory-wall" && <div className="ms-window-light" />}
      {/* Per-product composition */}
      {t.product === "wall-art" && <WallArtComposition template={t} variant={variant} design={d} withSafeArea={withSafeArea} withHandles={withHandles} />}
      {t.product === "bookmark" && <BookmarkComposition template={t} variant={variant} design={d} withSafeArea={withSafeArea} withHandles={withHandles} />}
      {t.product === "clipart"  && <ClipartComposition  template={t} variant={variant} design={d} withSafeArea={withSafeArea} withHandles={withHandles} />}

      {withScan && <div className="ms-scan" />}
      {withScrim && <div className="ms-scrim">{scrimLabel || "Rendering…"}</div>}
    </div>
  );
}

// ─── Wall art ───
function WallArtComposition({ template, variant, design, withSafeArea, withHandles }) {
  const set = (design && design.set) || "single";
  const orient = template.orient || "portrait";

  // Floor + furniture
  const furniture = template.room === "nursery"
    ? <div className="ms-bed" />
    : template.room === "office" || template.frame === "unframed"
      ? null
      : (template.room === "entry" ? <div className="ms-console" /> : <div className="ms-sofa" />);

  if (set === "set-of-3") {
    // gallery wall trio
    const cells = [
      { left: "16%", top: "16%", w: "20%", h: "44%" },
      { left: "40%", top: "12%", w: "20%", h: "50%" },
      { left: "64%", top: "16%", w: "20%", h: "44%" },
    ];
    return (
      <>
        <div className={`ms-floor ${template.scene === "charcoal" ? "ms-floor--charcoal" : ""}`} />
        {furniture}
        {cells.map((c, i) =>
          <Frame key={i} variant={template.frame} style={{ left: c.left, top: c.top, width: c.w, height: c.h }}>
            <div className={`ms-art ms-art--${variant}`} />
          </Frame>
        )}
        {withSafeArea && <SafeAreaOverlay style={{ left: "16%", top: "12%", width: "68%", height: "52%" }} />}
        {withHandles && <PlacementHandles style={{ left: "40%", top: "12%", width: "20%", height: "50%" }} />}
      </>
    );
  }

  // single
  const isLandscape = orient === "landscape";
  const isSquare = orient === "square";
  const single = isSquare
    ? { left: "36%", top: "18%", w: "28%", h: "44%" }
    : isLandscape
      ? { left: "26%", top: "20%", w: "48%", h: "32%" }
      : { left: "34%", top: "12%", w: "32%", h: "50%" };

  return (
    <>
      <div className={`ms-floor ${template.scene === "charcoal" ? "ms-floor--charcoal" : ""}`} />
      {furniture}
      {template.frame === "unframed"
        ? <div className="ms-poster" style={{ left: single.left, top: single.top, width: single.w, height: single.h }}>
            <div className={`ms-art ms-art--${variant}`} />
          </div>
        : <Frame variant={template.frame} style={{ left: single.left, top: single.top, width: single.w, height: single.h }}>
            <div className={`ms-art ms-art--${variant}`} />
          </Frame>
      }
      {withSafeArea && <SafeAreaOverlay style={{ left: single.left, top: single.top, width: single.w, height: single.h }} />}
      {withHandles && <PlacementHandles style={{ left: single.left, top: single.top, width: single.w, height: single.h }} />}
    </>
  );
}

function Frame({ variant = "natural", children, style }) {
  return (
    <div className={`ms-frame ms-frame--${variant}`} style={style}>
      <div className="ms-frame__mat">{children}</div>
    </div>
  );
}

// ─── Bookmark ───
function BookmarkComposition({ template, variant, design, withSafeArea, withHandles }) {
  const set = (design && design.set) || "single";
  const room = template.room;

  if (template.tags && template.tags.includes("book")) {
    return (
      <>
        <div className="ms-book">
          <div className="ms-book__lines ms-book__lines--left" />
          <div className="ms-book__lines" />
        </div>
        <div className="ms-bookmark ms-bookmark--tassel" style={{ left: "62%", top: "10%", width: "8%", height: "70%" }}>
          <div className={`ms-art ms-art--${variant}`} />
        </div>
        {withSafeArea && <SafeAreaOverlay style={{ left: "62%", top: "10%", width: "8%", height: "70%" }} />}
        {withHandles && <PlacementHandles style={{ left: "62%", top: "10%", width: "8%", height: "70%" }} />}
      </>
    );
  }

  if (template.tags && template.tags.includes("hand")) {
    return (
      <>
        <div className="ms-hand" />
        <div className="ms-bookmark ms-bookmark--tassel" style={{ left: "44%", top: "12%", width: "12%", height: "62%" }}>
          <div className={`ms-art ms-art--${variant}`} />
        </div>
        {withSafeArea && <SafeAreaOverlay style={{ left: "44%", top: "12%", width: "12%", height: "62%" }} />}
        {withHandles && <PlacementHandles style={{ left: "44%", top: "12%", width: "12%", height: "62%" }} />}
      </>
    );
  }

  // flat lay set
  if (set === "set-of-3" || (template.tags && template.tags.includes("set") && !template.tags.includes("set-of-5"))) {
    return (
      <>
        <BookmarkOnDesk left="22%" top="15%" w="11%" h="65%" variant={variant} rotate="-6deg" />
        <BookmarkOnDesk left="44%" top="12%" w="11%" h="68%" variant={variant} />
        <BookmarkOnDesk left="66%" top="14%" w="11%" h="66%" variant={variant} rotate="5deg" />
        {withSafeArea && <SafeAreaOverlay style={{ left: "44%", top: "12%", width: "11%", height: "68%" }} />}
        {withHandles && <PlacementHandles style={{ left: "44%", top: "12%", width: "11%", height: "68%" }} />}
      </>
    );
  }

  if (template.tags && template.tags.includes("set-of-5")) {
    const fan = [
      { left: "16%", top: "15%", w: "10%", h: "65%", rotate: "-12deg" },
      { left: "30%", top: "13%", w: "10%", h: "67%", rotate: "-6deg" },
      { left: "44%", top: "12%", w: "10%", h: "68%", rotate: "0deg" },
      { left: "58%", top: "13%", w: "10%", h: "67%", rotate: "6deg" },
      { left: "72%", top: "15%", w: "10%", h: "65%", rotate: "12deg" },
    ];
    return (
      <>
        {fan.map((f, i) => <BookmarkOnDesk key={i} {...f} variant={variant} />)}
        {withSafeArea && <SafeAreaOverlay style={{ left: "44%", top: "12%", width: "10%", height: "68%" }} />}
        {withHandles && <PlacementHandles style={{ left: "44%", top: "12%", width: "10%", height: "68%" }} />}
      </>
    );
  }

  // single
  return (
    <>
      <BookmarkOnDesk left="42%" top="12%" w="14%" h="70%" variant={variant} />
      {withSafeArea && <SafeAreaOverlay style={{ left: "42%", top: "12%", width: "14%", height: "70%" }} />}
      {withHandles && <PlacementHandles style={{ left: "42%", top: "12%", width: "14%", height: "70%" }} />}
    </>
  );
}

function BookmarkOnDesk({ left, top, w, h, variant, rotate }) {
  return (
    <div className="ms-bookmark ms-bookmark--tassel" style={{
      left, top, width: w, height: h, transform: rotate ? `rotate(${rotate})` : undefined,
      transformOrigin: "center top"
    }}>
      <div className={`ms-art ms-art--${variant}`} />
    </div>
  );
}

// ─── Clipart ───
function ClipartComposition({ template, variant, design, withSafeArea, withHandles }) {
  if (template.tags && template.tags.includes("transparent")) {
    return (
      <>
        <div className={`ms-art ms-art--${variant}`} style={{ position: "absolute", inset: "16%" }} />
        {withSafeArea && <SafeAreaOverlay style={{ inset: "16%" }} />}
        {withHandles && <PlacementHandles style={{ inset: "16%" }} />}
      </>
    );
  }
  if (template.tags && template.tags.includes("detail")) {
    return (
      <>
        <div className={`ms-art ms-art--${variant}`} style={{ position: "absolute", left: "6%", top: "14%", width: "30%", height: "72%", background: "#FFFFFF" }} />
        <div className={`ms-art ms-art--${variant}`} style={{ position: "absolute", left: "38%", top: "14%", width: "30%", height: "72%", background: "#FFFFFF" }} />
        <div className={`ms-art ms-art--${variant}`} style={{ position: "absolute", left: "70%", top: "14%", width: "24%", height: "72%", background: "#FFFFFF" }} />
        {withSafeArea && <SafeAreaOverlay style={{ inset: "10% 4%" }} />}
      </>
    );
  }
  if (template.tags && template.tags.includes("files")) {
    return (
      <>
        <div style={{ position: "absolute", inset: "16% 8% 16% 8%", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {["PNG","SVG","JPG","PDF"].map((fmt, i) =>
            <div key={fmt} style={{
              background: "#FFFFFF",
              boxShadow: "0 4px 12px rgba(40,28,18,0.18)",
              display: "grid", placeItems: "center",
              fontFamily: "var(--font-mono)", fontSize: 14, color: "#1A1715", letterSpacing: "0.06em"
            }}>{fmt}</div>
          )}
        </div>
      </>
    );
  }
  // cover
  return (
    <>
      <div style={{ position: "absolute", inset: "10% 8%", display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <div className={`ms-art ms-art--${variant}`} style={{ background: "#FFFFFF", boxShadow: "0 8px 18px rgba(40,28,18,0.16)" }} />
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 12 }}>
          <div className={`ms-art ms-art--${variant}`} style={{ background: "#FFFFFF", boxShadow: "0 6px 12px rgba(40,28,18,0.14)" }} />
          <div className={`ms-art ms-art--${variant}`} style={{ background: "#FFFFFF", boxShadow: "0 6px 12px rgba(40,28,18,0.14)" }} />
        </div>
      </div>
      {withSafeArea && <SafeAreaOverlay style={{ inset: "8% 6%" }} />}
    </>
  );
}

// ─── Overlays ───
function SafeAreaOverlay({ style, label = "SAFE AREA" }) {
  return (
    <div className="ms-safe-area" style={style}>
      <span className="ms-safe-area__label">{label}</span>
    </div>
  );
}

function PlacementHandles({ style }) {
  return (
    <div style={{ position: "absolute", ...style, pointerEvents: "none" }}>
      <div className="ms-handle" style={{ left: -5, top: -5 }} />
      <div className="ms-handle" style={{ right: -5, top: -5 }} />
      <div className="ms-handle" style={{ left: -5, bottom: -5 }} />
      <div className="ms-handle" style={{ right: -5, bottom: -5 }} />
      <div className="ms-handle" style={{ left: "calc(50% - 5px)", top: -5 }} />
      <div className="ms-handle" style={{ left: "calc(50% - 5px)", bottom: -5 }} />
      <div className="ms-handle" style={{ left: -5, top: "calc(50% - 5px)" }} />
      <div className="ms-handle" style={{ right: -5, top: "calc(50% - 5px)" }} />
      <div className="ms-handle ms-handle--rotate" style={{ left: "calc(50% - 6px)", top: -28 }}>
        <div className="ms-handle__line" />
      </div>
    </div>
  );
}

// ─── Atoms ───
function StatusDot({ status }) {
  return <span className={`ms-dot ms-dot--${status}`} />;
}

function RatioBadge({ ratio, mismatch }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em",
      padding: "2px 6px", borderRadius: 3,
      background: mismatch ? "var(--color-warning-soft)" : "var(--color-surface-2)",
      color: mismatch ? "var(--color-warning)" : "var(--color-text-muted)",
      border: `1px solid ${mismatch ? "rgba(180,116,21,0.25)" : "var(--color-border)"}`
    }}>
      {mismatch && <span style={{ width: 4, height: 4, background: "var(--color-warning)", borderRadius: "50%" }} />}
      {ratio}
    </span>
  );
}

function WarningBadge({ kind }) {
  const map = {
    ratio:    { tone: "warning", label: "Needs ratio adjustment" },
    safe:     { tone: "warning", label: "Safe area risk" },
    res:      { tone: "danger",  label: "Low resolution" },
    failed:   { tone: "danger",  label: "Failed" },
    retry:    { tone: "info",    label: "Retry ready" },
    mixed:    { tone: "info",    label: "Mixed batch" },
    hero:     { tone: "accent",  label: "Hero candidate" },
  };
  const m = map[kind] || map.ratio;
  return <Badge tone={m.tone} dot>{m.label}</Badge>;
}

function CategoryChip({ icon, label, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "10px 14px",
      background: active ? "var(--color-accent-soft)" : "var(--color-surface)",
      border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
      borderRadius: 999,
      cursor: "pointer",
      color: active ? "var(--color-accent-text)" : "var(--color-text)",
      fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 500,
      transition: "all var(--dur) var(--ease-out)"
    }}>
      {icon}
      <span>{label}</span>
      {count != null && <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11,
        color: active ? "var(--color-accent-text)" : "var(--color-text-subtle)",
        padding: "0 6px",
        background: active ? "rgba(232,93,37,0.10)" : "var(--color-surface-2)",
        borderRadius: 8
      }}>{count}</span>}
    </button>
  );
}

function PresetCard({ preset, recommended, selected, onSelect }) {
  return (
    <Card interactive onClick={onSelect} style={{
      padding: 16,
      borderColor: selected ? "var(--color-accent)" : "var(--color-border)",
      background: selected ? "var(--color-accent-soft)" : "var(--color-surface)",
      cursor: "pointer", position: "relative"
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "var(--color-text)" }}>{preset.name}</div>
        {preset.featured && <Badge tone="accent" dot>Recommended</Badge>}
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 10 }}>{preset.desc}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-subtle)" }}>
          {preset.count} mockup
        </div>
        {preset.premium && <Badge tone="warning">Premium</Badge>}
      </div>
    </Card>
  );
}

function TemplateCard({ template, selected, onSelect, compact }) {
  const t = template;
  const fakeDesign = { variant: "abstract-warm", set: t.tags && t.tags.includes("set-of-3") ? "set-of-3" : t.tags && t.tags.includes("set-of-5") ? "set-of-5" : "single" };
  return (
    <div onClick={onSelect} style={{
      background: "var(--color-surface)",
      border: `1px solid ${selected ? "var(--color-accent)" : "var(--color-border)"}`,
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
      cursor: "pointer",
      boxShadow: "var(--shadow-card)",
      position: "relative",
      transition: "all var(--dur) var(--ease-out)",
      outline: selected ? "2px solid rgba(232,93,37,0.18)" : "none",
      outlineOffset: -1,
    }}>
      <div style={{ position: "relative", aspectRatio: "4 / 3", overflow: "hidden" }}>
        <MSScene template={t} design={fakeDesign} />
        {/* badge stack top-left */}
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
          {t.recommended && <Badge tone="accent" dot>Recommended</Badge>}
          {t.premium && <Badge tone="warning">Premium</Badge>}
        </div>
        {/* favorite top-right */}
        <button style={{
          position: "absolute", top: 8, right: 8,
          width: 28, height: 28, borderRadius: "50%",
          background: "rgba(255,255,255,0.92)",
          border: "1px solid var(--color-border)",
          display: "grid", placeItems: "center",
          color: t.favorite ? "var(--color-accent)" : "var(--color-text-subtle)",
          cursor: "pointer"
        }}><Icon d="M12 21s-7-4.5-9.5-9C1 8.5 3 5 7 5c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6 3.5 4.5 7C19 16.5 12 21 12 21z" fill={t.favorite ? "currentColor" : "none"} /></button>
      </div>
      <div style={{ padding: compact ? "8px 10px" : "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
          <div style={{ fontWeight: 500, fontSize: 13, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
          <RatioBadge ratio={t.ratio} />
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {t.tags.slice(0, 2).map(tag => <Chip key={tag} style={{ padding: "1px 6px", fontSize: 10 }}>{tag}</Chip>)}
          {t.recent && <Chip style={{ padding: "1px 6px", fontSize: 10, color: "var(--color-text-subtle)" }}>Recent</Chip>}
        </div>
      </div>
    </div>
  );
}

function AssetSourceTile({ icon, title, meta, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 16px",
      border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
      borderRadius: "var(--radius-md)",
      background: active ? "var(--color-accent-soft)" : "var(--color-surface)",
      cursor: "pointer", textAlign: "left", width: "100%",
      transition: "all var(--dur) var(--ease-out)"
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: active ? "var(--color-accent)" : "var(--color-surface-2)",
        color: active ? "#FFFFFF" : "var(--color-text-muted)",
        display: "grid", placeItems: "center", flexShrink: 0
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{meta}</div>
      </div>
    </button>
  );
}

function MockupPreviewThumb({ template, design, label, size = 64, status, hero }) {
  return (
    <div style={{
      position: "relative",
      width: size, height: size,
      borderRadius: "var(--radius-sm)",
      overflow: "hidden",
      border: "1px solid var(--color-border)",
      background: "var(--color-surface-2)",
      flexShrink: 0
    }}>
      <MSScene template={template} design={design} />
      {status && <div style={{
        position: "absolute", inset: 0,
        background: status === "failed" ? "rgba(177,58,40,0.30)" : "rgba(0,0,0,0.30)",
        display: "grid", placeItems: "center"
      }}>
        <StatusDot status={status} />
      </div>}
      {hero && <div style={{ position: "absolute", left: 4, top: 4 }}><span className="ms-hero-badge">Hero</span></div>}
      {label && <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.60) 100%)",
        color: "#FFF", fontFamily: "var(--font-mono)", fontSize: 9,
        padding: "8px 4px 3px", letterSpacing: "0.04em"
      }}>{label}</div>}
    </div>
  );
}

function BulkBar({ count, total, children }) {
  return (
    <div style={{
      position: "sticky", bottom: 0, zIndex: 5,
      background: "rgba(26,23,21,0.96)",
      color: "#FFFFFF",
      padding: "12px 16px",
      borderRadius: "var(--radius-md)",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: "0 12px 32px rgba(26,23,21,0.32)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          background: "var(--color-accent)", color: "#FFFFFF",
          padding: "2px 8px", borderRadius: 999, letterSpacing: "0.04em"
        }}>{count} / {total} seçili</span>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>{children}</div>
    </div>
  );
}

function QueueSummaryRail({ queue }) {
  const running = queue.filter(q => q.status === "running").length;
  const done = queue.filter(q => q.status === "done").length;
  const failed = queue.filter(q => q.status === "failed").length;
  const queued = queue.filter(q => q.status === "queued").length;
  const total = queue.length;
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)",
      padding: 14
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono)" }}>Render queue</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-subtle)" }}>{done}/{total} ✓</div>
      </div>
      <div style={{
        height: 6, borderRadius: 3,
        background: "var(--color-surface-2)",
        overflow: "hidden", display: "flex", marginBottom: 12
      }}>
        <div style={{ width: `${(done/total)*100}%`, background: "var(--color-success)" }} />
        <div style={{ width: `${(running/total)*100}%`, background: "var(--color-accent)" }} />
        <div style={{ width: `${(failed/total)*100}%`, background: "var(--color-danger)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        <Pill label="Done"    val={done}    color="var(--color-success)" />
        <Pill label="Running" val={running} color="var(--color-accent)" />
        <Pill label="Queued"  val={queued}  color="var(--color-text-subtle)" />
        <Pill label="Failed"  val={failed}  color="var(--color-danger)" />
      </div>
    </div>
  );
}

function Pill({ label, val, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-muted)" }}>{label}</span>
      </div>
      <span style={{ fontSize: 17, fontWeight: 600, color: "var(--color-text)" }}>{val}</span>
    </div>
  );
}

Object.assign(window, {
  MSScene, Frame, SafeAreaOverlay, PlacementHandles,
  StatusDot, RatioBadge, WarningBadge,
  CategoryChip, PresetCard, TemplateCard, AssetSourceTile, MockupPreviewThumb,
  BulkBar, QueueSummaryRail,
});
