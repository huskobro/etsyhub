/* global React */
/* ═════════════════════════════════════════════════════════════════════
   B1 · References — top-level index, 5 sub-views in one container
   Per §2/B1: chosen container = sibling segment (k-stabs) at top with
   per-sub-view secondary CTAs. Tabs (k-tabs) reserved for *intra-page*
   navigation (A3, A5); sub-nav rail would steal canvas width and
   compete with the global sidebar. Segment + count chip preserves the
   "References is one place" mental model and keeps the page header CTA
   ("Add Reference") globally consistent across sub-views.
   ═════════════════════════════════════════════════════════════════════ */
function B1References() {
  const [sub, setSub] = React.useState("pool");
  const [density, setDensity] = React.useState("comfortable");
  const [selected, setSelected] = React.useState(["p2","p4","p7"]);
  const subs = [
    { id:"pool",        label:"Pool",        count:142 },
    { id:"stories",     label:"Stories",     count:38 },
    { id:"inbox",       label:"Inbox",       count:21 },
    { id:"shops",       label:"Shops",       count:14 },
    { id:"collections", label:"Collections", count:9 },
  ];

  const subActions = {
    pool:        <Btn variant="primary" size="sm" icon={<Icon name="plus" size={13}/>}>Add Reference</Btn>,
    stories:     <Btn variant="primary" size="sm" icon={<Icon name="plus" size={13}/>}>Add Reference</Btn>,
    inbox:       <Btn variant="primary" size="sm" icon={<Icon name="plus" size={13}/>}>Add Reference</Btn>,
    shops:       <>
                   <Btn variant="secondary" size="sm" icon={<Icon name="link" size={13}/>}>Add Shop URL</Btn>
                   <Btn variant="primary" size="sm" icon={<Icon name="plus" size={13}/>}>Add Reference</Btn>
                 </>,
    collections: <>
                   <Btn variant="secondary" size="sm" icon={<Icon name="layers" size={13}/>}>+ Collection</Btn>
                   <Btn variant="primary" size="sm" icon={<Icon name="plus" size={13}/>}>Add Reference</Btn>
                 </>,
  };

  const subSubtitle = {
    pool:        "142 REFERENCES · 38 ADDED THIS WEEK",
    stories:     "38 STORIES · 12 NEW SHOPS TODAY",
    inbox:       "21 BOOKMARKS · 8 OLDER THAN 7 DAYS",
    shops:       "14 SHOPS · UPDATED 2H AGO",
    collections: "9 COLLECTIONS · 4 ACTIVE THIS WEEK",
  };

  return (
    <div className="flex flex-col h-screen min-w-0 flex-1">
      <Topbar title="References" subtitle={subSubtitle[sub]}>
        {subActions[sub]}
      </Topbar>

      {/* Segment row (sibling tabs) + saved-view chip */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-3 border-b border-[var(--k-line)] bg-[var(--k-bg)]">
        <div className="k-stabs">
          {subs.map(s => (
            <button key={s.id} onClick={()=>setSub(s.id)}
                    className={`k-stab ${sub===s.id?"k-stab--active":""}`}>
              {s.label}<span className="k-mono ml-1.5 text-[10.5px] text-[var(--k-ink-3)] tracking-wider">{s.count}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {(sub==="pool"||sub==="inbox") && <Density value={density} onChange={setDensity}/>}
        </div>
      </div>

      {sub === "pool"        && <SubPool        density={density} selected={selected} setSelected={setSelected}/>}
      {sub === "stories"     && <SubStories/>}
      {sub === "inbox"       && <SubInbox       density={density}/>}
      {sub === "shops"       && <SubShops/>}
      {sub === "collections" && <SubCollections/>}

      {sub==="pool" && selected.length >= 2 && (
        <FloatingBulk count={selected.length} onClear={()=>setSelected([])}
          actions={[
            { label:"Create Variations", icon:<Icon name="sparkle" size={13}/>, primary:true },
            { label:"Add to Collection", icon:<Icon name="layers" size={13}/> },
            { label:"Archive",           icon:<Icon name="inbox" size={13}/> },
            { label:"Delete",            icon:<Icon name="trash" size={13}/> },
          ]}/>
      )}
    </div>
  );
}

/* ─── B1.Pool ─────────────────────────────────────────────────────── */
function SubPool({ density, selected, setSelected }) {
  /* Toolbar — search, source platform, type, date filter chips
     Density toggle lives in the top segment row above. */
  const [filter, setFilter] = React.useState({ pinterest:false, type:false, date:false });
  const items = Array.from({length:18}).map((_,i)=>{
    const kinds=["boho","nursery","clipart","poster","abstract","christmas","landscape","sticker","riso"];
    const types=["Wall art","Clipart bundle","Bookmark","Sticker","Printable"];
    const platforms=["Etsy","Pinterest","Upload","Inbox"];
    const k=kinds[i%kinds.length];
    return {
      id:"p"+(i+1), kind:k,
      title: ({boho:"Boho line art",nursery:"Nursery animals",clipart:"Floral clipart",poster:"Type poster",abstract:"Riso abstract",christmas:"Holly print",landscape:"Mountain study",sticker:"Quote sticker",riso:"Sun riso"}[k])+" "+String(i+1).padStart(2,"0"),
      type: types[i%types.length],
      source: platforms[i%platforms.length],
      added: ["2h","5h","1d","2d","3d","6d"][i%6],
    };
  });
  const toggle=(id)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const cols = density==="dense" ? "grid-cols-6" : "grid-cols-4";

  return (
    <>
      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 border-b border-[var(--k-line)] bg-[var(--k-bg)]">
        <div className="relative flex-1 max-w-[420px]">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--k-ink-3)]"/>
          <input className="k-input !pl-9" placeholder="Search references by title, source, type…"/>
        </div>
        <div className="flex items-center gap-1.5">
          <Chip caret>Source</Chip>
          <Chip caret>Type</Chip>
          <Chip caret>Collection</Chip>
          <Chip caret>Date added</Chip>
        </div>
        <span className="ml-auto k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{items.length} of 142</span>
      </div>

      <div className={`flex-1 overflow-y-auto p-6 ${density==="dense"?"k-density-dense":"k-density-comfortable"}`}>
        <div className={`grid ${cols} gap-${density==="dense"?"3":"4"}`}>
          {items.map(it=>{
            const isSel=selected.includes(it.id);
            return (
              <div key={it.id} onClick={()=>toggle(it.id)}
                   className={`k-card overflow-hidden group ${isSel?"k-ring-selected":""}`} data-interactive="true">
                <div className="relative">
                  <div className="p-2 pb-0"><div className="k-thumb" data-kind={it.kind} data-aspect="square"/></div>
                  <div className="absolute top-3 left-3"><Checkbox checked={isSel} onChange={()=>toggle(it.id)}/></div>
                  <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="k-iconbtn !w-6 !h-6 !bg-white/95"><Icon name="eye" size={11}/></button>
                  </div>
                  {/* Hover CTA — single primary action per §B1.Pool */}
                  <div className="absolute left-2 right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="k-btn k-btn--primary w-full" data-size="sm">
                      <Icon name="sparkle" size={12}/>Create Variations
                    </button>
                  </div>
                </div>
                <div className={density==="dense"?"p-2.5":"p-3.5"}>
                  <div className="text-[13px] font-medium leading-tight truncate">{it.title}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge tone={it.source==="Etsy"?"warning":it.source==="Pinterest"?"danger":it.source==="Upload"?"info":"neutral"}>{it.source}</Badge>
                    <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">{it.type} · {it.added} ago</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ─── B1.Stories ──────────────────────────────────────────────────── */
function SubStories() {
  /* Sticky horizontal story-row (Instagram parity, mobile-feasible) +
     scrollable 3-col grid feed below. Story-row is flat — no glow,
     no decoration drift per §B1/Stories. */
  const shops = ["Mira & Oak","Lumen Print Co","Plumeleaf","Casa Verde","Sage Hollow","Indigo Atelier","Wren Studio","Folk & Field","Honey Bound","Northwell","Harbor & Hearth","Linen Hill"];
  const stories = Array.from({length:9}).map((_,i)=>{
    const k=["boho","nursery","clipart","poster","abstract","christmas","landscape","sticker","riso"][i%9];
    return { id:"s"+i, kind:k, shop: shops[i%shops.length], date: ["2h","5h","1d","1d","2d"][i%5],
             title: ({boho:"Botanical line set 03",nursery:"Bear nursery 12",clipart:"Floral pack 25",poster:"Affirmation poster",abstract:"Riso landscape",christmas:"Holiday wreath",landscape:"Mountain print",sticker:"Quote sticker pack",riso:"Sun riso 04"}[k]) };
  });
  return (
    <>
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--k-line)] bg-[var(--k-bg)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">New listings · last 24h</span>
          <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">12 shops active</span>
        </div>
        <div className="flex gap-3 overflow-x-auto -mx-6 px-6 pb-1">
          {shops.map((s,i)=>(
            <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[68px] cursor-pointer group">
              <div className="relative">
                <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-[var(--k-orange-bright)] to-[var(--k-orange-deep)]">
                  <div className="w-full h-full rounded-full bg-[var(--k-bg)] p-[2px]">
                    <div className="w-full h-full rounded-full" style={{background:`linear-gradient(135deg, ${["#E89B5B","#5E2819","#C9A87A","#1E3A2E","#8B6F4E","#E8D0B8","#C1582C","#F3DDC8"][i%8]} 0%, ${["#5E2819","#E89B5B","#1E3A2E","#C9A87A","#E8D0B8","#8B6F4E","#F3DDC8","#C1582C"][i%8]} 100%)`}}/>
                  </div>
                </div>
                {i<3 && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--k-orange)] border-2 border-[var(--k-bg)]"/>}
              </div>
              <span className="text-[10.5px] text-center leading-tight text-[var(--k-ink-2)] truncate w-full group-hover:text-[var(--k-ink)]">{s.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-4">
          {stories.map(s=>(
            <div key={s.id} className="k-card overflow-hidden" data-interactive="true">
              <div className="p-2 pb-0"><div className="k-thumb" data-kind={s.kind} data-aspect="square"/></div>
              <div className="p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#E89B5B] to-[#5E2819]"/>
                  <span className="text-[12.5px] font-medium truncate flex-1">{s.shop}</span>
                  <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">{s.date}</span>
                </div>
                <div className="text-[13px] leading-snug mb-3">{s.title}</div>
                <div className="flex items-center gap-1.5">
                  <button className="k-btn k-btn--ghost" data-size="sm"><Icon name="bookmark" size={11}/>Bookmark</button>
                  <button className="k-btn k-btn--ghost" data-size="sm"><Icon name="plus" size={11}/>Add to References</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── B1.Inbox ────────────────────────────────────────────────────── */
function SubInbox({ density }) {
  const rows = Array.from({length:14}).map((_,i)=>{
    const k=["boho","nursery","clipart","poster","abstract","sticker","riso"][i%7];
    return { id:"i"+i, kind:k, title:["Botanical line set","Affirmation pack","Bear nursery","Mountain study","Quote sticker bundle","Riso poster","Floral clipart"][i%7]+" "+String(i+1).padStart(2,"0"),
             source:["Pinterest","Etsy","Upload"][i%3], added:["2h","5h","1d","2d","3d","6d","8d","12d"][i%8] };
  });
  return (
    <div className={`flex-1 overflow-y-auto ${density==="dense"?"k-density-dense":"k-density-comfortable"}`}>
      <div className="px-6 py-4">
        <div className="k-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--k-bg-2)] border-b border-[var(--k-line)]">
              <tr>
                <th className="w-9 px-3 py-2.5"><Checkbox/></th>
                <th className="text-left k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] font-medium px-3 py-2.5 w-16"></th>
                <th className="text-left k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] font-medium px-3 py-2.5">Title</th>
                <th className="text-left k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] font-medium px-3 py-2.5 w-32">Source</th>
                <th className="text-left k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] font-medium px-3 py-2.5 w-28">Added</th>
                <th className="px-3 py-2.5 w-44"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} className="k-row border-b border-[var(--k-line-soft)] last:border-b-0 hover:bg-[var(--k-bg)] cursor-pointer">
                  <td className="px-3"><Checkbox/></td>
                  <td className="px-3"><div className="k-thumb !w-10 !aspect-square" data-kind={r.kind}/></td>
                  <td className="px-3"><div className="text-[13px] font-medium">{r.title}</div></td>
                  <td className="px-3"><Badge tone={r.source==="Etsy"?"warning":r.source==="Pinterest"?"danger":"info"}>{r.source}</Badge></td>
                  <td className="px-3"><span className="k-mono text-[12px] text-[var(--k-ink-2)] tracking-wider">{r.added} ago</span></td>
                  <td className="px-3 text-right">
                    <button className="k-btn k-btn--ghost" data-size="sm"><Icon name="arrow" size={11}/>Promote to Pool</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── B1.Shops ────────────────────────────────────────────────────── */
function SubShops() {
  const shops=[
    { name:"Mira & Oak",       reviews:"12,408", rank:"#3 in Wall Art",         thumbs:["boho","nursery","abstract"] },
    { name:"Lumen Print Co",   reviews:"8,221",  rank:"#7 in Printables",       thumbs:["poster","abstract","landscape"] },
    { name:"Plumeleaf",        reviews:"5,987",  rank:"#12 in Boho",            thumbs:["boho","nursery","clipart"] },
    { name:"Casa Verde",       reviews:"4,512",  rank:"#9 in Nursery",          thumbs:["nursery","clipart","sticker"] },
    { name:"Sage Hollow",      reviews:"3,840",  rank:"#15 in Wall Art",        thumbs:["abstract","boho","poster"] },
    { name:"Indigo Atelier",   reviews:"2,704",  rank:"#22 in Riso",            thumbs:["riso","abstract","poster"] },
    { name:"Folk & Field",     reviews:"1,985",  rank:"#28 in Bookmarks",       thumbs:["sticker","poster","clipart"] },
    { name:"Linen Hill",       reviews:"1,402",  rank:"#34 in Holiday",         thumbs:["christmas","nursery","boho"] },
  ];
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="grid grid-cols-2 gap-4">
        {shops.map((s,i)=>(
          <div key={i} className="k-card p-4" data-interactive="true">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--k-orange-bright)] to-[var(--k-orange-deep)] flex items-center justify-center text-white font-semibold text-[15px] flex-shrink-0">
                {s.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[14px] font-semibold truncate">{s.name}</div>
                  <Badge tone="warning">Etsy</Badge>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="k-mono text-[11px] text-[var(--k-ink-2)] tracking-wider tabular-nums">{s.reviews} reviews</span>
                  <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">{s.rank}</span>
                </div>
              </div>
              <Btn variant="ghost" size="sm" iconRight={<Icon name="arrow" size={11}/>}>Open analysis</Btn>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mr-2">Top 3</span>
              {s.thumbs.map((k,j)=><div key={j} className="flex-1"><div className="k-thumb !aspect-square" data-kind={k}/></div>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── B1.Collections ──────────────────────────────────────────────── */
function SubCollections() {
  const cols=[
    { name:"Christmas Q4",          count:34, updated:"2h ago",  thumbs:["christmas","nursery","poster"] },
    { name:"Boho line art",         count:62, updated:"5h ago",  thumbs:["boho","clipart","nursery"] },
    { name:"Riso posters",          count:18, updated:"1d ago",  thumbs:["riso","abstract","poster"] },
    { name:"Bookmark quotes",       count:24, updated:"2d ago",  thumbs:["sticker","clipart","poster"] },
    { name:"Mountain studies",      count:12, updated:"3d ago",  thumbs:["landscape","abstract","poster"] },
    { name:"Nursery animals",       count:28, updated:"1w ago",  thumbs:["nursery","clipart","sticker"] },
  ];
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="grid grid-cols-3 gap-4">
        {cols.map((c,i)=>(
          <div key={i} className="k-card overflow-hidden" data-interactive="true">
            <div className="p-2 pb-0">
              <div className="grid grid-cols-3 gap-1">
                {c.thumbs.map((k,j)=><div key={j} className="k-thumb !aspect-square" data-kind={k}/>)}
              </div>
            </div>
            <div className="p-4">
              <div className="text-[14px] font-semibold leading-tight">{c.name}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="k-mono text-[11px] text-[var(--k-ink-3)] tracking-wider tabular-nums">{c.count} refs · {c.updated}</span>
                <Btn variant="ghost" size="sm" iconRight={<Icon name="arrow" size={11}/>}>Open</Btn>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { B1References });
