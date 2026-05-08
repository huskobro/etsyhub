/* global React */

/* ═══════════════════════════════════════════════════════════════
   A1 · LIBRARY
   Per §3: Library is the only gallery. Bulk-select toolbar required.
   Density toggle required. Right-side detail slide-in panel.
   ═══════════════════════════════════════════════════════════════ */
function A1Library() {
  const [density, setDensity] = React.useState("comfortable");
  const [selected, setSelected] = React.useState(["a1","a3","a5"]);
  const [filter, setFilter] = React.useState({ kept: true, square: false, recent: false, batch: false });
  const [open, setOpen] = React.useState(true);

  const items = Array.from({length: 24}).map((_, i) => {
    const kinds = ["boho","nursery","clipart","poster","abstract","christmas","landscape","sticker","riso"];
    const k = kinds[i % kinds.length];
    return {
      id: `a${i+1}`, kind: k,
      title: ({boho:"Boho wreath", nursery:"Bear nursery", clipart:"Floral clipart", poster:"Type poster", abstract:"Riso abstract", christmas:"Holly print", landscape:"Mountain study", sticker:"Quote sticker", riso:"Sun riso"}[k]) + " " + String(i+1).padStart(2,"0"),
      ratio: i % 3 === 0 ? "Square" : i % 3 === 1 ? "Portrait" : "Landscape",
      kept: true,
      batch: ["01J7Z","01J7Y","01J7X"][i%3],
      added: ["2h","5h","1d","2d","3d"][i%5],
    };
  });

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);
  const cols = density === "dense" ? "grid-cols-6" : "grid-cols-4";
  const detailItem = items[2];

  return (
    <div className="flex flex-col h-screen min-w-0 flex-1 relative">
      <Topbar title="Library" subtitle="1,248 ASSETS · 86 KEPT THIS WEEK">
        <Btn variant="secondary" size="sm" icon={<Icon name="filter" size={13}/>}>Saved views</Btn>
        <Btn variant="primary" size="sm" icon={<Icon name="layers" size={13}/>}>New Selection</Btn>
      </Topbar>

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 border-b border-[var(--k-line)] bg-[var(--k-bg)]">
        <div className="relative flex-1 max-w-[420px]">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--k-ink-3)]"/>
          <input className="k-input !pl-9" placeholder="Search by title, batch id, prompt…"/>
        </div>
        <div className="flex items-center gap-1.5">
          <Chip active={filter.kept} caret>Kept</Chip>
          <Chip caret>Aspect ratio</Chip>
          <Chip caret>Type</Chip>
          <Chip caret>Source batch</Chip>
          <Chip caret>Date added</Chip>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mr-2">{items.length} items</span>
          <Density value={density} onChange={setDensity}/>
          <div className="w-px h-5 bg-[var(--k-line)] mx-1"/>
          <IconBtn icon={<Icon name="grid" size={14}/>}/>
          <IconBtn icon={<Icon name="list" size={14}/>}/>
        </div>
      </div>

      {/* Grid */}
      <div className={`flex-1 overflow-y-auto p-6 ${density === "dense" ? "k-density-dense" : "k-density-comfortable"}`} style={{paddingRight: open ? 480 : 24}}>
        <div className={`grid ${cols} gap-${density==="dense"?"3":"4"}`}>
          {items.map(it => {
            const isSel = selected.includes(it.id);
            return (
              <div key={it.id} onClick={()=>toggle(it.id)}
                   className={`k-card overflow-hidden ${isSel ? "k-ring-selected":""}`} data-interactive="true">
                <div className="relative">
                  <div className="p-2 pb-0"><div className="k-thumb" data-kind={it.kind}/></div>
                  <div className="absolute top-3 left-3"><Checkbox checked={isSel} onChange={()=>toggle(it.id)}/></div>
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <button className="k-iconbtn !w-6 !h-6 !bg-white/90"><Icon name="bookmark" size={11}/></button>
                  </div>
                </div>
                <div className={density==="dense" ? "p-2.5" : "p-3.5"}>
                  <div className="text-[13px] font-medium leading-tight truncate">{it.title}</div>
                  <div className="mt-1 k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">
                    {it.ratio} · batch_{it.batch} · {it.added} ago
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right detail panel */}
      {open && (
        <div className="k-detail">
          <div className="k-detail__header">
            <div className="flex-1 min-w-0">
              <div className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">Asset · {detailItem.id.toUpperCase()}</div>
              <h3 className="text-[15px] font-semibold mt-0.5 truncate">{detailItem.title}</h3>
            </div>
            <IconBtn icon={<Icon name="copy" size={13}/>}/>
            <IconBtn icon={<Icon name="more" size={14}/>}/>
            <button className="k-iconbtn" onClick={()=>setOpen(false)}><Icon name="x" size={14}/></button>
          </div>
          <div className="k-detail__body">
            <div className="k-thumb mb-4" data-kind={detailItem.kind} style={{aspectRatio:"1/1"}}/>
            <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-[13px]">
              <dt className="k-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--k-ink-3)] pt-0.5">Source batch</dt>
              <dd><a className="text-[var(--k-blue)] underline-offset-2 hover:underline" href="#">batch_{detailItem.batch}</a></dd>
              <dt className="k-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--k-ink-3)] pt-0.5">Reference</dt>
              <dd>Boho line art bundle <span className="k-mono text-[11px] text-[var(--k-ink-3)]">· ref_204</span></dd>
              <dt className="k-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--k-ink-3)] pt-0.5">Aspect</dt>
              <dd>{detailItem.ratio}</dd>
              <dt className="k-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--k-ink-3)] pt-0.5">Added</dt>
              <dd>5h ago · kept on review</dd>
              <dt className="k-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--k-ink-3)] pt-0.5">Used in</dt>
              <dd className="flex flex-wrap gap-1.5"><Badge tone="info">2 selections</Badge><Badge tone="purple">1 product</Badge></dd>
              <dt className="k-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--k-ink-3)] pt-0.5">Prompt</dt>
              <dd className="text-[12.5px] text-[var(--k-ink-2)] leading-snug">"floral wreath illustration, hand-drawn line art, neutral palette, isolated on warm beige, suitable for nursery print"</dd>
            </dl>
          </div>
          <div className="k-detail__footer">
            <Btn variant="primary" size="sm" icon={<Icon name="layers" size={12}/>}>Add to Selection</Btn>
            <Btn variant="secondary" size="sm" icon={<Icon name="sparkle" size={12}/>}>Variations</Btn>
            <div className="ml-auto"><Btn variant="ghost" size="sm" icon={<Icon name="trash" size={12}/>}>Remove</Btn></div>
          </div>
        </div>
      )}

      {selected.length >= 2 && (
        <FloatingBulk
          count={selected.length}
          actions={[
            { icon: <Icon name="layers" size={13}/>, label: "Add to Selection", primary: true },
            { icon: <Icon name="sparkle" size={13}/>, label: "Variations" },
            { icon: <Icon name="download" size={13}/>, label: "Export" },
            { icon: <Icon name="trash" size={13}/>, label: "Remove" },
          ]}
          onClear={()=>setSelected([])}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   A2 · BATCHES INDEX
   ═══════════════════════════════════════════════════════════════ */
function A2BatchesIndex() {
  const [density, setDensity] = React.useState("comfortable");
  const rows = [
    { id: "01J7Z", name: "Boho clipart Q4",   ref:"Boho line art bundle",     type:"Variation",     prog:[7,12], status:"Running",    tone:"warning", started:"2m",  cost:"$0.42" },
    { id: "01J7Y", name: "Christmas wall art",ref:"Holiday print study",      type:"Variation",     prog:[8,8],  status:"Succeeded",  tone:"success", started:"14m", cost:"$0.28" },
    { id: "01J7X", name: "Sticker pack 25",   ref:"Quote sticker pack",       type:"Retry-failed", prog:[2,2],  status:"Succeeded",  tone:"success", started:"1h",  cost:"$0.07" },
    { id: "01J7W", name: "Bookmark set",      ref:"Bookmark inspiration",     type:"Variation",     prog:[3,6],  status:"Failed",     tone:"danger",  started:"3h",  cost:"$0.18" },
    { id: "01J7V", name: "Nursery animals",   ref:"Animal nursery prints",    type:"Variation",     prog:[10,10],status:"Succeeded",  tone:"success", started:"1d",  cost:"$0.35" },
    { id: "01J7U", name: "Riso posters",      ref:"Risograph poster archive", type:"Variation",     prog:[4,4],  status:"Succeeded",  tone:"success", started:"2d",  cost:"$0.14" },
    { id: "01J7T", name: "Mountain studies",  ref:"Mountain print study",     type:"Variation",     prog:[6,6],  status:"Succeeded",  tone:"success", started:"3d",  cost:"$0.22" },
    { id: "01J7S", name: "Boho wreath",       ref:"Boho line art bundle",     type:"Variation",     prog:[12,12],status:"Succeeded",  tone:"success", started:"5d",  cost:"$0.42" },
  ];
  return (
    <div className="flex flex-col h-screen min-w-0 flex-1">
      <Topbar title="Batches" subtitle="3 RUNNING · 18 LAST 7D">
        <Btn variant="secondary" size="sm" icon={<Icon name="retry" size={13}/>}>Retry-failed-only</Btn>
        <Btn variant="primary" size="sm" icon={<Icon name="plus" size={13}/>}>Start Batch</Btn>
      </Topbar>
      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 border-b border-[var(--k-line)] bg-[var(--k-bg)]">
        <div className="relative flex-1 max-w-[360px]">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--k-ink-3)]"/>
          <input className="k-input !pl-9" placeholder="Search batches…"/>
        </div>
        <Chip caret>Status</Chip>
        <Chip caret>Type</Chip>
        <Chip caret>Reference</Chip>
        <Chip caret>Date</Chip>
        <div className="ml-auto flex items-center gap-2">
          <Density value={density} onChange={setDensity}/>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className={`k-card overflow-hidden ${density==="dense"?"k-density-dense":"k-density-comfortable"}`}>
          <table className="w-full">
            <thead>
              <tr>
                {[["w-9",""],["",""], ["","Batch"],["w-32","Source"], ["w-28","Type"], ["w-32","Progress"], ["w-28","Status"], ["w-20","Cost"], ["w-20","Started"], ["w-12",""]].map(([c,h],i)=>(
                  <th key={i} className={`${c} text-left px-3 py-2.5 k-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--k-ink-3)] border-b border-[var(--k-line)] bg-[var(--k-bg-2)]`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i) => (
                <tr key={r.id} className="border-b border-[var(--k-line-soft)] last:border-b-0 hover:bg-[var(--k-bg-2)]/40 cursor-pointer">
                  <td className="px-3 align-middle k-row"><Checkbox/></td>
                  <td className="px-2 align-middle k-row"><div className="w-8 h-8 rounded k-thumb" data-kind={["boho","christmas","poster","abstract","nursery","riso","landscape","boho"][i]} style={{aspectRatio:"1/1"}}/></td>
                  <td className="px-3 align-middle k-row">
                    <a className="text-[13.5px] font-medium hover:text-[var(--k-orange)]" href="#a3">{r.name}</a>
                    <div className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider mt-0.5">batch_{r.id} · {r.ref}</div>
                  </td>
                  <td className="px-3 align-middle k-row text-[12.5px] text-[var(--k-ink-2)]">{r.ref.split(" ").slice(0,2).join(" ")}</td>
                  <td className="px-3 align-middle k-row text-[12.5px]">{r.type}</td>
                  <td className="px-3 align-middle k-row">
                    <div className="flex items-center gap-2">
                      <div className="k-progress flex-1"><div className="k-progress__bar" style={{right: `${(1-r.prog[0]/r.prog[1])*100}%`}}/></div>
                      <span className="k-mono text-[11px] tabular-nums text-[var(--k-ink-3)] w-9 text-right">{r.prog[0]}/{r.prog[1]}</span>
                    </div>
                  </td>
                  <td className="px-3 align-middle k-row"><Badge tone={r.tone} dot>{r.status}</Badge></td>
                  <td className="px-3 align-middle k-row k-mono text-[12px] tabular-nums text-[var(--k-ink-2)]">{r.cost}</td>
                  <td className="px-3 align-middle k-row k-mono text-[12px] tabular-nums text-[var(--k-ink-3)]">{r.started} ago</td>
                  <td className="px-3 align-middle k-row text-right"><Icon name="chevron" size={13} className="text-[var(--k-ink-3)]"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { A1Library, A2BatchesIndex });
