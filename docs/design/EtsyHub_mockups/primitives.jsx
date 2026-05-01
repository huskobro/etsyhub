/* global React */
// EtsyHub primitives — Bölüm A.2 UI Language Kit'in canlı implementasyonu.
// Hepsi token-first. Arbitrary value yok. Editoryal kokpit yönü.

// ─── Icons (inline SVG, monoline stroke=1.75) ─────────────────────
const Icon = ({ d, size = 16, stroke = 1.75, fill = "none", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden>
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);
const I = {
  search:  <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3" />,
  plus:    <Icon d="M12 5v14M5 12h14" />,
  filter:  <Icon d="M3 5h18M6 12h12M10 19h4" />,
  grid:    <Icon d={<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>} />,
  list:    <Icon d="M4 6h16M4 12h16M4 18h16" />,
  chevR:   <Icon d="M9 6l6 6-6 6" />,
  chevD:   <Icon d="M6 9l6 6 6-6" />,
  more:    <Icon d={<><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></>} fill="currentColor" stroke="none" />,
  bookmark: <Icon d="M7 3h10v18l-5-4-5 4V3z" />,
  check:   <Icon d="M4 12l5 5L20 6" />,
  x:       <Icon d="M6 6l12 12M18 6L6 18" />,
  alert:   <Icon d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z" />,
  trash:   <Icon d="M4 7h16M10 11v6M14 11v6M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M9 7V4h6v3" />,
  folder:  <Icon d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
  image:   <Icon d={<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></>} />,
  sparkle: <Icon d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />,
  home:    <Icon d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9z" />,
  trend:   <Icon d="M3 17l6-6 4 4 8-8M14 7h7v7" />,
  wand:    <Icon d="M15 4l5 5M4 20l11-11 5 5L9 25zM3 7h2M3 11h2M19 3v2M23 3v2" />,
  store:   <Icon d="M3 7l2-4h14l2 4M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7M3 7h18M8 21v-6h8v6" />,
  layers:  <Icon d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />,
  settings:<Icon d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>} />,
  user:    <Icon d={<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>} />,
  shield:  <Icon d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />,
  bolt:    <Icon d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />,
  mock:    <Icon d={<><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 18h18M8 22h8"/></>} />,
  send:    <Icon d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  download:<Icon d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  inbox:   <Icon d="M3 13l4-10h10l4 10M3 13v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6M3 13h5l2 3h4l2-3h5" />,
  flag:    <Icon d="M4 21V4M4 4h13l-2 4 2 4H4" />,
  eye:     <Icon d={<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>} />,
  dots:    <Icon d={<><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></>} fill="currentColor" stroke="none" />,
};

// ─── Button ──────────────────────────────────────────────────────
function Button({ variant = "secondary", size = "md", icon, iconRight, loading, children, ...rest }) {
  const sz = {
    sm: { h: 28, pad: "0 10px", fs: 13 },
    md: { h: 34, pad: "0 14px", fs: 14 },
    lg: { h: 40, pad: "0 18px", fs: 15 },
  }[size];
  const variants = {
    primary: {
      background: "var(--color-accent)", color: "var(--color-text-invert)",
      border: "1px solid var(--color-accent)",
    },
    secondary: {
      background: "var(--color-surface)", color: "var(--color-text)",
      border: "1px solid var(--color-border)",
    },
    ghost: {
      background: "transparent", color: "var(--color-text)",
      border: "1px solid transparent",
    },
    destructive: {
      background: "var(--color-surface)", color: "var(--color-danger)",
      border: "1px solid var(--color-border)",
    },
  }[variant];
  const iconOnly = !children;
  return (
    <button {...rest} style={{
      ...variants, height: sz.h, padding: iconOnly ? 0 : sz.pad,
      width: iconOnly ? sz.h : undefined,
      fontSize: sz.fs, fontFamily: "var(--font-sans)", fontWeight: 500,
      borderRadius: "var(--radius-md)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      gap: 6, cursor: "pointer", letterSpacing: 0,
      transition: "background var(--dur-fast) var(--ease-out), border-color var(--dur-fast)",
      ...rest.style,
    }}
    onMouseOver={e => {
      if (variant === "primary") e.currentTarget.style.background = "var(--color-accent-hover)";
      else if (variant === "ghost") e.currentTarget.style.background = "var(--color-surface-2)";
      else e.currentTarget.style.borderColor = "var(--color-border-strong)";
    }}
    onMouseOut={e => { Object.assign(e.currentTarget.style, variants); }}>
      {icon}{children}{iconRight}
    </button>
  );
}

// ─── Badge / Chip ────────────────────────────────────────────────
function Badge({ tone = "neutral", children, dot }) {
  const tones = {
    neutral: { bg: "var(--color-surface-2)", fg: "var(--color-text-muted)", bd: "var(--color-border)" },
    accent:  { bg: "var(--color-accent-soft)", fg: "var(--color-accent-text)", bd: "transparent" },
    success: { bg: "var(--color-success-soft)", fg: "var(--color-success)", bd: "transparent" },
    warning: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)", bd: "transparent" },
    danger:  { bg: "var(--color-danger-soft)",  fg: "var(--color-danger)",  bd: "transparent" },
    info:    { bg: "var(--color-info-soft)",    fg: "var(--color-info)",    bd: "transparent" },
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      height: 20, padding: "0 8px",
      background: tones.bg, color: tones.fg,
      border: `1px solid ${tones.bd}`,
      borderRadius: "var(--radius-sm)",
      fontSize: 11, fontWeight: 500, fontFamily: "var(--font-mono)",
      letterSpacing: 0,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 99, background: tones.fg }}/>}
      {children}
    </span>
  );
}

