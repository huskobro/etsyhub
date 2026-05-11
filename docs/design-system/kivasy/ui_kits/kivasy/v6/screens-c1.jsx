/* ═════════════════════════════════════════════════════════════════
   C1 · Templates — single top-level surface, four sub-types as
   filterable categories. Per §C1: no detail pages; sub-type segment
   tabs; each sub-type uses its native layout (list / card variants).
   Per §6: Stage CTA discipline holds — orange = "+ New Template".
   ═════════════════════════════════════════════════════════════════ */
function C1Templates() {
  const [sub, setSub] = React.useState("prompts");
  const [q, setQ] = React.useState("");

  const subTabs = [
    { id:"prompts",  label:"Prompt Templates",  count: 38 },
    { id:"presets",  label:"Style Presets",     count: 14 },
    { id:"mockups",  label:"Mockup Templates",  count: 62 },
    { id:"recipes",  label:"Product Recipes",   count: 9  },
  ];
  const totals = subTabs.reduce((a,b)=>a+b.count,0);

  const sectionRight = sub === "mockups"
    ? <Btn variant="secondary" size="sm" icon={<Icon name="upload" size={12}/>}>Upload PSD</Btn>
    : sub === "recipes"
      ? <Btn variant="secondary" size="sm" icon={<Icon name="download" size={12}/>}>Import recipe</Btn>
      : null;

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <Topbar title="Templates" subtitle={`${totals} · 4 SUB-TYPES`}>
        <button className="k-iconbtn"><Icon name="search" size={14}/></button>
        <Btn variant="primary" size="sm" icon={<Icon name="plus" size={12}/>}>New Template</Btn>
      </Topbar>

      <div className="px-7 pt-5 pb-3 flex items-center gap-3">
        <SiblingTabs tabs={subTabs.map(t=>({id:t.id,label:`${t.label} · ${t.count}`}))} active={sub} onChange={setSub}/>
        <div className="flex-1"/>
        {sectionRight}
      </div>

      <div className="flex-1 overflow-y-auto px-7 pb-10">
        {sub === "prompts"  && <SubPrompts q={q} setQ={setQ}/>}
        {sub === "presets"  && <SubPresets/>}
        {sub === "mockups"  && <SubMockups/>}
        {sub === "recipes"  && <SubRecipes/>}
      </div>
    </main>
  );
}

