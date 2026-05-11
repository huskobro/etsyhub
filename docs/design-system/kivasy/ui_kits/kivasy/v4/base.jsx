/* global React */
const { useState } = React;

/* ─────────── Inline icon set ─────────── */
const PATHS = {
  home:"M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z",
  inbox:"M21 13h-5l-2 3h-4l-2-3H3M5.5 5.5 3 13v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6L18.5 5.5A2 2 0 0 0 16.7 4.5H7.3a2 2 0 0 0-1.8 1z",
  zap:"M13 3 4 14h7l-1 7 9-12h-7l1-6z",
  image:"M4 5h16v14H4zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM20 16l-5-5L8 18",
  layers:"M12 3 3 7.5 12 12l9-4.5zM3 12.5 12 17l9-4.5M3 17.5 12 22l9-4.5",
  package:"M16.5 7.5 8.5 4 4 6l8 4 8-4-3.5-1.5zM4 6v11l8 4 8-4V6M12 10v11",
  book:"M5 19V5a2 2 0 0 1 2-2h12v18H7a2 2 0 0 0-2 2",
  settings:"M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a8 8 0 0 0 .1-3l1.8-1.4-2-3.5-2.1.7a8 8 0 0 0-2.6-1.5L14 4h-4l-.6 2.3a8 8 0 0 0-2.6 1.5l-2.1-.7-2 3.5L4.5 12a8 8 0 0 0 .1 3l-1.8 1.4 2 3.5 2.1-.7a8 8 0 0 0 2.6 1.5L10 23h4l.6-2.3a8 8 0 0 0 2.6-1.5l2.1.7 2-3.5z",
  search:"M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3",
  plus:"M12 5v14M5 12h14",
  filter:"M4 5h16l-6 8v6l-4 1v-7z",
  upload:"M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M16 9l-4-4-4 4M12 5v12",
  sparkle:"M12 4v6M12 14v6M4 12h6M14 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3",
  arrow:"M5 12h14M13 5l7 7-7 7",
  arrowL:"M19 12H5M11 5l-7 7 7 7",
  check:"M5 12l5 5L20 7",
  chevron:"M9 6l6 6-6 6",
  chevronD:"M6 9l6 6 6-6",
  more:"M5 12h.01M12 12h.01M19 12h.01",
  download:"M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M8 11l4 4 4-4M12 15V3",
  user:"M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  bell:"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9zM10 21a2 2 0 0 0 4 0",
  trash:"M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M7 7l1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13",
  retry:"M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5",
  x:"M6 6l12 12M18 6l-12 12",
  copy:"M9 9h10v10H9zM5 15V5a2 2 0 0 1 2-2h10",
  list:"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  grid:"M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  star:"M12 3l2.6 5.5L20 9.3l-4 4 1 5.7-5-2.7-5 2.7 1-5.7-4-4 5.4-.8z",
  bookmark:"M6 3h12v18l-6-4-6 4z",
  drag:"M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  send:"M22 2L11 13M22 2l-7 20-4-9-9-4z",
  eye:"M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  link:"M9 17H7a5 5 0 1 1 0-10h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8",
  pin:"M12 2v6.5L8 12l4 3.5V22M8 8h8M8 16h8",
  mountain:"M2 21l7-12 4 6 3-4 6 10z",
  duplicate:"M8 8h12v12H8zM4 16V4h12",
};
const Icon = ({ name, size = 16, className = "", style, strokeWidth = 1.5 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
       className={className} style={style} aria-hidden="true">
    <path d={PATHS[name] || PATHS.home}/>
  </svg>
);

/* ─────────── Brand ─────────── */
function KivasyMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="km4-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F58450"/><stop offset="0.55" stopColor="#E85D25"/><stop offset="1" stopColor="#C9491A"/>
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#km4-fill)"/>
      <rect x="0.5" y="0.5" width="39" height="39" rx="9.5" fill="none" stroke="rgba(255,255,255,0.20)"/>
      <g fill="#FFFFFF">
        <rect x="10" y="9" width="3" height="22" rx="1.2"/>
        <path d="M13.2 19.6 23.2 9 27.5 9 17.5 19.6 27.8 31 23.4 31 13.2 20.4 Z"/>
        <circle cx="29.8" cy="29" r="1.6" opacity="0.85"/>
      </g>
    </svg>
  );
}
function KivasyWord({ size = 20 }) {
  return <span className="k-wordmark" style={{ fontSize: size, lineHeight: 1 }}>Kivasy<span style={{color:"var(--k-orange)"}}>.</span></span>;
}

