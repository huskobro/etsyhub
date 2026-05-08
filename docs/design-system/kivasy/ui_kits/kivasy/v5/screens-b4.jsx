/* global React */
/* ═════════════════════════════════════════════════════════════════════
   B4 · Products index — table layout mirroring A2 Batches
   Per §B4: Sent state with Etsy badge + draft id; Failed state with
   retry ghost. Density toggle. Single primary CTA "+ New Product".
   ═════════════════════════════════════════════════════════════════════ */
function B4ProductsIndex() {
  const [density, setDensity] = React.useState("comfortable");

  const rows = [
    { id:"prd_01J9A", name:"Christmas Wall Art Set", type:"Wall art",      files:12, health:96, status:"Sent",         tone:"success",  draft:"etsy_draft_882104", updated:"2h ago",  thumbs:["christmas","nursery","poster","abstract"] },
    { id:"prd_01J9B", name:"Boho Clipart Bundle Q4", type:"Clipart",       files:25, health:92, status:"Etsy-bound",   tone:"info",     updated:"5h ago",  thumbs:["boho","clipart","sticker","poster"] },
    { id:"prd_01J9C", name:"Riso Poster Pack",       type:"Wall art",      files:8,  health:88, status:"Mockup ready", tone:"info",     updated:"1d ago",  thumbs:["riso","abstract","poster","landscape"] },
    { id:"prd_01J9D", name:"Bookmark Quotes Set",    type:"Bookmark",      files:5,  health:74, status:"Draft",        tone:"neutral",  updated:"2d ago",  thumbs:["sticker","clipart","poster","sticker"] },
    { id:"prd_01J9E", name:"Sticker Pack 25",        type:"Sticker",       files:25, health:69, status:"Failed",       tone:"danger",   updated:"3d ago",  thumbs:["sticker","clipart","sticker","poster"], failure:"Etsy API timeout · 3 retries" },
    { id:"prd_01J9F", name:"Mountain Studies Trio",  type:"Wall art",      files:3,  health:81, status:"Mockup ready", tone:"info",     updated:"4d ago",  thumbs:["landscape","abstract","poster","abstract"] },
    { id:"prd_01J9G", name:"Nursery Animals 6-pack", type:"Wall art",      files:6,  health:94, status:"Sent",         tone:"success",  draft:"etsy_draft_881997", updated:"6d ago",  thumbs:["nursery","clipart","sticker","nursery"] },
    { id:"prd_01J9H", name:"Holiday Printables",     type:"Printable",     files:14, health:79, status:"Draft",        tone:"neutral",  updated:"1w ago",  thumbs:["christmas","poster","clipart","christmas"] },
  ];

  return (
    <div className="flex flex-col h-screen min-w-0 flex-1">
      <Topbar title="Products" subtitle="24 PRODUCTS · 2 SENT THIS WEEK">
        <Btn variant="secondary" size="sm" icon={<Icon name="filter" size={13}/>}>Saved views</Btn>
        <Btn variant="primary" size="sm" icon={<Icon name="plus" size={13}/>}>+ New Product</Btn>
      </Topbar>

      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 border-b border-[var(--k-line)] bg-[var(--k-bg)]">
        <div className="relative flex-1 max-w-[420px]">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--k-ink-3)]"/>
          <input className="k-input !pl-9" placeholder="Search products by name, type, draft id…"/>
        </div>
        <div className="flex items-center gap-1.5">
          <Chip caret>Status</Chip>
          <Chip caret>Type</Chip>
          <Chip caret>Date</Chip>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mr-2">{rows.length} of 24</span>
          <Density value={density} onChange={setDensity}/>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-6 ${density==="dense"?"k-density-dense":"k-density-comfortable"}`}>
        <div className="k-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-[var(--k-bg-2)] border-b border-[var(--k-line)]">
              <tr>
                <th className="text-left k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] font-medium px-3 py-2.5 w-20"></th>
                <th className="text-left k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] font-medium px-3 py-2.5">Product</th>
                <th className="text-left k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] font-medium px-3 py-2.5 w-28">Type</th>
                <th className="text-left k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] font-medium px-3 py-2.5 w-20">Files</th>
                <th className="text-left k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] font-medium px-3 py-2.5 w-32">Listing health</th>
                <th className="text-left k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] font-medium px-3 py-2.5 w-44">Status</th>
                <th className="text-left k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] font-medium px-3 py-2.5 w-24">Updated</th>
                <th className="px-3 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} className="k-row border-b border-[var(--k-line-soft)] last:border-b-0 hover:bg-[var(--k-bg)] cursor-pointer group">
                  <td className="px-3">
                    <div className="grid grid-cols-2 gap-0.5 w-12">
                      {r.thumbs.map((k,j)=><div key={j} className="k-thumb !aspect-square !rounded-[3px]" data-kind={k}/>)}
                    </div>
                  </td>
                  <td className="px-3">
                    <div className="text-[13.5px] font-medium leading-tight">{r.name}</div>
                    <div className="mt-0.5 k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">{r.id}</div>
                  </td>
                  <td className="px-3">
                    <Badge tone="neutral">{r.type}</Badge>
                  </td>
                  <td className="px-3 k-mono text-[12.5px] text-[var(--k-ink)] tabular-nums tracking-wider">{r.files}</td>
                  <td className="px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-[var(--k-bg-2)] overflow-hidden">
                        <div className="h-full" style={{width:r.health+"%", background: r.health>=90?"var(--k-green)":r.health>=80?"var(--k-orange)":r.health>=70?"var(--k-amber)":"var(--k-red)"}}/>
                      </div>
                      <span className="k-mono text-[11px] text-[var(--k-ink-2)] tabular-nums">{r.health}</span>
                    </div>
                  </td>
                  <td className="px-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={r.tone} dot>{r.status}</Badge>
                      {r.draft && (
                        <a href="#" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#F6ECD6] hover:bg-[#EFE0BD] transition-colors" onClick={e=>e.stopPropagation()}>
                          <span className="k-mono text-[9.5px] font-semibold text-[#B47415] tracking-wider uppercase">Etsy</span>
                          <span className="k-mono text-[10px] text-[var(--k-amber)] tracking-wider underline-offset-2">{r.draft}</span>
                        </a>
                      )}
                      {r.failure && (
                        <button className="k-btn k-btn--ghost !text-[var(--k-red)] !h-6 !px-2" data-size="sm" onClick={e=>e.stopPropagation()}>
                          <Icon name="retry" size={10}/>Retry
                        </button>
                      )}
                    </div>
                    {r.failure && <div className="k-mono text-[10px] text-[var(--k-red)] tracking-wider mt-0.5">{r.failure}</div>}
                  </td>
                  <td className="px-3 k-mono text-[11px] text-[var(--k-ink-3)] tracking-wider">{r.updated}</td>
                  <td className="px-3 text-right">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="chevron" size={13} className="text-[var(--k-ink-3)]"/></div>
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

Object.assign(window, { B4ProductsIndex });
