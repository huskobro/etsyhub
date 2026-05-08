/* global React */
/* ═════════════════════════════════════════════════════════════════════
   B5 · Add Reference split modal — pipeline entry door
   Per §B5: 3 input tabs (URL/Upload/Bookmark), product-type chips
   always visible, optional collection. One CTA, count updates if
   From Bookmark multi-select.
   ═════════════════════════════════════════════════════════════════════ */
function B5AddReference({ onClose }) {
  const [tab, setTab] = React.useState("url");
  const [type, setType] = React.useState("wall");
  const [bookmarkSel, setBookmarkSel] = React.useState(["b2","b3"]);
  const tabs = [
    { id:"url",      label:"Image URL" },
    { id:"upload",   label:"Upload Image" },
    { id:"bookmark", label:"From Bookmark" },
  ];
  const types = [
    { id:"clipart",  label:"Clipart bundle" },
    { id:"wall",     label:"Wall art" },
    { id:"bookmark", label:"Bookmark" },
    { id:"sticker",  label:"Sticker" },
    { id:"print",    label:"Printable" },
  ];

  const ctaLabel = tab==="bookmark" ? `Add ${bookmarkSel.length} References` : "Add Reference";

  return (
    <div className="k-overlay">
      <div className="k-modal" style={{height:"min(720px,88vh)"}}>
        <div className="k-modal__header">
          <h2 className="text-[16px] font-semibold flex-1">Add Reference</h2>
          <button className="k-iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[var(--k-paper)]">
          <div className="px-6 pt-5 pb-4 border-b border-[var(--k-line-soft)]">
            <SiblingTabs tabs={tabs} active={tab} onChange={setTab}/>
          </div>

          <div className="px-6 py-6">
            {tab==="url" && (
              <div className="space-y-4">
                <div>
                  <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-1.5">Image URL</label>
                  <div className="relative">
                    <Icon name="link" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--k-ink-3)]"/>
                    <input className="k-input !pl-9" placeholder="https://i.etsystatic.com/…/il_1140xN.jpg" defaultValue="https://i.etsystatic.com/12345678/r/il/abc123/4567890123/il_1140xN.jpg"/>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Icon name="check" size={12} className="text-[var(--k-green)]" strokeWidth={2.5}/>
                    <span className="k-mono text-[11px] text-[var(--k-green)] tracking-wider">Valid Etsy listing image · auto-detected source</span>
                  </div>
                </div>

                <details className="border border-[var(--k-line)] rounded-lg overflow-hidden" open>
                  <summary className="px-4 py-3 bg-[var(--k-bg)] cursor-pointer flex items-center justify-between">
                    <span className="text-[12.5px] font-medium">How to get the image URL</span>
                    <Icon name="chevronD" size={12} className="text-[var(--k-ink-3)]"/>
                  </summary>
                  <ol className="px-4 py-3 space-y-2 text-[12.5px] text-[var(--k-ink-2)]">
                    <li className="flex gap-3"><span className="k-mono text-[10.5px] text-[var(--k-orange)] tracking-wider w-5 pt-0.5">01</span>Right-click the image on Etsy or Pinterest</li>
                    <li className="flex gap-3"><span className="k-mono text-[10.5px] text-[var(--k-orange)] tracking-wider w-5 pt-0.5">02</span>Select "Copy image address"</li>
                    <li className="flex gap-3"><span className="k-mono text-[10.5px] text-[var(--k-orange)] tracking-wider w-5 pt-0.5">03</span>Paste here — Kivasy auto-detects platform + meta</li>
                  </ol>
                </details>
              </div>
            )}

            {tab==="upload" && (
              <div>
                <div className="border-2 border-dashed border-[var(--k-line-strong)] rounded-xl p-12 text-center bg-[var(--k-bg)]">
                  <div className="w-14 h-14 mx-auto rounded-full bg-[var(--k-paper)] border border-[var(--k-line)] flex items-center justify-center text-[var(--k-ink-3)] mb-3">
                    <Icon name="upload" size={22}/>
                  </div>
                  <div className="text-[14.5px] font-semibold mb-1">Drop images to upload</div>
                  <div className="k-mono text-[11px] text-[var(--k-ink-3)] tracking-wider mb-4">PNG · JPG · JPEG · WEBP · max 20MB each</div>
                  <Btn variant="secondary" size="sm" icon={<Icon name="plus" size={12}/>}>Browse files</Btn>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-3">
                  <div className="k-card overflow-hidden">
                    <div className="p-1.5 pb-0"><div className="k-thumb" data-kind="boho" data-aspect="square"/></div>
                    <div className="px-2 py-1.5 flex items-center justify-between">
                      <span className="text-[11px] truncate">boho-line-01.png</span>
                      <button className="k-iconbtn !w-5 !h-5 !border-0"><Icon name="x" size={10}/></button>
                    </div>
                  </div>
                  <div className="k-card overflow-hidden">
                    <div className="p-1.5 pb-0"><div className="k-thumb" data-kind="nursery" data-aspect="square"/></div>
                    <div className="px-2 py-1.5 flex items-center justify-between">
                      <span className="text-[11px] truncate">nursery-bear.jpg</span>
                      <button className="k-iconbtn !w-5 !h-5 !border-0"><Icon name="x" size={10}/></button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab==="bookmark" && (
              <div>
                <div className="relative mb-3">
                  <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--k-ink-3)]"/>
                  <input className="k-input !pl-9" placeholder="Search Inbox bookmarks…"/>
                </div>
                <div className="k-card overflow-hidden">
                  {[
                    { id:"b1", k:"boho",     t:"Botanical line set 03",    s:"Pinterest", added:"2h" },
                    { id:"b2", k:"nursery",  t:"Bear nursery 12",          s:"Etsy",      added:"5h" },
                    { id:"b3", k:"clipart",  t:"Floral clipart pack 25",   s:"Pinterest", added:"1d" },
                    { id:"b4", k:"poster",   t:"Affirmation poster",       s:"Upload",    added:"2d" },
                    { id:"b5", k:"abstract", t:"Riso landscape study",     s:"Pinterest", added:"3d" },
                    { id:"b6", k:"sticker",  t:"Quote sticker bundle",     s:"Etsy",      added:"6d" },
                  ].map((r,i,arr)=>{
                    const sel = bookmarkSel.includes(r.id);
                    return (
                      <div key={r.id} onClick={()=>setBookmarkSel(s=>sel?s.filter(x=>x!==r.id):[...s,r.id])}
                           className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[var(--k-bg)] ${i<arr.length-1?"border-b border-[var(--k-line-soft)]":""}`}>
                        <Checkbox checked={sel} onChange={()=>{}}/>
                        <div className="k-thumb !w-9 !aspect-square flex-shrink-0" data-kind={r.k}/>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium leading-tight truncate">{r.t}</div>
                          <div className="mt-0.5 flex items-center gap-1.5">
                            <Badge tone={r.s==="Etsy"?"warning":r.s==="Pinterest"?"danger":"info"}>{r.s}</Badge>
                            <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">{r.added} ago</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{bookmarkSel.length} selected · will promote to Pool</div>
              </div>
            )}
          </div>

          <div className="px-6 pb-6 pt-2">
            <div className="space-y-4 pt-4 border-t border-[var(--k-line-soft)]">
              <div>
                <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-2">Product type</label>
                <div className="flex flex-wrap gap-1.5">
                  {types.map(t=>(
                    <button key={t.id} onClick={()=>setType(t.id)}
                            className={`k-chip ${type===t.id?"k-chip--active":""}`}>{t.label}</button>
                  ))}
                </div>
                <div className="mt-1.5 k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">Defaults to your last used type · Wall art</div>
              </div>

              <div>
                <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-2">Collection (optional)</label>
                <Chip caret>Add to collection</Chip>
              </div>
            </div>
          </div>
        </div>

        <div className="k-modal__footer">
          <Btn variant="ghost" size="md" onClick={onClose}>Cancel</Btn>
          <div className="ml-auto">
            <Btn variant="primary" size="md" icon={<Icon name="plus" size={13}/>}>{ctaLabel}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   B6 · Generate Listing split modal — intelligence layer
   Per §B6: 1 CTA, locked digital download, no result inline.
   Result handoff state: A5 Listing tab populating with field-by-field
   reveal animation (frozen mid-animation as per §B6).
   ═════════════════════════════════════════════════════════════════════ */
function B6GenerateListing({ onClose, onGenerate }) {
  const [tone, setTone] = React.useState("match");
  const [length, setLength] = React.useState("standard");
  const [keywords, setKeywords] = React.useState(["seo","benefits","contents"]);
  const tones = [
    { id:"match",    label:"Match style profile" },
    { id:"playful",  label:"Playful" },
    { id:"premium",  label:"Premium" },
    { id:"minimal",  label:"Minimalist" },
    { id:"spirit",   label:"Spiritual" },
    { id:"boho",     label:"Boho" },
  ];
  const lengths = [
    { id:"short",    label:"Short" },
    { id:"standard", label:"Standard" },
    { id:"detail",   label:"Detailed" },
  ];
  const kw = [
    { id:"seo",       label:"SEO keywords" },
    { id:"benefits",  label:"Buyer benefits" },
    { id:"contents",  label:"File contents" },
    { id:"uses",      label:"Use cases" },
    { id:"gift",      label:"Gift angle" },
  ];

  const rail = (
    <div>
      <div className="k-thumb mb-3" data-kind="christmas" data-aspect="square"/>
      <div className="text-[14.5px] font-semibold leading-tight">Christmas Wall Art Set</div>
      <div className="mt-1 k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">12 designs · 4 mockups</div>

      <div className="mt-5 pt-4 border-t border-[var(--k-line)]">
        <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-3">Style profile</div>
        <dl className="space-y-2 text-[12.5px]">
          <div className="flex justify-between gap-3"><dt className="text-[var(--k-ink-3)]">Tone</dt><dd className="text-right text-[var(--k-ink)] font-medium">playful · premium</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--k-ink-3)]">Niche</dt><dd className="text-right text-[var(--k-ink)] font-medium">Boho wall art</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--k-ink-3)]">Audience</dt><dd className="text-right text-[var(--k-ink)] font-medium">25-44 · women · US/CA</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[var(--k-ink-3)]">Banned terms</dt><dd className="text-right text-[var(--k-ink)] font-medium k-mono tabular-nums">42</dd></div>
        </dl>
        <button className="mt-3 k-btn k-btn--ghost" data-size="sm" disabled style={{opacity:0.55}}><Icon name="settings" size={11}/>Edit style profile</button>
      </div>
    </div>
  );

  const footer = (
    <>
      <Btn variant="ghost" size="md" onClick={onClose}>Cancel</Btn>
      <div className="ml-auto flex items-center gap-3">
        <span className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">~$0.04 · est. 8s · 1.2k tokens</span>
        <Btn variant="primary" size="md" icon={<Icon name="sparkle" size={13}/>} onClick={onGenerate}>Generate Listing</Btn>
      </div>
    </>
  );

  return (
    <Modal title="Generate Listing" onClose={onClose} rail={rail} footer={footer}>
      <div className="space-y-5">
        {/* Listing type — locked */}
        <div>
          <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-2">Listing type</label>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--k-bg)] border border-[var(--k-line)]">
            <Icon name="download" size={14} className="text-[var(--k-ink-2)]"/>
            <span className="text-[13px] font-medium">Digital download</span>
            <span className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] ml-auto">Locked</span>
          </div>
          <div className="mt-1.5 k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">Physical / made-to-order not supported</div>
        </div>

        {/* Tone */}
        <div>
          <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-2">Tone variant</label>
          <div className="k-stabs !flex-wrap">
            {tones.map(t=>(
              <button key={t.id} onClick={()=>setTone(t.id)} className={`k-stab ${tone===t.id?"k-stab--active":""}`}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Length */}
        <div>
          <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-2">Length</label>
          <div className="k-stabs">
            {lengths.map(l=>(
              <button key={l.id} onClick={()=>setLength(l.id)} className={`k-stab ${length===l.id?"k-stab--active":""}`}>{l.label}</button>
            ))}
          </div>
        </div>

        {/* Keyword priority */}
        <div>
          <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-2">Keyword priority</label>
          <div className="flex flex-wrap gap-1.5">
            {kw.map(k=>(
              <button key={k.id} onClick={()=>setKeywords(s=>s.includes(k.id)?s.filter(x=>x!==k.id):[...s,k.id])}
                      className={`k-chip ${keywords.includes(k.id)?"k-chip--active":""}`}>
                {keywords.includes(k.id) && <Icon name="check" size={10} strokeWidth={2.5}/>}
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {/* Target file types */}
        <div>
          <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-2">Target file types</label>
          <div className="flex items-center gap-1.5">
            {["ZIP","PNG","PDF"].map(t=><Badge key={t} tone="info">{t}</Badge>)}
            <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider ml-1">From Files tab</span>
          </div>
        </div>

        {/* Negative library */}
        <div>
          <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-2">Negative library</label>
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">Avoiding:</span>
            <Badge tone="danger">Disney</Badge>
            <Badge tone="danger">Marvel</Badge>
            <Badge tone="danger">trademarked terms</Badge>
            <Badge tone="neutral">+39 more</Badge>
          </div>
        </div>

        {/* Optional human prompt */}
        <div>
          <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mb-2">Anything specific to mention? <span className="text-[var(--k-ink-4)] normal-case tracking-normal">(optional · max 200 chars)</span></label>
          <textarea className="k-input" rows={3} placeholder="e.g. Holiday gifting angle, frame size guidance, family-photo placement…"/>
        </div>
      </div>
    </Modal>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   B6.PostGen · Result handoff state — A5 Product / Listing tab with
   field-by-field reveal animation frozen mid-animation
   ═════════════════════════════════════════════════════════════════════ */
function B6PostGenerationListing() {
  /* This is the destination after Generate Listing closes.
     Per §B6: modal does NOT show result inline; closes + reveals fields
     in A5 Listing tab. Frozen here mid-reveal (3 of 5 fields done). */
  return (
    <div className="flex flex-col h-screen min-w-0 flex-1">
      <Topbar back={{ to:"b4" }} title="Christmas Wall Art Set" subtitle="PRD · 01J9A"
              status={{ tone:"info", label:"Mockup ready" }}>
        <Btn variant="secondary" size="sm" icon={<Icon name="sparkle" size={12}/>}>Re-generate</Btn>
        <Btn variant="publish" size="sm" icon={<Icon name="send" size={13}/>}>Send to Etsy as Draft</Btn>
      </Topbar>

      <div className="flex-shrink-0 bg-[var(--k-bg)]">
        <div className="k-tabs">
          <button className="k-tab">Mockups</button>
          <button className="k-tab k-tab--active">Listing<span className="k-tab__count k-tnum">5/8</span></button>
          <button className="k-tab">Files</button>
          <button className="k-tab">History</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
        {/* Per user note: subtle, product-like — a quiet status row,
            no gradient banner, no animated dot grid. */}
        <div className="mb-5 flex items-center gap-2 text-[12px] text-[var(--k-ink-2)]">
          <Icon name="sparkle" size={12} className="text-[var(--k-ink-3)]"/>
          <span>Generating listing</span>
          <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">· 5 of 8 fields · ~3s remaining</span>
          <button className="ml-auto k-btn k-btn--ghost !h-7 !px-2" data-size="sm">Cancel</button>
        </div>

        {/* Field 1: title — done */}
        <FieldRevealed label="Title" idx="01">
          <input className="k-input" defaultValue="Christmas Wall Art Set · Boho Holiday Printable · 12 Designs · Instant Download · Modern Farmhouse Holiday Decor"/>
          <div className="mt-1 k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">128 / 140 chars · 12 keywords detected</div>
        </FieldRevealed>

        {/* Field 2: tags — done */}
        <FieldRevealed label="Tags" idx="02" sub="13 / 13">
          <div className="flex flex-wrap gap-1.5">
            {["christmas wall art","boho holiday","printable wall art","modern farmhouse","holiday decor","wreath print","scandi christmas","instant download","digital print","holly wreath","cardinal print","mountain holiday","art set bundle"].map((t,i)=>(
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--k-bg)] border border-[var(--k-line)] text-[12px]">
                {t}
                <button className="text-[var(--k-ink-3)] hover:text-[var(--k-red)]"><Icon name="x" size={10}/></button>
              </span>
            ))}
          </div>
        </FieldRevealed>

        {/* Field 3: category — done */}
        <FieldRevealed label="Category" idx="03">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--k-paper)] border border-[var(--k-line)]">
            <span className="text-[13px] text-[var(--k-ink-3)]">Digital Downloads</span>
            <Icon name="chevron" size={11} className="text-[var(--k-ink-4)]"/>
            <span className="text-[13px] text-[var(--k-ink-3)]">Art &amp; Collectibles</span>
            <Icon name="chevron" size={11} className="text-[var(--k-ink-4)]"/>
            <span className="text-[13px] font-medium">Prints / Digital Prints</span>
          </div>
        </FieldRevealed>

        {/* Field 4: description — currently filling (subtle) */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">04</span>
            <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">Description</label>
            <span className="k-mono text-[10px] text-[var(--k-ink-3)] tracking-wider">· filling</span>
          </div>
          <textarea className="k-input" rows={5}
                    defaultValue={"Bring cozy holiday warmth to your walls with this 12-design Christmas wall art set. Hand-illustrated boho-style holly wreaths, frost-touched cardinals, and modern farmhouse holiday quotes — printable at home or your local print shop in moments.\n\nWHAT'S INSIDE\n· 12 high-resolution PNG files (300 DPI)\n· 1 ZIP bundle for instant download\n· Print-ready PDF f"}/>
          <div className="mt-1 k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider tabular-nums">340 / 550 words</div>
        </div>

        {/* Field 5: materials — done */}
        <FieldRevealed label="Materials" idx="05">
          <input className="k-input" defaultValue="digital file, png, pdf, zip download, instant download, printable wall art"/>
        </FieldRevealed>

        {/* Pending fields — placeholders (skeleton) */}
        <PendingField label="Price" idx="06"/>
        <PendingField label="Digital file types" idx="07"/>
        <PendingField label="Commercial license" idx="08"/>
      </div>
    </div>
  );
}

function FieldRevealed({ label, idx, sub, children }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{idx}</span>
        <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{label}</label>
        {sub && <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider">· {sub}</span>}
        <Icon name="check" size={11} className="text-[var(--k-green)] ml-1" strokeWidth={2.5}/>
      </div>
      {children}
    </div>
  );
}
function PendingField({ label, idx }) {
  return (
    <div className="mb-5 opacity-50">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-4)]">{idx}</span>
        <label className="block k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-4)]">{label}</label>
      </div>
      <div className="h-9 rounded-lg bg-[var(--k-bg-2)] border border-[var(--k-line-soft)]"/>
    </div>
  );
}

Object.assign(window, { B5AddReference, B6GenerateListing, B6PostGenerationListing });