/* ─────────── Atoms ─────────── */
function Btn({ variant = "secondary", size = "md", icon, iconRight, children, ...rest }) {
  return (
    <button {...rest} data-size={size} className={`k-btn k-btn--${variant} ${rest.className || ""}`}>
      {icon}{children}{iconRight}
    </button>
  );
}
function IconBtn({ icon, size, ...rest }) {
  return <button {...rest} data-size={size} className="k-iconbtn">{icon}</button>;
}
function Badge({ tone = "neutral", dot, children }) {
  return <span className="k-badge" data-tone={tone}>{dot && <span className="dot"/>}{children}</span>;
}
function Chip({ active, children, caret, onClick }) {
  return <button onClick={onClick} className={`k-chip ${active ? "k-chip--active":""}`}>{children}{caret && <Icon name="chevronD" size={11} className="k-chip__caret"/>}</button>;
}
function Checkbox({ checked, mixed, onChange }) {
  return (
    <span className="k-checkbox" data-checked={checked || undefined} data-mixed={mixed || undefined} onClick={(e)=>{e.stopPropagation(); onChange?.(!checked);}}>
      {checked && !mixed && <Icon name="check" size={11} strokeWidth={2.5}/>}
      {mixed && <span style={{width:8,height:1.5,background:"#fff",borderRadius:1}}/>}
    </span>
  );
}
function Kbd({ children }) { return <span className="k-kbd k-tnum">{children}</span>; }

/* ─────────── Sidebar ─────────── */
function Sidebar({ active }) {
  const produce = [
    { id: "overview",   label: "Overview",   icon: "home" },
    { id: "references", label: "References", icon: "inbox", count: 86 },
    { id: "batches",    label: "Batches",    icon: "zap", count: 3, pulse: true },
    { id: "library",    label: "Library",    icon: "image", count: "1.2k" },
    { id: "selections", label: "Selections", icon: "layers", count: 12 },
    { id: "products",   label: "Products",   icon: "package", count: 24 },
  ];
  const system = [
    { id: "templates", label: "Templates", icon: "book" },
    { id: "settings",  label: "Settings",  icon: "settings" },
  ];
  const Item = (it) => {
    const isActive = active === it.id;
    return (
      <a key={it.id} href={`#${it.id}`} className={`k-nav ${isActive ? "k-nav--active":""}`} style={{textDecoration:"none"}}>
        <span className="k-nav__icon" style={{ color: isActive ? "var(--k-orange)" : "var(--k-ink-3)" }}>
          <Icon name={it.icon} size={15}/>
        </span>
        <span className="flex-1">{it.label}</span>
        {it.pulse && (
          <span style={{position:"relative", width:6, height:6}}>
            <span style={{position:"absolute", inset:0, borderRadius:999, background:"var(--k-amber)"}}/>
            <span style={{position:"absolute", inset:-2, borderRadius:999, background:"var(--k-amber)", opacity:0.35, animation:"k-ping 1.6s infinite ease-out"}}/>
          </span>
        )}
        {it.count != null && <span className="k-nav__count k-tnum">{it.count}</span>}
      </a>
    );
  };
  return (
    <aside className="k-sidebar h-screen flex flex-col flex-shrink-0">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <KivasyMark size={32}/><KivasyWord size={20}/>
      </div>
      <div className="px-3 pb-3">
        <button className="w-full flex items-center gap-2 h-9 px-3 rounded-lg border border-[var(--k-line)] bg-white/60 hover:bg-white transition-colors">
          <span className="w-5 h-5 rounded bg-gradient-to-br from-[#5E2819] to-[#C1582C] flex items-center justify-center k-mono text-[9px] font-semibold text-white">HB</span>
          <span className="text-[13px] font-medium flex-1 text-left truncate">Husko Bro Studio</span>
          <Icon name="chevronD" size={12} className="text-[var(--k-ink-3)]"/>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pb-3">
        <div className="k-section-label">Produce</div>
        <div className="space-y-0.5">{produce.map(Item)}</div>
        <div className="k-section-label">System</div>
        <div className="space-y-0.5">{system.map(Item)}</div>
      </div>
      <div className="px-3 pb-4 pt-3 border-t border-[var(--k-line)]">
        <div className="flex items-center gap-2.5 p-2 pr-1 rounded-lg hover:bg-white/60 transition-colors cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#E89B5B] to-[#8E3A12] flex items-center justify-center k-mono text-[10px] font-semibold text-white">HB</div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-medium leading-tight truncate">Husko Bro</div>
            <div className="k-mono text-[10px] text-[var(--k-ink-3)] mt-0.5 leading-none">Operator</div>
          </div>
          <button className="k-iconbtn !w-7 !h-7"><Icon name="more" size={14}/></button>
        </div>
      </div>
      <style>{`@keyframes k-ping{0%{transform:scale(.8);opacity:.7}100%{transform:scale(2);opacity:0}}`}</style>
    </aside>
  );
}

