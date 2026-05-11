/* global React */

/* ═══════════════════════════════════════════════════════════════
   A5 · PRODUCT DETAIL
   Tabs: Mockups · Listing · Files · History
   Listing tab: digital-file-types checklist (ZIP/PNG/PDF/JPG/JPEG)
   No physical, no shipping, no production partner, no fulfillment.
   ═══════════════════════════════════════════════════════════════ */
function A5ProductDetail() {
  const [tab, setTab] = React.useState("listing");
  const [fileTypes, setFileTypes] = React.useState({ ZIP: true, PNG: true, PDF: true, JPG: false, JPEG: false });
  const tags = ["boho wall art","line art print","wreath illustration","nursery decor","instant download","printable art","neutral home","floral print","bedroom art","scandinavian","modern boho","botanical","living room"];

  return (
    <div className="flex flex-col h-screen min-w-0 flex-1">
      <Topbar back={{to:"products"}}
              title="Boho Wreath Set · 12 prints"
              subtitle="PROD_8H4Z · DRAFT NOT SENT"
              status={{tone:"warning", label:"Mockup ready"}}>
        <Btn variant="secondary" size="sm" icon={<Icon name="duplicate" size={13}/>}>Duplicate</Btn>
        <Btn variant="ghost" size="sm" icon={<Icon name="eye" size={13}/>}>Preview</Btn>
        <Btn variant="publish" size="sm" icon={<Icon name="send" size={13}/>}>Send to Etsy as Draft</Btn>
      </Topbar>

      <Tabs
        tabs={[
          { id:"mockups", label:"Mockups", count: 8 },
          { id:"listing", label:"Listing" },
          { id:"files",   label:"Files", count: 25 },
          { id:"history", label:"History" },
        ]}
        active={tab} onChange={setTab}/>

      <div className="flex-1 overflow-y-auto bg-[var(--k-bg)]">
        {tab === "listing" && (
          <div className="grid grid-cols-[1fr_360px] gap-0 min-h-full">
            <div className="p-8 max-w-[820px] space-y-7">
              {/* Title */}
              <Field label="Listing title" hint="140 chars max · 113 used" hintTone="success">
                <input className="k-input" defaultValue="Boho Wreath Set · 12 Floral Line Art Prints · Instant Download · Printable Wall Art for Nursery & Living Room"/>
              </Field>

              {/* Description */}
              <Field label="Description" hint="Markdown supported">
                <textarea className="k-input" rows={6} defaultValue={"A set of 12 hand-drawn floral wreath illustrations in a warm, neutral palette. Each design is delivered as a high-resolution PNG (4096px, 300 DPI) plus a print-ready PDF.\n\nUse for nursery walls, living room gallery walls, or as printable cards. Files unlock immediately after purchase via Etsy's instant download."}/>
              </Field>

              {/* Tags */}
              <Field label="Tags" hint={`${tags.length} / 13 used`} hintTone={tags.length === 13 ? "success" : "neutral"}>
                <div className="flex flex-wrap gap-1.5 p-2.5 border border-[var(--k-line)] rounded-md bg-[var(--k-paper)] min-h-[60px]">
                  {tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-[var(--k-bg-2)] text-[12.5px]">
                      {t}<button className="text-[var(--k-ink-3)] hover:text-[var(--k-ink)]"><Icon name="x" size={10}/></button>
                    </span>
                  ))}
                </div>
              </Field>

              {/* Category, Price, Materials */}
              <div className="grid grid-cols-3 gap-5">
                <Field label="Etsy category" hint="Digital Downloads">
                  <select className="k-input"><option>Art &amp; Collectibles › Prints › Digital Prints</option></select>
                </Field>
                <Field label="Price (USD)">
                  <div className="flex gap-2">
                    <input className="k-input k-tnum" defaultValue="14.00"/>
                    <select className="k-input !w-24"><option>USD</option></select>
                  </div>
                </Field>
                <Field label="Materials">
                  <input className="k-input" defaultValue="digital download, printable, instant download"/>
                </Field>
              </div>

              {/* DIGITAL FILE TYPES CHECKLIST — required by §3 + A5 brief */}
              <Field
                label="Digital file types included"
                hint="Operator confirms what's inside the ZIP delivered to the buyer">
                <div className="grid grid-cols-5 gap-2">
                  {["ZIP","PNG","PDF","JPG","JPEG"].map(ft => (
                    <button key={ft}
                      onClick={()=>setFileTypes(s => ({...s, [ft]: !s[ft]}))}
                      className={`flex items-center gap-2.5 h-12 px-3 rounded-md border transition-all ${fileTypes[ft] ? "border-[var(--k-orange)] bg-[var(--k-orange-soft)]" : "border-[var(--k-line)] bg-[var(--k-paper)] hover:border-[var(--k-line-strong)]"}`}>
                      <Checkbox checked={fileTypes[ft]} onChange={()=>setFileTypes(s => ({...s, [ft]: !s[ft]}))}/>
                      <span className="k-mono text-[11.5px] font-semibold tracking-[0.1em]" style={{color: fileTypes[ft] ? "var(--k-orange-ink)" : "var(--k-ink-2)"}}>{ft}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-3">
                  <div className="text-[11.5px] text-[var(--k-ink-3)]">Per-file resolution &amp; dimensions configured in <a href="#files" className="text-[var(--k-blue)] hover:underline">Files tab</a> — current package: 25 files · 84 MB total.</div>
                </div>
              </Field>

              {/* Instant download + license */}
              <div className="grid grid-cols-2 gap-5">
                <Field label="Instant download">
                  <ToggleRow label="Buyer downloads immediately after purchase" defaultOn/>
                  <ToggleRow label="Watermark preview before purchase"/>
                </Field>
                <Field label="Commercial license (optional)">
                  <textarea className="k-input" rows={3} defaultValue="Personal use only. Commercial use requires extended license — contact shop."/>
                </Field>
              </div>
            </div>

            {/* Right rail · listing health */}
            <aside className="border-l border-[var(--k-line)] bg-[var(--k-bg-2)]/50 p-6 space-y-5">
              <div>
                <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">Listing health</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="k-display text-[36px] font-semibold tracking-tight">86</span>
                  <span className="text-[14px] text-[var(--k-ink-3)]">/100</span>
                </div>
                <div className="mt-2 k-progress"><div className="k-progress__bar" style={{right:"14%"}}/></div>
                <div className="mt-1 k-mono text-[10.5px] text-[var(--k-ink-3)] uppercase tracking-wider">Strong listing</div>
              </div>
              <div className="space-y-2">
                <Check ok>Title between 70-140 chars</Check>
                <Check ok>13 / 13 tags filled</Check>
                <Check ok>Description over 160 chars</Check>
                <Check>Add 2 more lifestyle mockups for stronger preview</Check>
                <Check>Set primary listing photo</Check>
              </div>
              <div className="border-t border-[var(--k-line)] pt-5">
                <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">Etsy linked shop</div>
                <div className="mt-2 flex items-center gap-2 p-2.5 rounded-md bg-[var(--k-paper)] border border-[var(--k-line)]">
                  <div className="w-6 h-6 rounded bg-[#F1641E] flex items-center justify-center text-white text-[10px] font-bold">E</div>
                  <div className="flex-1 min-w-0"><div className="text-[12.5px] font-medium truncate">HuskoBroStudio</div><div className="k-mono text-[10px] text-[var(--k-ink-3)]">Connected · 14 drafts</div></div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {tab === "mockups" && (
          <div className="p-8 space-y-8">
            <MockupSection title="Lifestyle Mockups" count={4} primaryIdx={0} kinds={["nursery","poster","landscape","abstract"]}/>
            <MockupSection title="Bundle Preview Sheets" count={2} kinds={["clipart","poster"]}/>
            <MockupSection title="My Templates" count={2} kinds={["riso","sticker"]}/>
          </div>
        )}

        {tab === "files" && (
          <div className="p-8">
            <div className="mb-5 grid grid-cols-3 gap-3">
              <Stat label="Files" value="25"/>
              <Stat label="Total size" value="84 MB"/>
              <Stat label="Largest" value="ZIP · 36 MB"/>
            </div>
            <div className="mb-4 border-2 border-dashed border-[var(--k-line-strong)] rounded-lg p-6 text-center bg-[var(--k-paper)]">
              <Icon name="upload" size={20} className="text-[var(--k-ink-3)] mx-auto"/>
              <div className="mt-2 text-[13px] font-medium">Drop files to add or replace</div>
              <div className="k-mono text-[10.5px] text-[var(--k-ink-3)] mt-1 uppercase tracking-wider">PNG · PDF · ZIP · JPG · JPEG</div>
            </div>
            <div className="k-card overflow-hidden">
              <table className="w-full">
                <thead><tr>{["File","Format","Size","Resolution",""].map((h,i)=>(<th key={i} className="text-left px-4 py-2.5 k-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-[var(--k-ink-3)] border-b border-[var(--k-line)] bg-[var(--k-bg-2)]">{h}</th>))}</tr></thead>
                <tbody>
                  {[
                    ["wreath_set_full.zip","ZIP","36.2 MB","All assets bundled"],
                    ["wreath_01_4096.png","PNG","4.4 MB","4096 × 4096 · 300 DPI"],
                    ["wreath_01_print.pdf","PDF","2.1 MB","A3 · 300 DPI"],
                    ["wreath_02_4096.png","PNG","4.6 MB","4096 × 4096 · 300 DPI"],
                    ["wreath_02_print.pdf","PDF","2.0 MB","A3 · 300 DPI"],
                    ["wreath_03_4096.png","PNG","4.5 MB","4096 × 4096 · 300 DPI"],
                  ].map((r,i)=>(
                    <tr key={i} className="border-b border-[var(--k-line-soft)] last:border-b-0 hover:bg-[var(--k-bg-2)]/40">
                      <td className="px-4 py-3 text-[13px] font-medium">{r[0]}</td>
                      <td className="px-4 py-3"><Badge tone={r[1] === "ZIP" ? "accent" : r[1] === "PDF" ? "info" : "neutral"}>{r[1]}</Badge></td>
                      <td className="px-4 py-3 k-mono text-[12px] tabular-nums">{r[2]}</td>
                      <td className="px-4 py-3 text-[12.5px] text-[var(--k-ink-2)]">{r[3]}</td>
                      <td className="px-4 py-3 text-right"><Btn variant="ghost" size="sm">Replace</Btn><Btn variant="ghost" size="sm">Remove</Btn></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="p-8 max-w-[760px]">
            <div className="space-y-1">
              {[
                {t:"2025-11-04 14:22:11", e:"Listing draft sent to Etsy", d:"Draft #2841 created", tone:"info"},
                {t:"2025-11-04 14:18:03", e:"Mockup added", d:"Living room scene · ml_204"},
                {t:"2025-11-03 09:11:54", e:"Listing fields edited", d:"Title, tags, description"},
                {t:"2025-11-02 17:05:22", e:"Mockup primary swapped", d:"From ml_201 → ml_204"},
                {t:"2025-11-02 16:50:17", e:"Files replaced", d:"5 PNG re-exported at 4096px"},
                {t:"2025-11-01 10:02:48", e:"Product created from selection", d:"selection_8h4z · 12 designs"},
              ].map((h,i)=>(
                <div key={i} className="flex gap-4 py-3 border-b border-[var(--k-line-soft)]">
                  <span className="k-mono text-[11px] text-[var(--k-ink-3)] tabular-nums whitespace-nowrap pt-0.5">{h.t}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{h.e}</div>
                    <div className="k-mono text-[11px] text-[var(--k-ink-3)] mt-0.5">{h.d}</div>
                  </div>
                  {h.tone && <Badge tone={h.tone} dot>Etsy</Badge>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, hintTone, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-[12.5px] font-semibold text-[var(--k-ink)]">{label}</label>
        {hint && <span className="k-mono text-[10.5px] uppercase tracking-[0.12em]" style={{color: hintTone === "success" ? "var(--k-green)" : "var(--k-ink-3)"}}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function ToggleRow({ label, defaultOn }) {
  const [on, setOn] = React.useState(!!defaultOn);
  return (
    <button onClick={()=>setOn(!on)} className="flex items-center justify-between w-full p-2.5 rounded-md bg-[var(--k-paper)] border border-[var(--k-line)] mb-2 last:mb-0">
      <span className="text-[12.5px]">{label}</span>
      <span className={`relative w-9 h-5 rounded-full transition-colors ${on ? "bg-[var(--k-orange)]" : "bg-[var(--k-line-strong)]"}`}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{left: on ? 18 : 2}}/>
      </span>
    </button>
  );
}
function Check({ ok, children }) {
  return (
    <div className="flex items-start gap-2 text-[12.5px]">
      <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${ok ? "bg-[var(--k-green-soft)] text-[var(--k-green)]" : "bg-[var(--k-amber-soft)] text-[var(--k-amber)]"}`}>
        {ok ? <Icon name="check" size={10} strokeWidth={2.5}/> : <span className="block w-1 h-1 rounded-full bg-current"/>}
      </span>
      <span className={ok ? "text-[var(--k-ink-2)]" : "text-[var(--k-ink)]"}>{children}</span>
    </div>
  );
}
function Stat({ label, value }) {
  return (
    <div className="k-card p-4">
      <div className="k-mono text-[10px] uppercase tracking-[0.14em] text-[var(--k-ink-3)]">{label}</div>
      <div className="k-display text-[24px] font-semibold mt-1.5 tracking-tight">{value}</div>
    </div>
  );
}
function MockupSection({ title, count, kinds, primaryIdx }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <div className="k-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--k-ink-3)] mt-0.5">{count} applied</div>
        </div>
        <Btn variant="secondary" size="sm" icon={<Icon name="plus" size={12}/>}>Add more</Btn>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {kinds.map((k, i) => (
          <div key={i} className={`k-card overflow-hidden ${i === primaryIdx ? "k-ring-selected" : ""}`}>
            <div className="relative">
              <div className="p-2 pb-0"><div className="k-thumb" data-kind={k} style={{aspectRatio:"3/2"}}/></div>
              <div className="absolute top-3 left-3 cursor-grab text-[var(--k-ink-3)]"><Icon name="drag" size={14}/></div>
              {i === primaryIdx && <div className="absolute top-3 right-3"><Badge tone="accent" dot>Primary</Badge></div>}
            </div>
            <div className="p-3.5">
              <div className="text-[12.5px] font-medium leading-tight">Mockup {String(i+1).padStart(2,"0")}</div>
              <div className="k-mono text-[10px] text-[var(--k-ink-3)] tracking-wider mt-0.5 uppercase">3:2 · {title.split(" ")[0]}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

Object.assign(window, { A5ProductDetail });
