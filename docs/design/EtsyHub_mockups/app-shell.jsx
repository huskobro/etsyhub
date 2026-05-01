/* global React, NavItem, I, Button, Badge, Chip, Input, Card, Thumb, StateMessage, Skeleton */

// EtsyHub app shell — sidebar + topbar + page container
// Editoryal kokpit: accent bar left sidebar, warm off-white canvas.

function Sidebar({ active = "Dashboard", scope = "user" }) {
  const userNav = [
    { group: "Üretim", items: [
      { icon: I.home, label: "Dashboard" },
      { icon: I.trend, label: "Trend Stories", badge: "12" },
      { icon: I.store, label: "Competitors" },
    ]},
    { group: "Kütüphane", items: [
      { icon: I.bookmark, label: "Bookmarks", badge: "84" },
      { icon: I.folder, label: "References", badge: "27" },
      { icon: I.layers, label: "Collections" },
    ]},
    { group: "Studio", items: [
      { icon: I.wand, label: "Variations" },
      { icon: I.eye, label: "Review Queue", badge: "3" },
      { icon: I.image, label: "Selection" },
      { icon: I.mock, label: "Mockups" },
      { icon: I.send, label: "Listings" },
    ]},
    { group: "", items: [
      { icon: I.settings, label: "Settings" },
    ]},
  ];
  const adminNav = [
    { group: "İzleme", items: [
      { icon: I.home, label: "Overview" },
      { icon: I.bolt, label: "Job Monitor", badge: "42" },
      { icon: I.flag, label: "Audit Logs" },
    ]},
    { group: "Kullanıcılar", items: [
      { icon: I.user, label: "Users" },
      { icon: I.store, label: "Stores" },
    ]},
    { group: "Sistem", items: [
      { icon: I.sparkle, label: "Prompt Templates" },
      { icon: I.layers, label: "Product Types" },
      { icon: I.shield, label: "Feature Flags" },
      { icon: I.settings, label: "Providers" },
    ]},
  ];
  const nav = scope === "admin" ? adminNav : userNav;

  return (
    <aside style={{
      width: "var(--sidebar-w)", flexShrink: 0,
      background: "var(--color-surface-2)",
      borderRight: "1px solid var(--color-border)",
      display: "flex", flexDirection: "column",
      height: "100%",
    }}>
      {/* Brand */}
      <div style={{
        height: 56, padding: "0 var(--space-4)",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--color-border-subtle)",
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 5,
          background: "var(--color-accent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13,
        }}>E</div>
        <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: 0 }}>EtsyHub</div>
        {scope === "admin" && (
          <div style={{ marginLeft: "auto", fontSize: 10, fontFamily: "var(--font-mono)",
            padding: "2px 6px", background: "var(--color-text)", color: "#fff",
            borderRadius: 3, textTransform: "uppercase", letterSpacing: 0.5 }}>admin</div>
        )}
      </div>

      {/* Store switcher (user only) */}
      {scope === "user" && (
        <div style={{ padding: "var(--space-3) var(--space-3) var(--space-2)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            height: 36, padding: "0 10px",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
          }}>
            <div style={{ width: 20, height: 20, borderRadius: 3,
              background: "linear-gradient(135deg, #E89B5B, #C1582C)" }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>BohoNestStudio</div>
              <div style={{ fontSize: 10, color: "var(--color-text-subtle)", fontFamily: "var(--font-mono)" }}>etsy · 847 listings</div>
            </div>
            <span style={{ color: "var(--color-text-subtle)" }}>{I.chevD}</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <div style={{ flex: 1, overflow: "auto", padding: "var(--space-2) var(--space-2) var(--space-4)" }}>
        {nav.map((grp, gi) => (
          <div key={gi} style={{ marginTop: grp.group ? "var(--space-4)" : "var(--space-2)" }}>
            {grp.group && <div style={{
              padding: "0 10px 6px 14px", fontSize: 10,
              fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: 0.8,
              color: "var(--color-text-subtle)",
            }}>{grp.group}</div>}
            {grp.items.map(item => (
              <NavItem key={item.label} {...item} active={item.label === active}/>
            ))}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div style={{
        borderTop: "1px solid var(--color-border-subtle)",
        padding: "var(--space-3)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%",
          background: "var(--color-surface-3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600 }}>HC</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500 }}>Hüseyin Coşkun</div>
          <div style={{ fontSize: 10, color: "var(--color-text-subtle)" }}>{scope === "admin" ? "Sistem yöneticisi" : "Üretici"}</div>
        </div>
      </div>
    </aside>
  );
}

function PageShell({ active, scope = "user", title, subtitle, actions, toolbar, children, bg }) {
  return (
    <div data-density={scope} className="eh-app" style={{
      display: "flex", height: "100%", width: "100%",
      background: bg || "var(--color-bg)",
    }}>
      <Sidebar active={active} scope={scope}/>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <div style={{
          height: 56, flexShrink: 0,
          display: "flex", alignItems: "center", gap: 16,
          padding: "0 var(--page-pad)",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-bg)",
        }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0 }}>
            <div style={{ fontSize: "var(--text-2xl)", fontWeight: 600, letterSpacing: 0, lineHeight: 1.2 }}>
              {title}
            </div>
            {subtitle && <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>{subtitle}</div>}
          </div>
          {actions && <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{actions}</div>}
        </div>

        {/* Toolbar (optional) */}
        {toolbar && (
          <div style={{
            flexShrink: 0,
            padding: "var(--space-3) var(--page-pad)",
            borderBottom: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg)",
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          }}>{toolbar}</div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "var(--page-pad)" }}>
          {children}
        </div>
      </main>
    </div>
  );
}

Object.assign(window, { Sidebar, PageShell });