// ─── Chip (filter/category) ──────────────────────────────────────
function Chip({ active, onRemove, children, ...rest }) {
  return (
    <span {...rest} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      height: 28, padding: onRemove ? "0 4px 0 10px" : "0 10px",
      background: active ? "var(--color-accent-soft)" : "var(--color-surface)",
      color: active ? "var(--color-accent-text)" : "var(--color-text)",
      border: `1px solid ${active ? "transparent" : "var(--color-border)"}`,
      borderRadius: "var(--radius-md)",
      fontSize: 13, fontWeight: 500, cursor: "pointer",
      ...rest.style,
    }}>
      {children}
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{ background: "none", border: "none", padding: 4, cursor: "pointer",
            color: "inherit", display: "flex", borderRadius: 3 }}>
          {I.x}
        </button>
      )}
    </span>
  );
}

// ─── Input ───────────────────────────────────────────────────────
function Input({ prefix, suffix, style, ...rest }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      height: 34, padding: "0 12px",
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)",
      transition: "border-color var(--dur-fast)",
      ...style,
    }}
    onFocusCapture={e => e.currentTarget.style.borderColor = "var(--color-accent)"}
    onBlurCapture={e => e.currentTarget.style.borderColor = "var(--color-border)"}>
      {prefix && <span style={{ color: "var(--color-text-subtle)", display: "flex" }}>{prefix}</span>}
      <input {...rest} style={{
        flex: 1, border: "none", outline: "none", background: "transparent",
        fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--color-text)",
        letterSpacing: 0, padding: 0,
      }}/>
      {suffix}
    </div>
  );
}

// ─── Card (generic surface) ──────────────────────────────────────
function Card({ children, interactive, style, ...rest }) {
  return (
    <div {...rest} style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-card)",
      transition: "border-color var(--dur-fast), box-shadow var(--dur-fast)",
      cursor: interactive ? "pointer" : "default",
      ...style,
    }}
    onMouseOver={e => {
      if (!interactive) return;
      e.currentTarget.style.borderColor = "var(--color-border-strong)";
      e.currentTarget.style.boxShadow = "0 4px 12px rgba(26,23,21,.07), 0 1px 2px rgba(26,23,21,.04)";
    }}
    onMouseOut={e => {
      if (!interactive) return;
      e.currentTarget.style.borderColor = "var(--color-border)";
      e.currentTarget.style.boxShadow = "var(--shadow-card)";
    }}>
      {children}
    </div>
  );
}