/* ─── C1.Prompts ───────────────────────────────────────────────── */
function SubPrompts({ q, setQ }) {
  const rows = [
    { id:"pt_01J7Y", name:"Boho line wall art · neutral palette",  thumb:"boho",      used:["batch_01J8A","batch_01J7Y","batch_01J6Z"], edited:"2h ago" },
    { id:"pt_01J7X", name:"Christmas wreath · warm white",         thumb:"christmas", used:["batch_01J7C","batch_01J6V"],               edited:"5h ago" },
    { id:"pt_01J7W", name:"Minimal type poster · serif",           thumb:"poster",    used:["batch_01J7B"],                             edited:"1d ago" },
    { id:"pt_01J7V", name:"Nursery pastel · soft watercolor",      thumb:"nursery",   used:["batch_01J6Q","batch_01J6P"],               edited:"2d ago" },
    { id:"pt_01J7U", name:"Riso poster · 2-color overprint",       thumb:"riso",      used:["batch_01J6L"],                             edited:"3d ago" },
    { id:"pt_01J7T", name:"Abstract sunset arch · sand & rust",    thumb:"abstract",  used:["batch_01J6F","batch_01J6E","batch_01J6D"], edited:"4d ago" },
    { id:"pt_01J7S", name:"Mountain study · alpenglow",            thumb:"landscape", used:["batch_01J6A"],                             edited:"5d ago" },
    { id:"pt_01J7R", name:"Bookmark quote · brush serif",          thumb:"sticker",   used:["batch_01J5Z"],                             edited:"1w ago" },
  ];
  const filtered = rows.filter(r => r.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="k-card p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--k-line)] flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--k-ink-3)]"/>
          <input className="k-input pl-9" placeholder="Search prompts…" value={q} onChange={e=>setQ(e.target.value)}/>
        </div>
        <span className="ml-auto k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">{filtered.length} OF {rows.length}</span>
      </div>

      <div className="grid" style={{gridTemplateColumns:"32px 1fr 200px 200px 80px"}}>
        <div className="contents text-[10px] k-mono uppercase tracking-[0.14em] text-[var(--k-ink-3)]">
          <div className="px-4 py-2.5 bg-[var(--k-bg-2)] border-b border-[var(--k-line)]"/>
          <div className="px-3 py-2.5 bg-[var(--k-bg-2)] border-b border-[var(--k-line)]">Prompt</div>
          <div className="px-3 py-2.5 bg-[var(--k-bg-2)] border-b border-[var(--k-line)]">Used in (last 5)</div>
          <div className="px-3 py-2.5 bg-[var(--k-bg-2)] border-b border-[var(--k-line)]">Last edited</div>
          <div className="px-3 py-2.5 bg-[var(--k-bg-2)] border-b border-[var(--k-line)]"/>
        </div>
        {filtered.map(r => (
          <div key={r.id} className="contents group">
            <div className="px-4 py-3 border-b border-[var(--k-line-soft)] flex items-center">
              <div className="k-thumb w-7 h-7" data-kind={r.thumb} style={{aspectRatio:"1/1"}}/>
            </div>
            <div className="px-3 py-3 border-b border-[var(--k-line-soft)] min-w-0">
              <div className="text-[13.5px] font-medium truncate">{r.name}</div>
              <div className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider mt-0.5">{r.id}</div>
            </div>
            <div className="px-3 py-3 border-b border-[var(--k-line-soft)] flex items-center gap-1 flex-wrap">
              {r.used.slice(0,3).map(b => <span key={b} className="k-mono text-[10px] text-[var(--k-ink-2)] bg-[var(--k-bg-2)] px-1.5 py-0.5 rounded">{b.replace("batch_","")}</span>)}
              {r.used.length > 3 && <span className="k-mono text-[10px] text-[var(--k-ink-3)]">+{r.used.length-3}</span>}
            </div>
            <div className="px-3 py-3 border-b border-[var(--k-line-soft)] flex items-center k-mono text-[11px] text-[var(--k-ink-3)] tracking-wider">{r.edited}</div>
            <div className="px-3 py-3 border-b border-[var(--k-line-soft)] flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="k-iconbtn" data-size="sm"><Icon name="arrow" size={12}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── C1.Presets ──────────────────────────────────────────────── */
function SubPresets() {
  const presets = [
    { name:"Square · neutral · refs medium",   sim:"Medium",  ar:["square"],            params:["palette: neutral","weight: medium"], batches: 38 },
    { name:"Portrait · loose · refs heavy",    sim:"Heavy",   ar:["portrait"],          params:["palette: as-ref","weight: heavy"],   batches: 14 },
    { name:"Landscape · light · refs subtle",  sim:"Subtle",  ar:["landscape"],         params:["palette: warm","weight: subtle"],    batches: 22 },
    { name:"Multi-AR bundle · medium",         sim:"Medium",  ar:["square","portrait","landscape"], params:["palette: brand","weight: medium"], batches: 9 },
    { name:"Square · brand color lock",        sim:"Heavy",   ar:["square"],            params:["palette: locked","weight: heavy"],   batches: 6 },
    { name:"Portrait · spiritual mood",        sim:"Medium",  ar:["portrait"],          params:["palette: muted","weight: medium"],   batches: 4 },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {presets.map((p,i) => (
        <div key={i} className="k-card p-4">
          <div className="flex items-center gap-1.5 mb-3">
            {p.ar.map(a => (
              <span key={a} className="k-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--k-ink-2)] bg-[var(--k-bg-2)] border border-[var(--k-line)] px-2 py-1 rounded inline-flex items-center gap-1">
                <span className="inline-block bg-[var(--k-ink-3)]"
                  style={{width: a==="landscape"?12:a==="portrait"?6:9, height: a==="landscape"?6:a==="portrait"?12:9, borderRadius:1.5}}/>
                {a}
              </span>
            ))}
            <span className="ml-auto k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">SIM · {p.sim}</span>
          </div>
          <div className="text-[14px] font-semibold mb-2 leading-snug">{p.name}</div>
          <div className="flex flex-wrap gap-1 mb-3">
            {p.params.map(x => <span key={x} className="k-mono text-[10px] text-[var(--k-ink-2)] bg-[var(--k-bg-2)] px-1.5 py-0.5 rounded">{x}</span>)}
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-[var(--k-line-soft)]">
            <span className="k-mono text-[11px] text-[var(--k-ink-3)] tracking-wider">{p.batches} batches</span>
            <Btn variant="ghost" size="sm" iconRight={<Icon name="arrow" size={11}/>}>Apply</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── C1.Mockups ──────────────────────────────────────────────── */
function SubMockups() {
  /* Per §C1 + §3 mockup constraint: three classes preserved, grouped
     visibly with section headings. My Templates section anchors the
     PSD-upload destination referenced from A7. */
  const groups = [
    { kind:"Lifestyle scenes",       sub:"Room · desk · laptop · hands", items: [
      { name:"Living room · linen sofa", tags:["frame","wall"], thumb:"nursery" },
      { name:"Workspace · oak desk",     tags:["desk","laptop"], thumb:"poster" },
      { name:"Bedroom · neutral",        tags:["frame","wall"], thumb:"boho" },
      { name:"Café table · morning",     tags:["hands","cup"],  thumb:"abstract" },
    ]},
    { kind:"Bundle Preview Sheets",  sub:"Multi-design composites",      items: [
      { name:"4-up grid · square",       tags:["grid","4×"],    thumb:"clipart" },
      { name:"6-up grid · square",       tags:["grid","6×"],    thumb:"clipart" },
      { name:"Strip preview · 12-wide",  tags:["strip","12×"],  thumb:"clipart" },
      { name:"Diagonal stack · 3-up",    tags:["stack","3×"],   thumb:"clipart" },
    ]},
    { kind:"My Templates",           sub:"Operator-uploaded PSDs · smart-objects", items: [
      { name:"Studio frame mockup.psd",  tags:["psd","smart-obj"], thumb:"poster" },
      { name:"Bookmark hand · v2.psd",   tags:["psd","smart-obj"], thumb:"sticker" },
      { name:"Sticker sheet · A4.psd",   tags:["psd","smart-obj"], thumb:"sticker" },
    ]},
  ];

  return (
    <div className="space-y-7">
      {groups.map(g => (
        <section key={g.kind}>
          <div className="flex items-baseline gap-3 mb-3">
            <h3 className="text-[14px] font-semibold tracking-tight">{g.kind}</h3>
            <span className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{g.sub} · {g.items.length}</span>
            {g.kind === "My Templates" && (
              <Btn variant="secondary" size="sm" icon={<Icon name="upload" size={12}/>} className="ml-auto">Upload PSD</Btn>
            )}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {g.items.map((m,i) => (
              <div key={i} className="k-card p-3" data-interactive="true">
                <div className="k-thumb mb-3" data-kind={m.thumb}/>
                <div className="text-[13px] font-medium truncate">{m.name}</div>
                <div className="flex items-center gap-1 mt-2">
                  {m.tags.map(t => <span key={t} className="k-mono text-[10px] text-[var(--k-ink-2)] bg-[var(--k-bg-2)] px-1.5 py-0.5 rounded">{t}</span>)}
                  <Btn variant="ghost" size="sm" className="ml-auto !h-6 !px-2" iconRight={<Icon name="arrow" size={10}/>}>Use</Btn>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ─── C1.Recipes ──────────────────────────────────────────────── */
function SubRecipes() {
  const recipes = [
    { name:"Wall Art Set · 12 designs · Boho",   thumbs:["boho","nursery","abstract","poster"],     chain:["Boho line prompt","Square preset","Lifestyle mockup","Detailed listing"],     made: 18 },
    { name:"Clipart Bundle · 25 PNG",            thumbs:["clipart","clipart","clipart","clipart"],   chain:["Boho clipart prompt","Multi-AR preset","Bundle sheet 6-up","Premium listing"], made: 9 },
    { name:"Holiday Bookmark Set · 5",           thumbs:["sticker","christmas","sticker","sticker"], chain:["Quote brush prompt","Portrait preset","My PSD bookmark","Playful listing"],   made: 6 },
    { name:"Riso Poster Pack · 8",               thumbs:["riso","riso","poster","abstract"],         chain:["Riso 2-color prompt","Landscape preset","Studio frame","Minimalist listing"],  made: 4 },
    { name:"Nursery 3-print Set",                thumbs:["nursery","abstract","poster","nursery"],   chain:["Pastel watercolor prompt","Portrait preset","Lifestyle bedroom","Premium listing"], made: 3 },
    { name:"Mountain Studies · 4",               thumbs:["landscape","mountain","abstract","landscape"], chain:["Alpenglow prompt","Landscape preset","Studio frame","Detailed listing"],  made: 2 },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {recipes.map((r,i) => (
        <div key={i} className="k-card k-card--hero p-4">
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {r.thumbs.slice(0,4).map((t,j) => <div key={j} className="k-thumb" data-kind={t} style={{aspectRatio:"1/1"}}/>)}
          </div>
          <div className="text-[14.5px] font-semibold mb-2 leading-snug">{r.name}</div>
          {/* Chain summary inline component — per §7.3 */}
          <div className="flex items-center gap-1.5 flex-wrap mb-3 text-[11px]">
            {r.chain.map((c,j) => (
              <React.Fragment key={j}>
                <span className="k-mono text-[10px] text-[var(--k-ink-2)] bg-[var(--k-bg-2)] px-1.5 py-0.5 rounded">{c}</span>
                {j < r.chain.length - 1 && <Icon name="arrow" size={9} className="text-[var(--k-ink-4)]"/>}
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-[var(--k-line-soft)]">
            <span className="k-mono text-[11px] text-[var(--k-ink-3)] tracking-wider">{r.made} products created</span>
            <Btn variant="ghost" size="sm" iconRight={<Icon name="arrow" size={11}/>}>Run</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { C1Templates });
