/* global React */
/* ═════════════════════════════════════════════════════════════════════
   B2 · Selections index — 2-col hero card grid
   Per §B2: stage-colored CTAs (purple edit, orange apply, blue send,
   ghost reopen). No bulk-select at index. Single-select via kebab.
   ═════════════════════════════════════════════════════════════════════ */
function B2SelectionsIndex() {
  /* Per user note: each card has ONE dominant action — the next-step
     CTA implied by stage. No branching logic; stage maps deterministic-
     ally to one action. */
  const STAGE_CTA = {
    "Curating":     { label:"Open Selection",  variant:"secondary", icon:"arrow" },
    "Edits":        { label:"Open Selection",  variant:"secondary", icon:"arrow" },
    "Mockup ready": { label:"Apply Mockups",   variant:"primary",   icon:"image" },
    "Sent":         { label:"Open Product",    variant:"ghost",     icon:"arrow" },
  };

  const sets = [
    { id:"sel-01", name:"Christmas Wall Art Set", count:12, stage:"Mockup ready", source:"batch_01J7Y", updated:"2h ago",  thumbs:["christmas","nursery","poster"] },
    { id:"sel-02", name:"Boho Clipart Bundle Q4", count:25, stage:"Edits",        source:"batch_01J7Z", updated:"5h ago",  thumbs:["boho","clipart","sticker"] },
    { id:"sel-03", name:"Nursery 3-print Set",    count:6,  stage:"Mockup ready", source:"batch_01J7V", updated:"1d ago",  thumbs:["nursery","abstract","poster"] },
    { id:"sel-04", name:"Bookmark Quotes Set",    count:5,  stage:"Curating",     source:"batch_01J7T", updated:"2d ago",  thumbs:["sticker","clipart","poster"] },
    { id:"sel-05", name:"Riso Poster Pack",       count:8,  stage:"Sent",         source:"batch_01J7U", updated:"4d ago",  thumbs:["riso","abstract","poster"] },
    { id:"sel-06", name:"Mountain Studies",       count:4,  stage:"Mockup ready", source:"batch_01J7S", updated:"6d ago",  thumbs:["landscape","abstract","poster"] },
  ];

  const stageBadge = (s)=>({ "Curating":"neutral","Edits":"purple","Mockup ready":"info","Sent":"success" }[s]);

  return (
    <div className="flex flex-col h-screen min-w-0 flex-1">
      <Topbar title="Selections" subtitle="12 SETS · 4 MOCKUP-READY">
        <Btn variant="primary" size="sm" icon={<Icon name="plus" size={13}/>}>+ New Selection</Btn>
      </Topbar>

      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 border-b border-[var(--k-line)] bg-[var(--k-bg)]">
        <div className="relative flex-1 max-w-[420px]">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--k-ink-3)]"/>
          <input className="k-input !pl-9" placeholder="Search selections by name, source batch…"/>
        </div>
        <div className="flex items-center gap-1.5">
          <Chip caret>Stage</Chip>
          <Chip caret>Source batch</Chip>
          <Chip caret>Date</Chip>
        </div>
        <span className="ml-auto k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{sets.length} of 12</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 gap-4">
          {sets.map(s=>(
            <div key={s.id} className="k-card k-card--hero overflow-hidden" data-interactive="true">
              <div className="grid grid-cols-3 gap-1.5 p-3 pb-0">
                {s.thumbs.map((k,j)=><div key={j} className="k-thumb !aspect-square" data-kind={k}/>)}
              </div>
              <div className="p-4 pt-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold leading-tight truncate">{s.name}</div>
                    <div className="mt-1 k-mono text-[11px] text-[var(--k-ink-3)] tracking-wider tabular-nums">{s.count} designs · {s.source} · {s.updated}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Badge tone={stageBadge(s.stage)} dot>{s.stage}</Badge>
                    <button className="k-iconbtn !w-7 !h-7"><Icon name="more" size={13}/></button>
                  </div>
                </div>
                <div className="mt-3.5">
                  {(() => { const c = STAGE_CTA[s.stage]; return (
                    <Btn variant={c.variant} size="sm" iconRight={<Icon name={c.icon} size={11}/>}>{c.label}</Btn>
                  ); })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   B3 · Selection detail — 4 tabs: Designs / Edits / Mockups / History
   Per §B3: gating on stage; Apply Mockups disabled if Curating + 4-or-
   fewer items. Mockups tab is read-only preview here; full management
   lives in Products/[id]/Mockups (cross-link).
   ═════════════════════════════════════════════════════════════════════ */
function B3SelectionDetail() {
  const [tab, setTab] = React.useState("designs");
  const [selected, setSelected] = React.useState(["d3","d5"]);
  const tabs = [
    { id:"designs", label:"Designs", count:12 },
    { id:"edits",   label:"Edits",   count:4 },
    { id:"mockups", label:"Mockups", count:6 },
    { id:"history", label:"History" },
  ];
  return (
    <div className="flex flex-col h-screen min-w-0 flex-1">
      <Topbar back={{ to:"b2" }} title="Christmas Wall Art Set" subtitle="SEL · 01J8M2"
              status={{ tone:"info", label:"Mockup ready" }}>
        <Btn variant="secondary" size="sm" icon={<Icon name="duplicate" size={12}/>}>Duplicate</Btn>
        <button className="k-iconbtn"><Icon name="more" size={14}/></button>
        <Btn variant="primary" size="sm" icon={<Icon name="image" size={13}/>}>Apply Mockups</Btn>
      </Topbar>

      <div className="flex-shrink-0 bg-[var(--k-bg)]">
        <Tabs tabs={tabs} active={tab} onChange={setTab}/>
      </div>

      {tab==="designs" && <B3Designs selected={selected} setSelected={setSelected}/>}
      {tab==="edits"   && <B3Edits/>}
      {tab==="mockups" && <B3Mockups/>}
      {tab==="history" && <B3History/>}

      {tab==="designs" && selected.length >= 2 && (
        <FloatingBulk count={selected.length} onClear={()=>setSelected([])}
          actions={[
            { label:"Apply edits", icon:<Icon name="sparkle" size={13}/>, primary:true },
            { label:"Reorder",     icon:<Icon name="drag"    size={13}/> },
            { label:"Remove",      icon:<Icon name="trash"   size={13}/> },
          ]}/>
      )}
    </div>
  );
}

function B3Designs({ selected, setSelected }) {
  const items = Array.from({length:12}).map((_,i)=>{
    const k=["christmas","nursery","poster","abstract","landscape","christmas","nursery","poster","abstract","landscape","christmas","poster"][i];
    return { id:"d"+(i+1), kind:k,
             title:["Holly wreath","Snow nursery","Type poster","Riso study","Mountain print","Star wreath","Bear nursery","Holiday quote","Color study","Pine ridge","Cardinal print","Frost poster"][i],
             ratio:["Square","Portrait","Square","Portrait","Landscape"][i%5],
             batch:"01J7Y" };
  });
  const toggle=(id)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">12 designs · drag to reorder</div>
        <Btn variant="secondary" size="sm" icon={<Icon name="plus" size={12}/>}>Add from Library</Btn>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {items.map(it=>{
          const isSel=selected.includes(it.id);
          return (
            <div key={it.id} onClick={()=>toggle(it.id)}
                 className={`k-card overflow-hidden ${isSel?"k-ring-selected":""}`} data-interactive="true">
              <div className="relative">
                <div className="p-2 pb-0"><div className="k-thumb" data-kind={it.kind} data-aspect="square"/></div>
                <div className="absolute top-3 left-3"><Checkbox checked={isSel} onChange={()=>toggle(it.id)}/></div>
                <div className="absolute top-3 right-3 flex items-center gap-1">
                  <button className="k-iconbtn !w-6 !h-6 !bg-white/95 cursor-grab"><Icon name="drag" size={11}/></button>
                </div>
              </div>
              <div className="p-3">
                <div className="text-[13px] font-medium leading-tight truncate">{it.title}</div>
                <div className="mt-1 k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">{it.ratio} · batch_{it.batch}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function B3Edits() {
  const rows=[
    { id:"d1",  title:"Holly wreath",   kind:"christmas", edits:["bg","color"], applied:true },
    { id:"d2",  title:"Snow nursery",   kind:"nursery",   edits:[],             applied:false },
    { id:"d3",  title:"Type poster",    kind:"poster",    edits:["crop"],       applied:true },
    { id:"d4",  title:"Riso study",     kind:"abstract",  edits:[],             applied:false },
    { id:"d5",  title:"Mountain print", kind:"landscape", edits:[],             applied:false },
    { id:"d6",  title:"Star wreath",    kind:"christmas", edits:[],             applied:false },
  ];
  const editIcons={ bg:"image", color:"sparkle", crop:"grid", upscale:"zap", eraser:"x" };
  const editLabel={ bg:"Background remove", color:"Color edit", crop:"Crop", upscale:"Upscale", eraser:"Magic eraser" };
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-4">Per-design edit triggers — opens edit modal (deferred)</div>
      <div className="k-card overflow-hidden">
        {rows.map((r,i)=>(
          <div key={r.id} className={`flex items-center gap-4 px-4 py-3 ${i<rows.length-1?"border-b border-[var(--k-line-soft)]":""}`}>
            {r.applied ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="k-thumb !w-12 !aspect-square opacity-50" data-kind={r.kind}/>
                <Icon name="arrow" size={12} className="text-[var(--k-ink-3)]"/>
                <div className="relative">
                  <div className="k-thumb !w-12 !aspect-square" data-kind={r.kind} style={{filter:"saturate(1.4) brightness(1.05)"}}/>
                  <span className="absolute -top-1 -right-1 px-1 py-0.5 bg-[var(--k-purple)] text-white k-mono text-[8.5px] rounded uppercase tracking-wider">v2</span>
                </div>
              </div>
            ) : (
              <div className="k-thumb !w-12 !aspect-square flex-shrink-0" data-kind={r.kind}/>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium leading-tight">{r.title}</div>
              <div className="mt-0.5 k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">
                {r.edits.length===0 ? "No edits applied" : r.edits.map(e=>editLabel[e]).join(" · ")}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {Object.keys(editIcons).map(e=>(
                <button key={e} title={editLabel[e]} className={`k-iconbtn ${r.edits.includes(e)?"!border-[var(--k-purple)] !text-[var(--k-purple)]":""}`}>
                  <Icon name={editIcons[e]} size={13}/>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function B3Mockups() {
  /* Read-only preview per §B3.Mockups — three sections preserved per
     §3 mockup constraint. Cross-link to Product detail for full mgmt. */
  const sections=[
    { id:"life",   label:"Lifestyle Mockups",     count:3, kinds:["nursery","poster","christmas"] },
    { id:"bundle", label:"Bundle Preview Sheets", count:2, kinds:["christmas","nursery"] },
    { id:"my",     label:"My Templates",          count:1, kinds:["poster"] },
  ];
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">Read-only preview · full management in Product detail</div>
        <Btn variant="ghost" size="sm" iconRight={<Icon name="arrow" size={11}/>}>View in Product</Btn>
      </div>
      {sections.map(s=>(
        <div key={s.id} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-[14.5px] font-semibold">{s.label}</h3>
            <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">{s.count}</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {s.kinds.map((k,i)=>(
              <div key={i} className="k-card overflow-hidden">
                <div className="p-2 pb-0"><div className="k-thumb" data-kind={k} data-aspect="square"/></div>
                <div className="p-3">
                  <div className="text-[12.5px] font-medium leading-tight">{["Living room","Desk surface","Nursery scene","Sheet layout","Composite 3-up","Custom PSD"][i]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function B3History() {
  const events=[
    { t:"2h ago",  ev:"Stage changed to Mockup ready",   meta:"by Husko Bro" },
    { t:"3h ago",  ev:"Mockup applied · Lifestyle living room", meta:"3 designs" },
    { t:"4h ago",  ev:"Color edit applied",              meta:"Type poster" },
    { t:"5h ago",  ev:"Background removed",              meta:"Holly wreath" },
    { t:"1d ago",  ev:"4 designs added from Library",    meta:"selected from batch_01J7Y" },
    { t:"1d ago",  ev:"Selection created",               meta:"by Husko Bro" },
  ];
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="k-card overflow-hidden">
        {events.map((e,i)=>(
          <div key={i} className={`flex items-start gap-4 px-4 py-3 ${i<events.length-1?"border-b border-[var(--k-line-soft)]":""}`}>
            <span className="k-mono text-[11px] text-[var(--k-ink-3)] tracking-wider tabular-nums w-20 pt-0.5">{e.t}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-[var(--k-ink)]">{e.ev}</div>
              <div className="mt-0.5 k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">{e.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { B2SelectionsIndex, B3SelectionDetail });