// ─── Thumbnail / Asset surface ───────────────────────────────────
// Etsy-flavored rich placeholders (wall art, boho, christmas, clipart)
// Token-pure CSS composition; no raster, no emoji.
function Thumb({ kind = "abstract", aspect = "var(--aspect-card)", label, style }) {
  const presets = {
    // warm abstract wall art
    abstract: {
      bg: "radial-gradient(ellipse at 30% 20%, #F2C9A3 0%, #E89B5B 35%, #C1582C 70%, #5E2819 100%)",
      accents: <>
        <div style={{position:"absolute", inset:"25% 20% 35% 30%", border:"1.5px solid rgba(255,245,230,.65)", borderRadius:"50%"}}/>
        <div style={{position:"absolute", inset:"45% 35% 20% 45%", background:"rgba(255,245,230,.35)", borderRadius:"50%"}}/>
      </>,
    },
    boho: {
      bg: "linear-gradient(180deg, #E8DBC5 0%, #C9A87A 100%)",
      accents: <>
        <div style={{position:"absolute", left:"50%", top:"20%", transform:"translateX(-50%)", width:50, height:50, borderRadius:"50%", border:"2px solid #5B3A1F"}}/>
        <div style={{position:"absolute", left:0, right:0, bottom:"15%", height:2, background:"#5B3A1F"}}/>
        <div style={{position:"absolute", left:"15%", bottom:"20%", right:"15%", height:14, background:"repeating-linear-gradient(90deg, #5B3A1F 0 3px, transparent 3px 8px)"}}/>
      </>,
    },
    christmas: {
      bg: "linear-gradient(180deg, #1E3A2E 0%, #0F2019 100%)",
      accents: <>
        <div style={{position:"absolute", left:"50%", top:"30%", transform:"translate(-50%,0)", width:0, height:0, borderLeft:"30px solid transparent", borderRight:"30px solid transparent", borderBottom:"50px solid #D4A040"}}/>
        <div style={{position:"absolute", left:"50%", bottom:"20%", transform:"translateX(-50%)", color:"#D4A040", fontFamily:"serif", fontSize:20, fontStyle:"italic"}}>Joy</div>
      </>,
    },
    nursery: {
      bg: "linear-gradient(180deg, #F5E8DC 0%, #E8D0B8 100%)",
      accents: <>
        <div style={{position:"absolute", left:"50%", top:"35%", transform:"translate(-50%,-50%)", width:55, height:40, borderRadius:"50% 50% 50% 50% / 60% 60% 40% 40%", background:"#C98B5E"}}/>
        <div style={{position:"absolute", left:"50%", top:"62%", transform:"translateX(-50%)", fontFamily:"Georgia,serif", fontSize:13, color:"#6B3A1F", fontStyle:"italic"}}>little one</div>
      </>,
    },
    clipart: {
      bg: "repeating-conic-gradient(#F3F2EC 0 25%, #FFF 0 50%) 0 0 / 16px 16px",
      accents: <>
        <div style={{position:"absolute", left:"20%", top:"22%", width:22, height:22, borderRadius:"50%", background:"#E85D25"}}/>
        <div style={{position:"absolute", left:"55%", top:"30%", width:28, height:28, background:"#2D5F8F", transform:"rotate(15deg)"}}/>
        <div style={{position:"absolute", left:"30%", top:"55%", width:0, height:0, borderLeft:"16px solid transparent", borderRight:"16px solid transparent", borderBottom:"26px solid #2F7A4B"}}/>
        <div style={{position:"absolute", left:"62%", top:"60%", width:24, height:24, borderRadius:"50%", background:"#D4A040"}}/>
      </>,
    },
    sticker: {
      bg: "#FBF8F2",
      accents: <>
        <div style={{position:"absolute", inset:"18% 18%", border:"3px solid #E85D25", borderRadius:"50%"}}/>
        <div style={{position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif", fontWeight:700, fontSize:22, color:"#E85D25"}}>GOOD<br/>VIBES</div>
      </>,
    },
    poster: {
      bg: "#F3EDE3",
      accents: <>
        <div style={{position:"absolute", inset:"12% 14%", border:"1.5px solid #2B2620", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif", color:"#2B2620"}}>
          <div style={{fontSize:10, letterSpacing:2}}>EST. 2026</div>
          <div style={{fontSize:28, fontWeight:700, marginTop:4}}>STAY</div>
          <div style={{fontSize:28, fontWeight:700, fontStyle:"italic"}}>wild</div>
        </div>
      </>,
    },
    // neutral striped fallback — admin/nötr yerler
    neutral: {
      bg: "repeating-linear-gradient(45deg, #F3F2EC 0 8px, #EBE9E2 8px 16px)",
      accents: label && <div style={{
        position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:"var(--font-mono)", fontSize:11, color:"var(--color-text-subtle)",
      }}>{label}</div>,
    },
    landscape: {
      bg: "linear-gradient(180deg, #C5D8E0 0%, #E8D4B8 55%, #8B6F4E 100%)",
      accents: <>
        <div style={{position:"absolute", left:0, right:0, bottom:"35%", height:2, background:"rgba(40,25,15,.3)"}}/>
        <div style={{position:"absolute", left:"25%", bottom:"35%", width:40, height:35, background:"#8B6F4E", clipPath:"polygon(50% 0, 100% 100%, 0 100%)"}}/>
        <div style={{position:"absolute", left:"55%", bottom:"35%", width:50, height:45, background:"#6B5238", clipPath:"polygon(50% 0, 100% 100%, 0 100%)"}}/>
      </>,
    },
  };
  const p = presets[kind] || presets.neutral;
  return (
    <div style={{
      position: "relative", width: "100%", aspectRatio: aspect,
      background: p.bg, borderRadius: "var(--radius-sm)",
      overflow: "hidden",
      ...style,
    }}>
      {p.accents}
    </div>
  );
}

// ─── State message (empty / error / warning) ─────────────────────
function StateMessage({ tone = "neutral", icon, title, body, action }) {
  const tones = {
    neutral: "var(--color-text-muted)",
    warning: "var(--color-warning)",
    error:   "var(--color-danger)",
  };
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "var(--space-12) var(--space-6)",
      textAlign: "center", gap: "var(--space-3)",
      color: tones[tone],
    }}>
      <div style={{
        width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "var(--radius-md)",
        background: tone === "neutral" ? "var(--color-surface-2)" :
                    tone === "warning" ? "var(--color-warning-soft)" : "var(--color-danger-soft)",
      }}>{icon}</div>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--color-text)" }}>{title}</div>
      {body && <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", maxWidth: 360 }}>{body}</div>}
      {action && <div style={{ marginTop: "var(--space-2)" }}>{action}</div>}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────
const SkelKF = `@keyframes ehPulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }`;
if (typeof document !== "undefined" && !document.getElementById("eh-skel-kf")) {
  const s = document.createElement("style"); s.id = "eh-skel-kf"; s.textContent = SkelKF; document.head.appendChild(s);
}
function Skeleton({ w = "100%", h = 12, r = 4, style }) {
  return <div style={{
    width: w, height: h, borderRadius: r,
    background: "var(--color-surface-3)",
    animation: "ehPulse 1.4s ease-in-out infinite",
    ...style,
  }}/>;
}

// ─── Sidebar item ────────────────────────────────────────────────
function NavItem({ icon, label, active, badge }) {
  return (
    <div style={{
      position: "relative",
      display: "flex", alignItems: "center", gap: 10,
      height: 32, padding: "0 10px 0 14px",
      borderRadius: "var(--radius-sm)",
      background: active ? "var(--color-surface)" : "transparent",
      color: active ? "var(--color-text)" : "var(--color-text-muted)",
      fontSize: 13, fontWeight: active ? 500 : 400,
      cursor: "pointer",
      boxShadow: active ? "var(--shadow-card)" : "none",
    }}>
      {active && <div style={{
        position: "absolute", left: 0, top: 6, bottom: 6, width: 2,
        background: "var(--color-accent)", borderRadius: 2,
      }}/>}
      <span style={{ display: "flex", color: active ? "var(--color-accent)" : "inherit" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && <span style={{
        fontSize: 11, fontFamily: "var(--font-mono)",
        color: "var(--color-text-subtle)",
      }}>{badge}</span>}
    </div>
  );
}

// Expose to global scope for cross-file access
Object.assign(window, {
  I, Icon, Button, Badge, Chip, Input, Card, Thumb, StateMessage, Skeleton, NavItem,
});
