/* global React */

/* ═════════════════════════════════════════════════════════════════
   v7 · Mini Wave D — completion pass
   D1 · Settings → AI Providers pane
   D2 · A6 Create Variations · Prompt Preview micro-extension
   No new primitives. Built on v4 base + v6 Settings shell.
   ═════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────
   D1 · Settings · AI Providers pane (renders inside C2 shell with
   "providers" active). The shell is duplicated from v6/screens-c2
   verbatim — same group labels, same admin badge on GOVERNANCE,
   same active-row chrome. Only the right pane content is new.
   §2 D1 + §6: reuse Etsy-card shell + B6 chip-row + A5 stat row.
   ───────────────────────────────────────────────────────────────── */
function D1Providers() {
  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <Topbar title="Settings" subtitle="WED · MAR 27 · 09:42 IST"/>
      <div className="flex-1 grid overflow-hidden" style={{gridTemplateColumns:"260px 1fr"}}>
        <SettingsLeftRail active="providers"/>
        <section className="overflow-y-auto bg-[var(--k-paper)]">
          <PaneAIProviders/>
        </section>
      </div>
    </main>
  );
}

/* Left rail — copied from v6/screens-c2 so the shell stays identical.
   Only difference: "providers" is now a live row (no Wave D meta). */
function SettingsLeftRail({ active = "providers" }) {
  const groups = [
    { label:"PREFERENCES", admin:false, items:[
      { id:"general",       name:"General",       icon:"settings", live:true  },
      { id:"workspace",     name:"Workspace",     icon:"layers",   live:false },
      { id:"editor",        name:"Editor",        icon:"image",    live:false },
      { id:"notifications", name:"Notifications", icon:"bell",     live:false },
    ]},
    { label:"CONNECTIONS", admin:false, items:[
      { id:"etsy",      name:"Etsy",         icon:"link",    live:true,  meta:"Connected" },
      { id:"providers", name:"AI Providers", icon:"sparkle", live:true,  meta:"3 / 5"     },
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
              const isActive = active === it.id;
              return (
                <button key={it.id}
                  className={`w-full text-left flex items-center gap-2.5 h-8 px-3 rounded-md transition-colors ${isActive?"bg-[var(--k-paper)]":"hover:bg-[rgba(22,19,15,0.035)]"}`}
                  style={isActive?{boxShadow:"inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 1px rgba(22,19,15,0.04), 0 1px 3px rgba(22,19,15,0.05), 0 0 0 1px rgba(22,19,15,0.04)"}:{}}>
                  <span style={{color: isActive?"var(--k-orange)":"var(--k-ink-3)"}}><Icon name={it.icon} size={13}/></span>
                  <span className={`text-[13px] flex-1 ${isActive?"font-medium text-[var(--k-ink)]":"text-[var(--k-ink-2)]"}`}>{it.name}</span>
                  {it.meta && <span className={`k-mono text-[10px] tracking-wider ${it.id==="providers"?"text-[var(--k-ink-3)]":"text-[var(--k-green)]"}`}>{it.meta}</span>}
                  {!it.live && !it.meta && <span className="k-mono text-[9.5px] text-[var(--k-ink-4)] tracking-wider uppercase">Wave D</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

/* ─── Pane: AI Providers ─────────────────────────────────────── */
function PaneAIProviders() {
  /* §2 D1 visual states: Connected · Key missing · partial defaults · Auth failed */
  const providers = [
    {
      id: "kie",
      name: "KIE",
      mono: "K",
      tone: "warm",
      status: { tone: "success", label: "CONNECTED" },
      keyMasked: "kie_••••••••••••••••••••••f4a2",
      lastSuccess: "2m ago",
      lastError: null,
      defaults: {
        variation:    { model: "kie/midjourney-v7", cost: "$0.024" },
        review:       { model: "kie/qc-vision-2",   cost: "$0.008" },
        listingCopy:  { model: "kie/copy-flash",    cost: "$0.002" },
        bgRemoval:    { model: "kie/cutout-v2",     cost: "$0.004" },
        mockup:       { model: "kie/compose-pro",   cost: "$0.012" },
      },
      dailyLimit: 50, monthlyLimit: 800,
      defaultsExpanded: true,
    },
    {
      id: "openai",
      name: "OpenAI",
      mono: "O",
      tone: "ink",
      status: { tone: "warning", label: "KEY MISSING" },
      keyMasked: "",
      keyEmptyHint: "Add an API key to enable OpenAI for any task",
      lastSuccess: null,
      lastError: null,
      defaults: null,
      dailyLimit: 0, monthlyLimit: 0,
    },
    {
      id: "fal",
      name: "Fal.ai",
      mono: "F",
      tone: "blue",
      status: { tone: "success", label: "CONNECTED" },
      keyMasked: "fal_••••••••••••••••••a8c1",
      lastSuccess: "14m ago",
      lastError: null,
      defaults: {
        variation: { model: "fal-ai/flux-pro-1.1", cost: "$0.020" },
      },
      partial: true,
      dailyLimit: 30, monthlyLimit: 400,
    },
    {
      id: "replicate",
      name: "Replicate",
      mono: "R",
      tone: "ink",
      status: { tone: "success", label: "CONNECTED" },
      keyMasked: "r8_••••••••••••••••••••••12db",
      lastSuccess: "1h ago",
      lastError: null,
      defaults: {
        bgRemoval: { model: "replicate/rembg-v2",         cost: "$0.005" },
        mockup:    { model: "replicate/sdxl-controlnet",  cost: "$0.011" },
      },
      partial: true,
      dailyLimit: 25, monthlyLimit: 300,
    },
    {
      id: "recraft",
      name: "Recraft",
      mono: "Rc",
      tone: "purple",
      status: { tone: "danger", label: "AUTH FAILED" },
      keyMasked: "rcft_••••••••••••••••6be0",
      lastSuccess: "3d ago",
      lastError: "Yesterday · 401 invalid_api_key",
      defaults: null,
      dailyLimit: 20, monthlyLimit: 200,
      authFailed: true,
    },
  ];

  return (
    <div className="max-w-[920px] px-10 py-9">
      {/* Header — title + admin context badge §2 D1 + §7.4 */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em]">AI Providers</h2>
        <span className="k-badge !h-[20px] !text-[9.5px] mt-1.5" data-tone="warning">ADMIN · WORKSPACE DEFAULTS</span>
      </div>
      <p className="text-[13px] text-[var(--k-ink-2)] mb-2">
        Provider keys, default models per task type, and spend ceilings. Applies workspace-wide.
      </p>
      {/* Per-user override caption §2 D1 */}
      <p className="k-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--k-ink-3)] mb-7">
        Per-user keys override workspace defaults · Manage your personal keys in <a href="#" className="text-[var(--k-blue)] hover:underline normal-case tracking-normal lowercase" style={{textTransform:"none",letterSpacing:0}}>Preferences → Workspace</a>
      </p>

      {/* 4-column stat row · A5 Listing-health pattern §2 D1 + §6 */}
      <div className="k-card mb-7 grid grid-cols-4 divide-x divide-[var(--k-line-soft)]">
        <Stat label="DAILY SPEND"      value="$3.42"  meta="of $50 limit" pct={3.42/50}/>
        <Stat label="MONTHLY SPEND"    value="$48.90" meta="of $800 limit" pct={48.9/800}/>
        <Stat label="ACTIVE PROVIDERS" value="3"      meta="of 5"           tone="ink"/>
        <Stat label="FAILED CALLS · 24H" value="14"   meta="2 auth · 12 timeout" tone="danger"/>
      </div>

      <div className="space-y-3">
        {providers.map(p => <ProviderCard key={p.id} p={p}/>)}
      </div>

      {/* No primary CTA — config surface, not workflow §3 */}
    </div>
  );
}

function Stat({ label, value, meta, pct, tone = "ink" }) {
  const valueColor = tone === "danger" ? "var(--k-red)" : "var(--k-ink)";
  return (
    <div className="px-5 py-4">
      <div className="k-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-[20px] font-semibold tabular-nums" style={{color: valueColor}}>{value}</span>
        <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">{meta}</span>
      </div>
      {pct != null && (
        <div className="mt-2 h-1 rounded-full bg-[var(--k-line-soft)] overflow-hidden">
          <div className="h-full rounded-full" style={{
            width: `${Math.max(2, Math.min(100, pct*100))}%`,
            background: pct > 0.8 ? "var(--k-red)" : "var(--k-orange)"
          }}/>
        </div>
      )}
    </div>
  );
}

/* Provider card — Etsy-card shell expanded §2 D1 + §6 */
function ProviderCard({ p }) {
  const [revealKey, setRevealKey] = React.useState(false);
  const [defaultsOpen, setDefaultsOpen] = React.useState(!!p.defaultsExpanded);
  const isMissing = p.status.label === "KEY MISSING";
  const isFailed  = p.authFailed;

  const monoBg = {
    warm:   "from-[#E89B5B] to-[#8E3A12]",
    blue:   "from-[#5B9BD5] to-[#1E4F7B]",
    ink:    "from-[#4A4640] to-[#16130F]",
    purple: "from-[#8A60C9] to-[#4A2E7A]",
  }[p.tone];

  return (
    <div className="k-card overflow-hidden">
      {/* Header row — same shape as C2 Etsy connection card */}
      <div className="p-5 flex items-center gap-4 border-b border-[var(--k-line-soft)]">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${monoBg} flex items-center justify-center k-mono text-[13px] font-semibold text-white flex-shrink-0`}>
          {p.mono}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="text-[15px] font-semibold tracking-tight">{p.name}</div>
            <Badge tone={p.status.tone} dot>{p.status.label}</Badge>
            {p.partial && <span className="k-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--k-ink-3)]">PARTIAL DEFAULTS</span>}
          </div>
          <div className="k-mono text-[11px] text-[var(--k-ink-3)] tracking-wider">
            {isMissing && "no key configured"}
            {!isMissing && p.lastSuccess && `last success ${p.lastSuccess}`}
            {p.lastError && <span className="text-[var(--k-red)] ml-2">· last error: {p.lastError}</span>}
          </div>
        </div>
        {!isMissing && !isFailed && <Btn variant="ghost" size="sm">Disconnect</Btn>}
        {isFailed && <Btn variant="primary" size="sm" icon={<Icon name="retry" size={12}/>}>Re-authenticate</Btn>}
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {/* API key field */}
        <div className="grid items-start gap-6" style={{gridTemplateColumns:"180px 1fr"}}>
          <div>
            <div className="text-[13px] font-medium">API key</div>
            <div className="text-[11.5px] text-[var(--k-ink-3)] mt-0.5">
              Stored encrypted at rest
            </div>
          </div>
          <div>
            {isMissing ? (
              <div>
                <input type="text" placeholder="Paste API key…" className="k-input w-full" style={{maxWidth:480}}/>
                <div className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider mt-1.5">{p.keyEmptyHint}</div>
              </div>
            ) : (
              <div className="flex items-center gap-2 max-w-[520px]">
                <div className="flex-1 flex items-center h-9 px-3 rounded-md border border-[var(--k-line)] bg-[var(--k-bg)] k-mono text-[12px] text-[var(--k-ink-2)]">
                  {revealKey ? p.keyMasked.replace(/•/g, "x") : p.keyMasked}
                </div>
                <button onClick={()=>setRevealKey(v=>!v)} className="k-iconbtn" aria-label="Reveal" style={revealKey?{color:"var(--k-orange)"}:{}}><Icon name="eye" size={14}/></button>
                <button className="k-iconbtn" aria-label="Copy"><Icon name="copy" size={14}/></button>
                {!isFailed && <Btn variant="ghost" size="sm">Re-authenticate</Btn>}
              </div>
            )}
          </div>
        </div>

        {/* Default models — collapsible per task type */}
        {!isMissing && (
          <div className="grid items-start gap-6" style={{gridTemplateColumns:"180px 1fr"}}>
            <div>
              <div className="text-[13px] font-medium">Default models</div>
              <div className="text-[11.5px] text-[var(--k-ink-3)] mt-0.5">
                Used unless a batch overrides
              </div>
            </div>
            <div>
              <button onClick={()=>setDefaultsOpen(v=>!v)}
                className="flex items-center gap-2 mb-2 text-[12.5px] text-[var(--k-ink-2)] hover:text-[var(--k-ink)]">
                <Icon name="chevronD" size={11} style={{transform: defaultsOpen?"none":"rotate(-90deg)", transition:"transform 140ms"}}/>
                <span>5 task types</span>
                {p.defaults && (
                  <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">
                    · {Object.keys(p.defaults).length} assigned
                  </span>
                )}
              </button>
              {defaultsOpen && (
                <div className="rounded-md border border-[var(--k-line)] bg-[var(--k-bg)]/60 divide-y divide-[var(--k-line-soft)]">
                  <TaskRow label="Variation generation"  taskKey="variation"   p={p}/>
                  <TaskRow label="Quality review"        taskKey="review"      p={p}/>
                  <TaskRow label="Listing copy generation" taskKey="listingCopy" p={p}/>
                  <TaskRow label="Background removal"    taskKey="bgRemoval"   p={p}/>
                  <TaskRow label="Mockup composition"    taskKey="mockup"      p={p}/>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Limits — only if connected */}
        {!isMissing && (
          <div className="grid items-start gap-6" style={{gridTemplateColumns:"180px 1fr"}}>
            <div>
              <div className="text-[13px] font-medium">Spend limits</div>
              <div className="text-[11.5px] text-[var(--k-ink-3)] mt-0.5">
                Hard ceiling — calls fail past limit
              </div>
            </div>
            <div className="flex items-center gap-3 max-w-[420px]">
              <div className="flex-1">
                <label className="k-mono text-[10px] uppercase tracking-[0.12em] text-[var(--k-ink-3)] block mb-1">Daily · USD</label>
                <input type="number" defaultValue={p.dailyLimit} className="k-input w-full"/>
              </div>
              <div className="flex-1">
                <label className="k-mono text-[10px] uppercase tracking-[0.12em] text-[var(--k-ink-3)] block mb-1">Monthly · USD</label>
                <input type="number" defaultValue={p.monthlyLimit} className="k-input w-full"/>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Task default row — B6 chip-row pattern with select swap §2 D1 + §6 */
function TaskRow({ label, taskKey, p }) {
  const assigned = p.defaults?.[taskKey];
  const modelOptions = {
    variation:    ["kie/midjourney-v7","fal-ai/flux-pro-1.1","openai/gpt-image-1","replicate/sdxl"],
    review:       ["kie/qc-vision-2","openai/gpt-4o-mini","fal-ai/llava-13b"],
    listingCopy:  ["kie/copy-flash","openai/gpt-4o-mini","openai/gpt-4o"],
    bgRemoval:    ["kie/cutout-v2","replicate/rembg-v2","fal-ai/birefnet"],
    mockup:       ["kie/compose-pro","replicate/sdxl-controlnet","fal-ai/flux-canny"],
  }[taskKey] || [];

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="text-[12.5px] flex-1 min-w-0">{label}</span>
      {assigned ? (
        <select className="k-input k-mono !text-[11.5px]" defaultValue={assigned.model} style={{width:240, height:30}}>
          {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      ) : (
        <select className="k-input k-mono !text-[11.5px]" defaultValue="" style={{width:240, height:30, color:"var(--k-ink-3)"}}>
          <option value="" disabled>— not assigned —</option>
          {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      )}
      <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider w-[64px] text-right tabular-nums">
        {assigned ? `${assigned.cost}/call` : "—"}
      </span>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   D2 · A6 Create Variations · Prompt Preview micro-extension
   Two states demonstrated:
     D2a — collapsed by default (quiet single-row affordance)
     D2b — expanded + override edited (amber caption + reset link)
   No other A6 section is modified. §2 D2 + §3.
   The mock here mirrors only the surrounding sections needed to
   read context (template select above, ref params below). The
   full A6 footer + rail are preserved verbatim from v4 A6.
   ═════════════════════════════════════════════════════════════════ */
function D2A6PromptPreview({ initialMode = "collapsed" }) {
  /* mode: "collapsed" | "expanded" | "edited" */
  const [mode, setMode] = React.useState(initialMode);

  return (
    <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--k-bg-2)]">
      {/* Faux page underneath so the modal reads as overlaid */}
      <Topbar title="Library" subtitle="A6 · Create Variations modal opened"/>
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-6 gap-3 p-6 opacity-30 pointer-events-none">
          {Array.from({length:18}).map((_,i)=>(
            <div key={i} className="k-thumb" data-kind={["boho","poster","abstract","clipart","nursery","christmas","landscape","sticker"][i%8]} style={{aspectRatio:"1/1", borderRadius: 6}}/>
          ))}
        </div>
        <A6ModalWithPreview mode={mode} onModeChange={setMode}/>
      </div>
    </main>
  );
}

function A6ModalWithPreview({ mode, onModeChange }) {
  const [aspect] = React.useState("square");
  const [count] = React.useState(8);

  /* Resolved prompt — interpolated from current modal state.
     Variables: {aspect}, {palette}, {subject} */
  const tplBody = "boho line art {subject}, minimal continuous-line, {palette} palette on warm cream, soft grain, no text, --ar {aspect_token} --style raw --v 7";
  const resolved = tplBody
    .replace("{aspect_token}", aspect === "square" ? "1:1" : aspect === "landscape" ? "3:2" : "2:3")
    .replace("{subject}", "single botanical motif")
    .replace("{palette}", "neutral terracotta + cream");
  const overrideEdited = "boho line art SINGLE PEONY in continuous line, neutral terracotta + cream palette on warm cream paper, very soft film grain, NO TEXT NO BORDERS, --ar 1:1 --style raw --v 7 --s 250";

  return (
    <Modal title="Create Variations" onClose={()=>{}}
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
          </dl>
        </>
      }
      footer={
        /* §3: footer unchanged — Cancel ghost + cost preview + primary orange */
        <>
          <Btn variant="ghost">Cancel</Btn>
          <div className="ml-auto flex items-center gap-3">
            <span className="k-mono text-[11px] text-[var(--k-ink-3)]">~$0.{count*4} · est. {Math.round(count*0.5)}m</span>
            <Btn variant="primary" icon={<Icon name="sparkle" size={13}/>}>Create {count} Variations</Btn>
          </div>
        </>
      }>
      <div className="space-y-7 max-w-[640px]">
        {/* Surrounding sections preserved for context — NOT modified */}
        <D2Section label="Aspect ratio">
          <div className="grid grid-cols-3 gap-3">
            <D2RatioCard active w={56} h={56} title="Square" sub="1:1"/>
            <D2RatioCard w={72} h={48} title="Landscape" sub="3:2"/>
            <D2RatioCard w={48} h={72} title="Portrait" sub="2:3"/>
          </div>
        </D2Section>

        <D2Section label="Variation count">
          <div className="flex">
            {[4,6,8,12].map(n => (
              <button key={n}
                className={`flex-1 h-10 text-[13px] font-semibold border border-[var(--k-line)] -ml-px first:ml-0 first:rounded-l-md last:rounded-r-md transition-colors ${n === count ? "bg-[var(--k-orange-soft)] border-[var(--k-orange)] text-[var(--k-orange-ink)] z-10 relative" : "bg-[var(--k-paper)] text-[var(--k-ink-2)]"}`}>
                {n}
              </button>
            ))}
          </div>
        </D2Section>

        <D2Section label="Prompt template">
          <button className="w-full flex items-center gap-3 h-11 px-3 border border-[var(--k-line)] rounded-md bg-[var(--k-paper)] hover:border-[var(--k-line-strong)] transition-colors">
            <Icon name="search" size={14} className="text-[var(--k-ink-3)]"/>
            <div className="flex-1 text-left">
              <div className="text-[13.5px] font-medium">Boho line wall art · neutral palette</div>
            </div>
            <span className="k-mono text-[11px] text-[var(--k-ink-3)]">tpl_204</span>
            <Icon name="chevronD" size={13} className="text-[var(--k-ink-3)]"/>
          </button>

          {/* ─── D2 PROMPT PREVIEW ── new section, B5-details register ─── */}
          <PromptPreviewSection mode={mode} onModeChange={onModeChange} resolved={resolved} edited={overrideEdited}/>
        </D2Section>

        <D2Section label="Reference parameters" hint="Optional · advanced">
          <div className="flex flex-wrap gap-2">
            {[
              { label:"--sref", desc:"Style reference", on:true },
              { label:"--oref", desc:"Object reference", on:false },
              { label:"--cref", desc:"Character reference", on:false },
            ].map(({label,desc,on}) => (
              <div key={label}
                className={`flex items-center gap-2 h-9 px-3 rounded-md border ${on ? "bg-[var(--k-orange-soft)] border-[var(--k-orange)]" : "bg-[var(--k-paper)] border-[var(--k-line)]"}`}>
                <Checkbox checked={on}/>
                <span className="k-mono text-[11.5px] font-semibold" style={{color: on ? "var(--k-orange-ink)" : "var(--k-ink-2)"}}>{label}</span>
                <span className="text-[12px]" style={{color: on ? "var(--k-orange-ink)" : "var(--k-ink-3)"}}>{desc}</span>
              </div>
            ))}
          </div>
        </D2Section>
      </div>
    </Modal>
  );
}

/* The new affordance. Quiet by default. No accent fill. §2 D2 + §3. */
function PromptPreviewSection({ mode, onModeChange, resolved, edited }) {
  const isOpen   = mode === "expanded" || mode === "edited";
  const isEdited = mode === "edited";

  return (
    <details
      open={isOpen}
      onToggle={(e)=>onModeChange(e.currentTarget.open ? (isEdited ? "edited" : "expanded") : "collapsed")}
      className="mt-2.5 group"
      style={{
        borderTop: "1px dashed var(--k-line-soft)",
        paddingTop: 8,
      }}>
      <summary className="list-none cursor-pointer flex items-center gap-2 select-none"
        style={{minHeight: 28, padding: "2px 0"}}>
        <Icon name="chevronD" size={11} className="text-[var(--k-ink-3)]" style={{transform: isOpen?"none":"rotate(-90deg)", transition:"transform 140ms"}}/>
        <span className="text-[12.5px] text-[var(--k-ink-2)]">Prompt preview</span>
        <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider ml-auto">
          (advanced · view or edit before generating)
        </span>
      </summary>

      {isOpen && (
        <div className="mt-3 space-y-2">
          {!isEdited ? (
            <>
              <textarea readOnly value={resolved}
                className="k-input k-mono w-full"
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.6,
                  height: 96,
                  resize: "vertical",
                  background: "var(--k-bg)",
                  color: "var(--k-ink-2)",
                  cursor: "default",
                }}/>
              <div className="flex items-center justify-between">
                <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">
                  Read-only · template tpl_204 with current modal state interpolated
                </span>
                <button onClick={()=>onModeChange("edited")}
                  className="k-mono text-[11px] text-[var(--k-blue)] hover:underline">
                  Edit as override
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea defaultValue={edited}
                className="k-input k-mono w-full"
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.6,
                  height: 110,
                  resize: "vertical",
                }}/>
              <div className="flex items-center justify-between">
                <span className="k-mono text-[10.5px] tracking-wider flex items-center gap-1.5"
                  style={{color: "var(--k-amber-ink, #8a5b14)"}}>
                  <span style={{
                    display:"inline-block", width:6, height:6, borderRadius:999,
                    background:"var(--k-amber, #d99a2b)"
                  }}/>
                  edited · won't save to template
                </span>
                <button onClick={()=>onModeChange("expanded")}
                  className="k-mono text-[11px] text-[var(--k-ink-3)] hover:text-[var(--k-ink-2)] hover:underline">
                  Reset to template
                </button>
              </div>
              <div className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider leading-relaxed pt-1">
                Override travels with this batch only · visible later in Batch detail → Parameters as
                <span className="k-mono"> "Prompt: Custom override of tpl_204"</span>
              </div>
            </>
          )}
        </div>
      )}
    </details>
  );
}

/* Local helpers — copies of A6 internal helpers so D2 stays self-contained
   and never imports from screens-a6-a7.jsx (no risk of accidental edit). */
function D2Section({ label, hint, children }) {
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
function D2RatioCard({ active, w, h, title, sub }) {
  return (
    <button
      className={`flex flex-col items-center justify-center gap-2 h-[120px] rounded-md border-2 transition-all ${active ? "border-[var(--k-orange)] bg-[var(--k-orange-soft)]/30" : "border-[var(--k-line)] bg-[var(--k-paper)]"}`}>
      <div style={{width: w, height: h, background: active ? "var(--k-orange)" : "var(--k-line-strong)", borderRadius: 3}}/>
      <div className="text-center">
        <div className="text-[12.5px] font-semibold">{title}</div>
        <div className="k-mono text-[10.5px] text-[var(--k-ink-3)]">{sub}</div>
      </div>
    </button>
  );
}

Object.assign(window, { D1Providers, D2A6PromptPreview });
