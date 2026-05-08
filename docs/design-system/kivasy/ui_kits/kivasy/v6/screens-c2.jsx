/* ═════════════════════════════════════════════════════════════════
   C2 · Settings — macOS Preferences detail-list (per §C2). Single
   surface, two columns: left rail of panes + active pane content.
   Three group labels (PREFERENCES / CONNECTIONS / GOVERNANCE).
   GOVERNANCE shown with admin badge (admin variant per §7.5).
   Two pane states demonstrated: General + Etsy connection.
   ═════════════════════════════════════════════════════════════════ */
function C2Settings({ initialPane = "general" }) {
  const [pane, setPane] = React.useState(initialPane);

  const groups = [
    { label:"PREFERENCES", admin:false, items:[
      { id:"general",       name:"General",       icon:"settings", live:true  },
      { id:"workspace",     name:"Workspace",     icon:"layers",   live:false },
      { id:"editor",        name:"Editor",        icon:"image",    live:false },
      { id:"notifications", name:"Notifications", icon:"bell",     live:false },
    ]},
    { label:"CONNECTIONS", admin:false, items:[
      { id:"etsy",      name:"Etsy",         icon:"link",    live:true,  meta:"Connected" },
      { id:"providers", name:"AI Providers", icon:"sparkle", live:false },
      { id:"storage",   name:"Storage",      icon:"package", live:false },
      { id:"scrapers",  name:"Scrapers",     icon:"download",live:false },
    ]},
    { label:"GOVERNANCE", admin:true, items:[
      { id:"users",    name:"Users",         icon:"user",     live:false },
      { id:"audit",    name:"Audit",         icon:"list",     live:false },
      { id:"flags",    name:"Feature Flags", icon:"zap",      live:false },
      { id:"theme",    name:"Theme",         icon:"book",     live:false },
    ]},
  ];

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <Topbar title="Settings" subtitle="WED · MAR 27 · 09:42 IST"/>
      <div className="flex-1 grid overflow-hidden" style={{gridTemplateColumns:"260px 1fr"}}>
        {/* LEFT RAIL */}
        <aside className="overflow-y-auto border-r border-[var(--k-line)] bg-[var(--k-bg)] py-4">
          {groups.map(g => (
            <div key={g.label} className="mb-3">
              <div className="px-5 mt-2 mb-1.5 flex items-center gap-2">
                <span className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{g.label}</span>
                {g.admin && <span className="k-badge !h-[16px] !text-[9.5px]" data-tone="warning">ADMIN</span>}
                <span className="flex-1 h-px bg-[var(--k-line)] ml-1"/>
              </div>
              <div className="space-y-0.5 px-2">
                {g.items.map(it => {
                  const active = pane === it.id;
                  return (
                    <button key={it.id} onClick={()=>setPane(it.id)}
                      className={`w-full text-left flex items-center gap-2.5 h-8 px-3 rounded-md transition-colors ${active?"bg-[var(--k-paper)] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_1px_rgba(22,19,15,0.04),0_1px_3px_rgba(22,19,15,0.05)]":"hover:bg-[rgba(22,19,15,0.035)]"}`}
                      style={active?{boxShadow:"inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 1px rgba(22,19,15,0.04), 0 1px 3px rgba(22,19,15,0.05), 0 0 0 1px rgba(22,19,15,0.04)"}:{}}>
                      <span style={{color: active?"var(--k-orange)":"var(--k-ink-3)"}}><Icon name={it.icon} size={13}/></span>
                      <span className={`text-[13px] flex-1 ${active?"font-medium text-[var(--k-ink)]":"text-[var(--k-ink-2)]"}`}>{it.name}</span>
                      {it.meta && <span className="k-mono text-[10px] text-[var(--k-green)] tracking-wider">{it.meta}</span>}
                      {!it.live && !it.meta && <span className="k-mono text-[9.5px] text-[var(--k-ink-4)] tracking-wider uppercase">Wave D</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* RIGHT PANE */}
        <section className="overflow-y-auto bg-[var(--k-paper)]">
          {pane === "general" && <PaneGeneral/>}
          {pane === "etsy"    && <PaneEtsy/>}
          {!["general","etsy"].includes(pane) && <PaneDeferred name={groups.flatMap(g=>g.items).find(i=>i.id===pane)?.name}/>}
        </section>
      </div>
    </main>
  );
}

/* ─── Pane: General ───────────────────────────────────────────── */
function PaneGeneral() {
  return (
    <div className="max-w-[680px] px-10 py-9">
      <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] mb-1">General</h2>
      <p className="text-[13px] text-[var(--k-ink-2)] mb-7">Defaults applied across the cockpit. Per-surface overrides live in their own headers.</p>

      <SettingRow label="Default density" hint="Comfortable shows more breathing room; Dense fits more rows on screen.">
        <div className="k-segment">
          <button aria-pressed="true"><Icon name="grid" size={11}/>Comfortable</button>
          <button aria-pressed="false"><Icon name="list" size={11}/>Dense</button>
        </div>
      </SettingRow>

      <SettingRow label="Theme" hint="Dark theme arrives in a later wave.">
        <div className="k-segment">
          <button aria-pressed="true">Light</button>
          <button aria-pressed="false" disabled style={{opacity:0.45,cursor:"not-allowed"}}>Dark · Wave D</button>
        </div>
      </SettingRow>

      <SettingRow label="Language" hint="UI strings only — generated listing copy follows your style profile.">
        <select className="k-input" style={{width:280}}>
          <option>English (en-US)</option>
          <option>Türkçe (tr)</option>
          <option>Deutsch (de)</option>
        </select>
      </SettingRow>

      <SettingRow label="Date / time format" hint="Affects timestamps on Activity log and Audit pane.">
        <div className="k-segment">
          <button aria-pressed="true">Relative</button>
          <button aria-pressed="false">ISO 8601</button>
        </div>
      </SettingRow>

      <div className="border-t border-[var(--k-line-soft)] pt-5 mt-8">
        <Btn variant="ghost" size="sm">Reset to defaults</Btn>
      </div>
    </div>
  );
}

/* ─── Pane: Etsy ──────────────────────────────────────────────── */
function PaneEtsy() {
  return (
    <div className="max-w-[680px] px-10 py-9">
      <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] mb-1">Etsy</h2>
      <p className="text-[13px] text-[var(--k-ink-2)] mb-7">OAuth-connected shop where Kivasy pushes drafts.</p>

      {/* Connected shop card */}
      <div className="k-card k-card--hero p-5 mb-7 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#E89B5B] to-[#8E3A12] flex items-center justify-center k-mono text-[15px] font-semibold text-white flex-shrink-0">HB</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="text-[15.5px] font-semibold tracking-tight">Husko Bro Studio</div>
            <Badge tone="success" dot>CONNECTED</Badge>
          </div>
          <div className="k-mono text-[11px] text-[var(--k-ink-3)] tracking-wider">huskobrostudio.etsy.com · 14 drafts pushed · last 2h ago</div>
        </div>
        <Btn variant="ghost" size="sm">Disconnect</Btn>
      </div>

      {/* Permissions */}
      <div className="mb-7">
        <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-2.5">Permissions granted</div>
        <div className="k-card divide-y divide-[var(--k-line-soft)]">
          {[
            {label:"Read shop data",       desc:"Listings, drafts, shop profile, review counts"},
            {label:"Push listing drafts",  desc:"Create + update drafts (no auto-publish)"},
            {label:"Read draft status",    desc:"Sync send-state back to Products surface"},
          ].map((p,i)=>(
            <div key={i} className="px-4 py-3 flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-[var(--k-green-soft)] text-[var(--k-green)] flex items-center justify-center"><Icon name="check" size={11} strokeWidth={2.5}/></span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium">{p.label}</div>
                <div className="text-[12px] text-[var(--k-ink-3)] mt-0.5">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2.5 pt-4 border-t border-[var(--k-line-soft)]">
        <Btn variant="secondary" size="sm" icon={<Icon name="retry" size={12}/>}>Re-authenticate</Btn>
        <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">Token refreshes automatically · expires in 27 days</span>
      </div>
    </div>
  );
}

/* ─── Pane: deferred ─────────────────────────────────────────── */
function PaneDeferred({ name }) {
  return (
    <div className="max-w-[680px] px-10 py-9">
      <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] mb-1">{name}</h2>
      <div className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mt-1">Coming in Wave D</div>
    </div>
  );
}

function SettingRow({ label, hint, children }) {
  return (
    <div className="grid items-start gap-6 py-4 border-b border-[var(--k-line-soft)]" style={{gridTemplateColumns:"220px 1fr"}}>
      <div>
        <div className="text-[13.5px] font-medium">{label}</div>
        {hint && <div className="text-[12px] text-[var(--k-ink-3)] mt-0.5 leading-snug">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

Object.assign(window, { C2Settings });
