/* global React */

/* ═══════════════════════════════════════════════════════════════
   A6 · CREATE VARIATIONS · split modal
   ═══════════════════════════════════════════════════════════════ */
function A6CreateVariations({ onClose }) {
  const [aspect, setAspect] = React.useState("square");
  const [similarity, setSimilarity] = React.useState(1); // 0=Close 1=Medium 2=Loose 3=Inspired
  const [count, setCount] = React.useState(8);
  const [refParams, setRefParams] = React.useState({ sref: true, oref: false, cref: false });
  const [srefWeight, setSrefWeight] = React.useState(0.6);

  const simStops = ["Close","Medium","Loose","Inspired"];
  const simHints = [
    "New designs will closely match composition + palette",
    "Variations diverge in detail but keep palette and subject",
    "Loose interpretation — palette held, composition free",
    "Subject-only inspiration — no compositional ties",
  ];

  return (
    <Modal title="Create Variations" onClose={onClose}
      rail={
        <>
          <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-3">Source reference</div>
          <div className="k-thumb" data-kind="boho" style={{aspectRatio:"1/1", borderRadius: 10}}/>
          <h3 className="mt-3 text-[14px] font-semibold leading-tight">Boho line art bundle</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="accent">Pinterest</Badge>
            <Badge>Wall art</Badge>
          </div>
          <dl className="mt-4 space-y-2.5 text-[12px]">
            <div className="flex justify-between"><dt className="text-[var(--k-ink-3)]">Added</dt><dd>2h ago</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--k-ink-3)]">Type</dt><dd>Wall art print</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--k-ink-3)]">Resolution</dt><dd className="k-mono">2400 × 1800</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--k-ink-3)]">Source</dt><dd className="truncate max-w-[160px]">pinterest.com/…</dd></div>
          </dl>
          <button className="mt-4 k-btn k-btn--ghost" data-size="sm"><Icon name="link" size={12}/>View original</button>
        </>
      }
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <div className="ml-auto flex items-center gap-3">
            <span className="k-mono text-[11px] text-[var(--k-ink-3)]">~$0.{count*4} · est. {Math.round(count*0.5)}m</span>
            <Btn variant="primary" icon={<Icon name="sparkle" size={13}/>}>Create {count} Variations</Btn>
          </div>
        </>
      }>
      <div className="space-y-7 max-w-[640px]">
        <Section label="Aspect ratio">
          <div className="grid grid-cols-3 gap-3">
            <RatioCard active={aspect === "square"} onClick={()=>setAspect("square")} w={56} h={56} title="Square" sub="1:1"/>
            <RatioCard active={aspect === "landscape"} onClick={()=>setAspect("landscape")} w={72} h={48} title="Landscape" sub="3:2"/>
            <RatioCard active={aspect === "portrait"} onClick={()=>setAspect("portrait")} w={48} h={72} title="Portrait" sub="2:3"/>
          </div>
        </Section>

        <Section label="Similarity" hint={simHints[similarity]}>
          <div className="flex">
            {simStops.map((s, i) => (
              <button key={s} onClick={()=>setSimilarity(i)}
                className={`flex-1 h-10 text-[12.5px] font-medium border border-[var(--k-line)] -ml-px first:ml-0 first:rounded-l-md last:rounded-r-md transition-colors ${i === similarity ? "bg-[var(--k-orange-soft)] border-[var(--k-orange)] text-[var(--k-orange-ink)] z-10 relative" : "bg-[var(--k-paper)] text-[var(--k-ink-2)] hover:border-[var(--k-line-strong)]"}`}>
                {s}
              </button>
            ))}
          </div>
        </Section>

        <Section label="Variation count">
          <div className="flex">
            {[4,6,8,12].map(n => (
              <button key={n} onClick={()=>setCount(n)}
                className={`flex-1 h-10 text-[13px] font-semibold border border-[var(--k-line)] -ml-px first:ml-0 first:rounded-l-md last:rounded-r-md transition-colors ${n === count ? "bg-[var(--k-orange-soft)] border-[var(--k-orange)] text-[var(--k-orange-ink)] z-10 relative" : "bg-[var(--k-paper)] text-[var(--k-ink-2)] hover:border-[var(--k-line-strong)]"}`}>
                {n}
              </button>
            ))}
          </div>
        </Section>

        <Section label="Prompt template">
          <button className="w-full flex items-center gap-3 h-11 px-3 border border-[var(--k-line)] rounded-md bg-[var(--k-paper)] hover:border-[var(--k-line-strong)] transition-colors">
            <Icon name="search" size={14} className="text-[var(--k-ink-3)]"/>
            <div className="flex-1 text-left">
              <div className="text-[13.5px] font-medium">Boho line wall art · neutral palette</div>
            </div>
            <span className="k-mono text-[11px] text-[var(--k-ink-3)]">tpl_204</span>
            <Icon name="chevronD" size={13} className="text-[var(--k-ink-3)]"/>
          </button>
        </Section>

        <Section label="Reference parameters" hint="Optional · advanced">
          <div className="flex flex-wrap gap-2">
            {[
              { k:"sref", label:"--sref", desc:"Style reference" },
              { k:"oref", label:"--oref", desc:"Object reference" },
              { k:"cref", label:"--cref", desc:"Character reference" },
            ].map(({k,label,desc}) => {
              const on = refParams[k];
              return (
                <button key={k} onClick={()=>setRefParams(s => ({...s, [k]: !s[k]}))}
                  className={`flex items-center gap-2 h-9 px-3 rounded-md border transition-all ${on ? "bg-[var(--k-orange-soft)] border-[var(--k-orange)]" : "bg-[var(--k-paper)] border-[var(--k-line)] hover:border-[var(--k-line-strong)]"}`}>
                  <Checkbox checked={on} onChange={()=>setRefParams(s => ({...s, [k]: !s[k]}))}/>
                  <span className="k-mono text-[11.5px] font-semibold" style={{color: on ? "var(--k-orange-ink)" : "var(--k-ink-2)"}}>{label}</span>
                  <span className="text-[12px]" style={{color: on ? "var(--k-orange-ink)" : "var(--k-ink-3)"}}>{desc}</span>
                </button>
              );
            })}
          </div>
          {refParams.sref && (
            <div className="mt-3 p-3 rounded-md border border-[var(--k-line)] bg-[var(--k-bg-2)]/40">
              <div className="flex items-center justify-between mb-2">
                <span className="k-mono text-[11px] text-[var(--k-ink-2)]">--sref weight</span>
                <span className="k-mono text-[11px] tabular-nums font-semibold">{srefWeight.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={srefWeight} onChange={e=>setSrefWeight(parseFloat(e.target.value))} className="w-full accent-[var(--k-orange)]"/>
            </div>
          )}
        </Section>
      </div>
    </Modal>
  );
}
function Section({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <label className="text-[13px] font-semibold">{label}</label>
        {hint && <span className="k-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--k-ink-3)]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function RatioCard({ active, onClick, w, h, title, sub }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 h-[120px] rounded-md border-2 transition-all ${active ? "border-[var(--k-orange)] bg-[var(--k-orange-soft)]/30 shadow-[0_4px_12px_rgba(232,93,37,0.12)]" : "border-[var(--k-line)] bg-[var(--k-paper)] hover:border-[var(--k-line-strong)]"}`}>
      <div style={{width: w, height: h, background: active ? "var(--k-orange)" : "var(--k-line-strong)", borderRadius: 3}}/>
      <div className="text-center">
        <div className="text-[12.5px] font-semibold">{title}</div>
        <div className="k-mono text-[10.5px] text-[var(--k-ink-3)]">{sub}</div>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   A7 · APPLY MOCKUPS · split modal
   Three SIBLING tabs: Lifestyle / Bundle Preview Sheets / My Templates
   ═══════════════════════════════════════════════════════════════ */
function A7ApplyMockups({ onClose }) {
  const [tab, setTab] = React.useState("lifestyle");
  const [picked, setPicked] = React.useState({
    lifestyle: ["lf1","lf3","lf5","lf6"],
    bundle:    ["bp1","bp2"],
    template:  [],
  });
  const total = picked.lifestyle.length + picked.bundle.length + picked.template.length;
  const togglePick = (cat, id) => setPicked(s => ({ ...s, [cat]: s[cat].includes(id) ? s[cat].filter(x=>x!==id) : [...s[cat], id] }));

  const lifestyle = [
    { id:"lf1", kind:"nursery",  name:"Nursery wall · cream",     tags:["Nursery","Wall"] },
    { id:"lf2", kind:"poster",   name:"Living room · framed",     tags:["Living room","Framed"] },
    { id:"lf3", kind:"landscape",name:"Desk surface · oak",        tags:["Desk surface"] },
    { id:"lf4", kind:"abstract", name:"Bedroom · gallery wall",   tags:["Bedroom","Gallery"] },
    { id:"lf5", kind:"poster",   name:"Hallway · single frame",   tags:["Hallway"] },
    { id:"lf6", kind:"nursery",  name:"Children's room · pastel", tags:["Children's","Pastel"] },
    { id:"lf7", kind:"landscape",name:"Office · desktop scene",   tags:["Office","Desk"] },
    { id:"lf8", kind:"abstract", name:"Cafe wall · warm",         tags:["Cafe"] },
  ];
  const bundles = [
    { id:"bp1", kind:"clipart", name:"All 25 in a sheet",          tags:["Sheet","25-up"] },
    { id:"bp2", kind:"poster",  name:"3-print set composite",      tags:["3-up","Set"] },
    { id:"bp3", kind:"riso",    name:"5-bookmark composite",       tags:["5-up","Bookmark"] },
    { id:"bp4", kind:"sticker", name:"Sticker sheet layout",       tags:["Sticker","Sheet"] },
    { id:"bp5", kind:"clipart", name:"12-up grid",                 tags:["Grid"] },
    { id:"bp6", kind:"poster",  name:"Series cover composite",     tags:["Cover"] },
  ];

  return (
    <Modal title="Apply Mockups" onClose={onClose}
      rail={
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">Selected designs</div>
            <span className="k-mono text-[11px] tabular-nums font-semibold">12</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({length:12}).map((_,i)=>(
              <div key={i} className="relative">
                <div className="k-thumb" data-kind={["boho","poster","abstract","clipart","nursery","poster","christmas","riso","landscape","boho","poster","clipart"][i]} style={{aspectRatio:"1/1", borderRadius: 6}}/>
                <div className="absolute bottom-0.5 right-0.5 k-mono text-[8.5px] px-1 rounded bg-black/70 text-white">{i+1}</div>
              </div>
            ))}
          </div>
          <button className="mt-4 k-btn k-btn--ghost" data-size="sm"><Icon name="layers" size={12}/>Edit selection</button>
        </>
      }
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <div className="ml-auto">
            <Btn variant="primary" icon={<Icon name="sparkle" size={13}/>}>Apply {total} Mockups</Btn>
          </div>
        </>
      }>
      <div className="flex items-center gap-3 mb-4">
        <SiblingTabs
          tabs={[
            { id:"lifestyle", label:`Lifestyle Mockups${picked.lifestyle.length ? ` · ${picked.lifestyle.length}`:""}` },
            { id:"bundle",    label:`Bundle Preview Sheets${picked.bundle.length ? ` · ${picked.bundle.length}`:""}` },
            { id:"template",  label:`My Templates${picked.template.length ? ` · ${picked.template.length}`:""}` },
          ]}
          active={tab} onChange={setTab}/>
        <div className="ml-auto flex items-center gap-1.5">
          <Chip caret>Type</Chip>
          <Chip caret>Color</Chip>
          <Chip caret>Aspect ratio</Chip>
        </div>
      </div>

      {tab === "lifestyle" && (
        <div className="grid grid-cols-4 gap-3">
          {lifestyle.map(m => <MockupPick key={m.id} m={m} picked={picked.lifestyle.includes(m.id)} onToggle={()=>togglePick("lifestyle", m.id)}/>)}
        </div>
      )}

      {tab === "bundle" && (
        <div className="grid grid-cols-3 gap-3">
          {bundles.map(m => <MockupPick key={m.id} m={m} picked={picked.bundle.includes(m.id)} onToggle={()=>togglePick("bundle", m.id)}/>)}
        </div>
      )}

      {tab === "template" && (
        <div className="flex flex-col items-center justify-center py-16 text-center max-w-[420px] mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[var(--k-bg-2)] border border-[var(--k-line)] flex items-center justify-center mb-4">
            <Icon name="duplicate" size={22} className="text-[var(--k-ink-3)]"/>
          </div>
          <h3 className="text-[15px] font-semibold">No custom templates yet</h3>
          <p className="text-[13px] text-[var(--k-ink-2)] mt-2 leading-relaxed">
            Upload your PSD mockup templates in Templates to apply them here. Smart-object layers are detected automatically.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <Btn variant="primary" size="sm" icon={<Icon name="upload" size={12}/>}>Upload PSD</Btn>
            <Btn variant="ghost" size="sm">Open Templates</Btn>
          </div>
          <div className="mt-6 k-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--k-ink-3)]">
            or browse <a href="#" className="text-[var(--k-blue)] hover:underline">14 Lifestyle templates</a> · <a href="#" className="text-[var(--k-blue)] hover:underline">6 Bundle sheets</a>
          </div>
        </div>
      )}
    </Modal>
  );
}
function MockupPick({ m, picked, onToggle }) {
  return (
    <div onClick={onToggle}
         className={`k-card overflow-hidden cursor-pointer relative ${picked ? "k-ring-selected" : ""}`}
         data-interactive="true">
      <div className="p-2 pb-0"><div className="k-thumb" data-kind={m.kind} style={{aspectRatio:"4/3"}}/></div>
      {picked && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[var(--k-orange)] flex items-center justify-center shadow">
          <Icon name="check" size={13} strokeWidth={2.8} className="text-white"/>
        </div>
      )}
      <div className="p-3">
        <div className="text-[12.5px] font-medium leading-tight truncate">{m.name}</div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {m.tags.map(t => <span key={t} className="k-mono text-[9.5px] px-1.5 py-0.5 rounded bg-[var(--k-bg-2)] text-[var(--k-ink-3)] uppercase tracking-wider">{t}</span>)}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { A6CreateVariations, A7ApplyMockups });
