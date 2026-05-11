/* global React */

/* ═══════════════════════════════════════════════════════════════
   A3 · BATCH DETAIL — Items tab with bulk-select state
   ═══════════════════════════════════════════════════════════════ */
function A3BatchDetail() {
  const [tab, setTab] = React.useState("items");
  const [selected, setSelected] = React.useState(["i1","i3","i7"]);
  const items = Array.from({length: 12}).map((_, i) => ({
    id: `i${i+1}`,
    kind: ["boho","boho","poster","clipart","abstract","boho","poster","clipart","abstract","boho","nursery","poster"][i],
    title: `Variation ${String(i+1).padStart(2,"0")}`,
    status: i === 4 ? "Failed" : "Succeeded",
    tone: i === 4 ? "danger" : "success",
    seed: `seed_${(982134 + i*97).toString(36).slice(-6)}`,
  }));
  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);

  return (
    <div className="flex flex-col h-screen min-w-0 flex-1">
      <Topbar back={{to:"batches"}} title="Boho clipart Q4" subtitle="BATCH_01J7Z · STARTED 2M AGO" status={{tone:"warning", label:"Running"}}>
        <Btn variant="secondary" size="sm" icon={<Icon name="retry" size={13}/>}>Retry-failed-only</Btn>
        <Btn variant="primary" size="sm" icon={<Icon name="check" size={13}/>}>Send to Review</Btn>
      </Topbar>

      {/* Header summary strip */}
      <div className="flex-shrink-0 grid grid-cols-5 gap-4 px-6 py-4 border-b border-[var(--k-line)] bg-[var(--k-bg)]">
        <div>
          <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">Reference</div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-7 h-7 rounded k-thumb" data-kind="boho" style={{aspectRatio:"1/1"}}/>
            <span className="text-[13px] font-medium">Boho line art bundle</span>
          </div>
        </div>
        <div>
          <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">Type</div>
          <div className="text-[13.5px] font-medium mt-2">Variation · 12 requested</div>
        </div>
        <div>
          <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">Progress</div>
          <div className="flex items-center gap-2 mt-2">
            <div className="k-progress flex-1"><div className="k-progress__bar" style={{right:"42%"}}/></div>
            <span className="k-mono text-[11px] tabular-nums">7/12</span>
          </div>
        </div>
        <div>
          <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">ETA</div>
          <div className="text-[13.5px] font-medium mt-2">~3m · $0.42 spent</div>
        </div>
        <div>
          <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">Operator</div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#E89B5B] to-[#8E3A12] k-mono text-[8px] font-semibold text-white flex items-center justify-center">HB</div>
            <span className="text-[13px]">Husko Bro</span>
          </div>
        </div>
      </div>

      <Tabs
        tabs={[
          { id:"items",  label:"Items",  count:12 },
          { id:"params", label:"Parameters" },
          { id:"logs",   label:"Logs", count:148 },
          { id:"costs",  label:"Costs" },
        ]}
        active={tab} onChange={setTab}/>

      {/* Items tab body */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--k-line-soft)] bg-[var(--k-bg)]">
        <Chip caret>Status</Chip>
        <Chip caret>Aspect</Chip>
        <Chip caret>Kept</Chip>
        <div className="ml-auto flex items-center gap-2">
          <span className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{items.length} items</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-6 gap-3">
          {items.map(it => {
            const isSel = selected.includes(it.id);
            return (
              <div key={it.id} onClick={()=>toggle(it.id)}
                   className={`k-card overflow-hidden ${isSel ? "k-ring-selected":""}`} data-interactive="true">
                <div className="relative">
                  <div className="p-2 pb-0"><div className="k-thumb" data-kind={it.kind} style={{aspectRatio:"1/1"}}/></div>
                  <div className="absolute top-3 left-3"><Checkbox checked={isSel} onChange={()=>toggle(it.id)}/></div>
                  <div className="absolute top-3 right-3"><Badge tone={it.tone} dot>{it.status === "Failed" ? "Fail" : "OK"}</Badge></div>
                </div>
                <div className="p-2.5">
                  <div className="text-[12.5px] font-medium leading-tight truncate">{it.title}</div>
                  <div className="mt-0.5 k-mono text-[10px] text-[var(--k-ink-3)] tracking-wider truncate">{it.seed}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selected.length >= 2 && (
        <FloatingBulk
          count={selected.length}
          actions={[
            { icon: <Icon name="check" size={13}/>, label: "Send to Review", primary: true },
            { icon: <Icon name="retry" size={13}/>, label: "Re-roll" },
            { icon: <Icon name="layers" size={13}/>, label: "Add to Selection" },
            { icon: <Icon name="trash" size={13}/>, label: "Discard" },
          ]}
          onClear={()=>setSelected([])}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   A4 · BATCH REVIEW — keyboard-first workspace
   200+ item virtualized state, shortcut hints
   ═══════════════════════════════════════════════════════════════ */
function A4BatchReview() {
  const [cursor, setCursor] = React.useState(47);
  const total = 248;
  const decided = 46;
  const kept = 31;

  // Filmstrip — render a window of ~9 items
  const strip = Array.from({length: 9}).map((_, i) => {
    const idx = cursor - 4 + i;
    const kinds = ["boho","poster","abstract","clipart","nursery","poster","christmas","riso","landscape"];
    return { idx, kind: kinds[(idx + 9) % kinds.length], decided: idx < decided };
  });

  return (
    <div className="flex flex-col h-screen min-w-0 flex-1 bg-[#1A1815]" style={{color:"#E8E5DD"}}>
      {/* Workspace bar */}
      <div className="flex-shrink-0 flex items-center gap-3 h-14 px-5 border-b border-white/5 bg-[#16130F]">
        <a href="#a3" className="flex items-center gap-2 text-[13px] text-white/60 hover:text-white">
          <Icon name="arrowL" size={14}/> Boho clipart Q4
        </a>
        <span className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-white/40">Review workspace</span>
        <div className="flex-1 flex justify-center items-center gap-3">
          <span className="k-mono text-[11px] text-white/50">Item</span>
          <span className="k-display text-[18px] font-semibold tabular-nums tracking-tight">{cursor+1}<span className="text-white/40 font-normal"> / {total}</span></span>
          <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-[var(--k-orange)]" style={{width: `${(decided/total)*100}%`}}/>
          </div>
          <span className="k-mono text-[11px] text-white/50 tabular-nums">{decided} decided · {kept} kept</span>
        </div>
        <button className="flex items-center gap-2 h-8 px-3 rounded-md text-[12.5px] text-white/70 hover:text-white hover:bg-white/5 border border-white/10">
          <Icon name="x" size={13}/> Exit
        </button>
      </div>

      {/* Main canvas */}
      <div className="flex-1 grid grid-cols-[1fr_360px] min-h-0">
        {/* Image stage */}
        <div className="flex flex-col min-h-0">
          <div className="flex-1 min-h-0 flex items-center justify-center p-10 relative">
            <div className="relative w-full h-full max-w-[760px] max-h-full mx-auto">
              <div className="k-thumb w-full h-full" data-kind="abstract" style={{aspectRatio:"1/1", borderRadius: 12, boxShadow:"0 24px 60px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)"}}/>
              {/* Prev/next */}
              <button onClick={()=>setCursor(c=>Math.max(0,c-1))} className="absolute left-[-56px] top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center"><Icon name="arrowL" size={16}/></button>
              <button onClick={()=>setCursor(c=>Math.min(total-1,c+1))} className="absolute right-[-56px] top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center"><Icon name="arrow" size={16}/></button>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex-shrink-0 px-10 pb-5">
            <div className="grid grid-cols-4 gap-3 max-w-[760px] mx-auto">
              <button className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2">
                  <Icon name="x" size={15} className="text-white/70"/>
                  <span className="text-[13px] font-medium">Discard</span>
                </div>
                <Kbd>D</Kbd>
              </button>
              <button className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl border-2 border-[var(--k-orange)] bg-[var(--k-orange)]/15 hover:bg-[var(--k-orange)]/25 transition-colors">
                <div className="flex items-center gap-2">
                  <Icon name="check" size={15} className="text-[var(--k-orange-bright)]"/>
                  <span className="text-[13px] font-semibold text-white">Keep</span>
                </div>
                <Kbd>K</Kbd>
              </button>
              <button className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2">
                  <Icon name="retry" size={15} className="text-white/70"/>
                  <span className="text-[13px] font-medium">Re-roll</span>
                </div>
                <Kbd>R</Kbd>
              </button>
              <button className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-2">
                  <Icon name="layers" size={15} className="text-white/70"/>
                  <span className="text-[13px] font-medium">Add to Selection</span>
                </div>
                <Kbd>S</Kbd>
              </button>
            </div>
          </div>

          {/* Filmstrip */}
          <div className="flex-shrink-0 border-t border-white/5 bg-black/30 px-5 py-3">
            <div className="flex items-center gap-2 overflow-hidden">
              {strip.map((s, i) => (
                <button key={s.idx} onClick={()=>setCursor(s.idx)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-all ${s.idx === cursor ? "border-[var(--k-orange)] scale-105" : "border-transparent opacity-50 hover:opacity-90"}`}
                  style={{boxShadow: s.idx === cursor ? "0 8px 16px rgba(232,93,37,0.35)" : "none"}}>
                  <div className="k-thumb w-full h-full" data-kind={s.kind} style={{aspectRatio:"1/1"}}/>
                  {s.decided && <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-[var(--k-green)] border border-black/30"/>}
                  <div className="absolute bottom-0.5 left-1 k-mono text-[9px] text-white/80">{s.idx+1}</div>
                </button>
              ))}
              <div className="flex-1"/>
              <span className="k-mono text-[10.5px] text-white/40 tracking-[0.14em] uppercase whitespace-nowrap">virtualized · {total} items</span>
            </div>
          </div>
        </div>

        {/* Info rail */}
        <aside className="border-l border-white/5 bg-[#1F1C18] flex flex-col min-h-0">
          <div className="p-5 border-b border-white/5">
            <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Item</div>
            <div className="mt-1 flex items-center gap-2">
              <h3 className="text-[15px] font-semibold">Variation {String(cursor+1).padStart(2,"0")}</h3>
              <Badge tone="warning">Pending</Badge>
            </div>
            <div className="k-mono text-[10.5px] text-white/40 mt-1">seed_a8t2c4 · square · 4096px</div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Reference</div>
              <div className="mt-2 flex items-center gap-2.5 p-2 rounded-md bg-white/5">
                <div className="w-9 h-9 rounded k-thumb" data-kind="boho" style={{aspectRatio:"1/1"}}/>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">Boho line art bundle</div>
                  <div className="k-mono text-[10px] text-white/40">ref_204 · sref +0.6</div>
                </div>
                <Icon name="link" size={13} className="text-white/40"/>
              </div>
            </div>
            <div>
              <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Prompt</div>
              <div className="mt-2 text-[12px] leading-relaxed text-white/75">"floral wreath illustration, hand-drawn line art, neutral palette, isolated on warm beige, suitable for nursery print"</div>
            </div>
            <div>
              <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-white/40">Diffs from sibling</div>
              <ul className="mt-2 space-y-1.5 text-[12px] text-white/70">
                <li className="flex gap-2"><span className="text-white/40">·</span>Tighter wreath composition</li>
                <li className="flex gap-2"><span className="text-white/40">·</span>Warmer cream background</li>
                <li className="flex gap-2"><span className="text-white/40">·</span>Single isolated subject (no border)</li>
              </ul>
            </div>
          </div>

          {/* Shortcut hints */}
          <div className="flex-shrink-0 p-4 border-t border-white/5 bg-black/20">
            <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-white/40 mb-3">Shortcuts</div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11.5px]">
              {[
                ["←  →","Prev / Next"],
                ["K","Keep"],
                ["D","Discard"],
                ["R","Re-roll"],
                ["S","Add to Selection"],
                ["Z","Undo"],
                ["Space","Zoom 1:1"],
                ["?","All shortcuts"],
              ].map(([k,l],i)=>(
                <div key={i} className="flex items-center gap-2">
                  <span className="k-mono text-[11px] px-1.5 py-0.5 rounded bg-white/8 border border-white/10 text-white/80 min-w-[28px] text-center">{k}</span>
                  <span className="text-white/60">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { A3BatchDetail, A4BatchReview });
