/* ═════════════════════════════════════════════════════════════════
   C3 · Overview — operator's morning landing. Per §C3, four blocks:
   Pipeline pulse · Pending actions · Active batches · Recent activity.
   No greeting copy; date/time mono caption in topbar subtitle.
   Pulse strip stays dense (≤28px), tabular numerals; no display
   inflation. Pending actions sub-section shows "all caught up" empty.
   ═════════════════════════════════════════════════════════════════ */
function C3Overview() {
  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <Topbar title="Overview" subtitle="WED · MAR 27 · 09:42 IST"/>
      <div className="flex-1 overflow-y-auto px-7 pb-12 pt-5 space-y-5">
        <PipelinePulse/>
        <div className="grid gap-5" style={{gridTemplateColumns:"2fr 1fr"}}>
          <PendingActions/>
          <ActiveBatches/>
        </div>
        <RecentActivity/>
      </div>
    </main>
  );
}

/* ─── Block 1 · Pipeline pulse ─────────────────────────────────── */
function PipelinePulse() {
  /* Six stages, color-tinted left-edge bar — orange upstream, purple
     midstream, blue downstream — operator pre-cognitively reads
     pipeline density via color. Display kept dense per §C3. */
  const stages = [
    { label:"REFERENCES", count:"142",   sub:"38 new · this week",      tint:"var(--k-orange)", tintSoft:"var(--k-orange-soft)",  to:"#references" },
    { label:"BATCHES",    count:"3",     sub:"1 running · 2 queued",    tint:"var(--k-orange)", tintSoft:"var(--k-orange-soft)",  to:"#batches",   pulse:true },
    { label:"LIBRARY",    count:"1,248", sub:"86 kept · since Mon",     tint:"var(--k-purple)", tintSoft:"var(--k-purple-soft)",  to:"#library" },
    { label:"SELECTIONS", count:"12",    sub:"4 mockup-ready",          tint:"var(--k-purple)", tintSoft:"var(--k-purple-soft)",  to:"#selections" },
    { label:"PRODUCTS",   count:"24",    sub:"2 ready to send",         tint:"var(--k-blue)",   tintSoft:"var(--k-blue-soft)",    to:"#products" },
    { label:"ETSY DRAFT", count:"14",    sub:"sent · this week",        tint:"var(--k-blue)",   tintSoft:"var(--k-blue-soft)",    to:"#products?status=sent" },
  ];
  return (
    <section className="k-card k-card--hero p-0 overflow-hidden">
      <div className="grid" style={{gridTemplateColumns:"repeat(6, 1fr)"}}>
        {stages.map((s,i) => (
          <a key={s.label} href={s.to}
            className="relative px-4 py-4 group hover:bg-[var(--k-bg-2)] transition-colors"
            style={{borderRight: i<stages.length-1 ? "1px solid var(--k-line-soft)" : "none", textDecoration:"none", color:"inherit"}}>
            {/* color tint left-edge bar */}
            <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r" style={{background: s.tint}}/>
            <div className="flex items-center gap-1.5">
              <span className="k-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{s.label}</span>
              {s.pulse && <span style={{position:"relative",width:5,height:5}}>
                <span style={{position:"absolute",inset:0,borderRadius:999,background:"var(--k-amber)"}}/>
                <span style={{position:"absolute",inset:-2,borderRadius:999,background:"var(--k-amber)",opacity:0.35,animation:"k-ping 1.6s infinite ease-out"}}/>
              </span>}
            </div>
            <div className="k-display text-[26px] font-semibold leading-none tracking-[-0.02em] mt-2 tabular-nums">{s.count}</div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-[11.5px] text-[var(--k-ink-2)] truncate">{s.sub}</span>
              <Icon name="arrow" size={11} className="text-[var(--k-ink-4)] ml-auto opacity-0 group-hover:opacity-100 transition-opacity"/>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ─── Block 2 · Pending actions ───────────────────────────────── */
function PendingActions() {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[15.5px] font-semibold tracking-tight">Pending actions</h2>
        <span className="k-mono text-[10.5px] tracking-[0.14em] uppercase text-[var(--k-ink-3)]">11 ITEMS WAITING</span>
      </div>

      <PendingSection title="Needs review" total={6} cta="primary" actionLabel="Open Review" actionIcon="eye"
        rows={[
          { thumb:"christmas", name:"Christmas Q4 Wall Art", meta:"32 of 48 reviewed" },
          { thumb:"boho",      name:"Boho Clipart Bundle",   meta:"12 of 25 reviewed" },
          { thumb:"poster",    name:"Riso Poster Pack",      meta:"4 of 8 reviewed" },
        ]}/>

      <PendingSection title="Mockup ready" total={4} cta="primary" actionLabel="Apply Mockups" actionIcon="image"
        rows={[
          { thumb:"nursery",   name:"Nursery 3-print Set",       meta:"6 designs" },
          { thumb:"abstract",  name:"Mountain Studies",          meta:"4 designs" },
        ]}/>

      <PendingSection title="Drafts to send" total={1} cta="publish" actionLabel="Send to Etsy as Draft" actionIcon="send"
        rows={[
          { thumb:"landscape", name:"Riso Poster Pack · Listing v3", meta:"Listing health · 92", badge:{tone:"success",label:"READY"} },
        ]}/>

      {/* Per §7.9 — at least one "all caught up" empty state on record */}
      <PendingEmpty title="Failed batches" line="All caught up · 0 items waiting"/>
    </section>
  );
}

function PendingSection({ title, total, rows, cta, actionLabel, actionIcon }) {
  const visible = rows.slice(0,4);
  return (
    <div className="k-card p-0 overflow-hidden">
      <div className="px-4 py-2.5 flex items-baseline gap-2 border-b border-[var(--k-line-soft)]">
        <h3 className="text-[12.5px] font-semibold tracking-tight">{title}</h3>
        <span className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{total}</span>
      </div>
      <div className="divide-y divide-[var(--k-line-soft)]">
        {visible.map((r,i)=>(
          <div key={i} className="px-4 py-3 flex items-center gap-3">
            <div className="k-thumb w-9 h-9 flex-shrink-0" data-kind={r.thumb} style={{aspectRatio:"1/1"}}/>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium truncate">{r.name}</div>
              <div className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider mt-0.5 tabular-nums">{r.meta}</div>
            </div>
            {r.badge && <Badge tone={r.badge.tone} dot>{r.badge.label}</Badge>}
            <Btn variant={cta} size="sm" icon={<Icon name={actionIcon} size={11}/>}>{actionLabel}</Btn>
          </div>
        ))}
      </div>
      {total > visible.length && (
        <div className="px-4 py-2 border-t border-[var(--k-line-soft)] flex justify-end">
          <Btn variant="ghost" size="sm" iconRight={<Icon name="arrow" size={11}/>}>View all ({total})</Btn>
        </div>
      )}
    </div>
  );
}

function PendingEmpty({ title, line }) {
  return (
    <div className="k-card px-4 py-3 flex items-baseline gap-2">
      <h3 className="text-[12.5px] font-semibold tracking-tight">{title}</h3>
      <span className="text-[12px] text-[var(--k-ink-3)] ml-auto">{line}</span>
    </div>
  );
}

/* ─── Block 3 · Active batches ─────────────────────────────────── */
function ActiveBatches() {
  const active = [
    { name:"Christmas Q4 Wall Art", id:"batch_01J7Y", done:32, total:48, eta:"~3m" },
    { name:"Boho Clipart Bundle",   id:"batch_01J7Z", done:12, total:25, eta:"~7m" },
    { name:"Riso Poster Pack",      id:"batch_01J7U", done:0,  total:8,  eta:"queued" },
  ];
  return (
    <section className="k-card p-0 overflow-hidden">
      <div className="px-4 py-2.5 flex items-baseline gap-2 border-b border-[var(--k-line-soft)]">
        <h3 className="text-[12.5px] font-semibold tracking-tight">Active batches</h3>
        <span className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{active.length} RUNNING</span>
      </div>
      <div className="divide-y divide-[var(--k-line-soft)]">
        {active.map((b,i)=>(
          <a key={i} href={`#batch:${b.id}`} className="px-4 py-3 block hover:bg-[var(--k-bg-2)] transition-colors" style={{textDecoration:"none",color:"inherit"}}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <div className="text-[13px] font-medium truncate">{b.name}</div>
              <div className="k-mono text-[10px] text-[var(--k-ink-3)] tracking-wider tabular-nums ml-auto">{b.eta}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="k-progress flex-1"><div className="k-progress__bar" style={{width:`${(b.done/b.total)*100}%`}}/></div>
              <span className="k-mono text-[10.5px] text-[var(--k-ink-2)] tabular-nums tracking-wider">{b.done} / {b.total}</span>
            </div>
            <div className="k-mono text-[10px] text-[var(--k-ink-3)] tracking-wider mt-1.5">{b.id}</div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ─── Block 4 · Recent activity ────────────────────────────────── */
function RecentActivity() {
  const events = [
    { t:"09:38",  ev:"Batch succeeded",        meta:"Christmas Q4 · 48 items kept",           tone:"success", to:"#batch:01J7Y" },
    { t:"09:21",  ev:"Selection created",       meta:"Nursery 3-print Set · 6 designs",        tone:"purple",  to:"#sel-03" },
    { t:"08:54",  ev:"Etsy draft sent",         meta:"Riso Poster Pack · 8 designs",            tone:"info",    to:"#prod-04" },
    { t:"08:12",  ev:"Library kept · 24 items", meta:"Boho Clipart Bundle · review #2",         tone:"neutral", to:"#library" },
    { t:"yest.",  ev:"Batch failed · retried",  meta:"Mountain Studies · stage 3 of 4",         tone:"warning", to:"#batch:01J7S" },
    { t:"yest.",  ev:"Mockups applied",         meta:"Christmas Wall Art Set · 12 designs",     tone:"purple",  to:"#sel-01" },
    { t:"yest.",  ev:"Reference promoted",      meta:"Inbox → Pool · 4 references",             tone:"neutral", to:"#references" },
    { t:"2d ago", ev:"Etsy draft sent",         meta:"Boho Clipart Bundle · 25 designs",        tone:"info",    to:"#prod-02" },
  ];
  const toneLabel = (t) => ({success:"SUCCESS",warning:"WARNING",info:"PUBLISH",purple:"EDIT",neutral:"·"})[t] || "·";
  return (
    <section className="k-card p-0 overflow-hidden">
      <div className="px-4 py-2.5 flex items-baseline gap-2 border-b border-[var(--k-line-soft)]">
        <h3 className="text-[12.5px] font-semibold tracking-tight">Recent activity</h3>
        <span className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">CROSS-SURFACE LOG</span>
      </div>
      <div className="divide-y divide-[var(--k-line-soft)]">
        {events.map((e,i)=>(
          <a key={i} href={e.to} className="px-4 py-2.5 grid items-center gap-3 hover:bg-[var(--k-bg-2)] transition-colors"
             style={{textDecoration:"none",color:"inherit",gridTemplateColumns:"60px 1fr 1fr 90px 24px"}}>
            <span className="k-mono text-[11px] text-[var(--k-ink-3)] tracking-wider tabular-nums">{e.t}</span>
            <span className="text-[13px] font-medium truncate">{e.ev}</span>
            <span className="text-[12px] text-[var(--k-ink-2)] truncate">{e.meta}</span>
            <Badge tone={e.tone === "neutral" ? "neutral" : e.tone}>{toneLabel(e.tone)}</Badge>
            <Icon name="arrow" size={11} className="text-[var(--k-ink-4)]"/>
          </a>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-[var(--k-line-soft)] flex justify-end">
        <Btn variant="ghost" size="sm" iconRight={<Icon name="arrow" size={11}/>}>View full activity (Settings → Audit)</Btn>
      </div>
    </section>
  );
}

Object.assign(window, { C3Overview });