/* ─────────── Topbar ─────────── */
function Topbar({ back, title, subtitle, status, children }) {
  return (
    <header className="flex-shrink-0 flex items-center gap-4 h-16 pl-6 pr-5 border-b border-[var(--k-line)] bg-[var(--k-bg)]">
      {back && (
        <a href={`#${back.to}`} className="k-iconbtn"><Icon name="arrowL" size={15}/></a>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <h1 className="k-display text-[24px] font-semibold leading-none tracking-[-0.025em] truncate">{title}</h1>
          {subtitle && (
            <span className="k-mono text-[10.5px] text-[var(--k-ink-3)] tracking-wider uppercase whitespace-nowrap">{subtitle}</span>
          )}
          {status && <Badge tone={status.tone} dot>{status.label}</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </header>
  );
}

/* ─────────── Tab bars ─────────── */
function Tabs({ tabs, active, onChange }) {
  return (
    <div className="k-tabs">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange?.(t.id)} className={`k-tab ${active === t.id ? "k-tab--active":""}`}>
          {t.label}
          {t.count != null && <span className="k-tab__count k-tnum">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
function SiblingTabs({ tabs, active, onChange }) {
  return (
    <div className="k-stabs">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange?.(t.id)} className={`k-stab ${active === t.id ? "k-stab--active":""}`}>{t.label}</button>
      ))}
    </div>
  );
}

/* ─────────── Density toggle ─────────── */
function Density({ value, onChange }) {
  return (
    <div className="k-segment" role="group" aria-label="Density">
      <button aria-pressed={value === "comfortable"} onClick={() => onChange("comfortable")}>
        <Icon name="grid" size={11}/>Comfortable
      </button>
      <button aria-pressed={value === "dense"} onClick={() => onChange("dense")}>
        <Icon name="list" size={11}/>Dense
      </button>
    </div>
  );
}

/* ─────────── Bulk action floating bar ─────────── */
function FloatingBulk({ count, actions, onClear }) {
  return (
    <div className="k-fab">
      <span className="k-fab__count">{count} selected</span>
      {actions.map((a,i) => (
        <button key={i} onClick={a.onClick} className={`k-fab__btn ${a.primary ? "k-fab__btn--primary":""}`}>
          {a.icon}{a.label}
        </button>
      ))}
      <button onClick={onClear} className="k-fab__close" aria-label="Clear"><Icon name="x" size={14}/></button>
    </div>
  );
}

/* ─────────── Modal shell ─────────── */
function Modal({ title, onClose, rail, footer, children }) {
  return (
    <div className="k-overlay">
      <div className="k-modal">
        <div className="k-modal__header">
          <h2 className="text-[16px] font-semibold flex-1">{title}</h2>
          <button className="k-iconbtn" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
        </div>
        <div className="k-modal__body">
          <div className="k-modal__rail">{rail}</div>
          <div className="k-modal__main">{children}</div>
        </div>
        <div className="k-modal__footer">{footer}</div>
      </div>
    </div>
  );
}

Object.assign(window, { Icon, Btn, IconBtn, Badge, Chip, Checkbox, Kbd, Sidebar, Topbar, Tabs, SiblingTabs, Density, FloatingBulk, Modal, KivasyMark, KivasyWord });
