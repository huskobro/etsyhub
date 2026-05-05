import type { UserRole } from "@prisma/client";
import {
  LayoutDashboard,
  Sparkles,
  Store,
  Bookmark,
  Image as ImageIcon,
  FolderOpen,
  ShieldCheck,
  Layers,
  Frame,
  ListChecks,
  Settings as SettingsIcon,
  Shield,
  Globe2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  enabled: boolean;
};

// Pass 18 — `Üret` (Phase 5) ve `Mockup` (Phase 8) sidebar'dan kaldırıldı.
// Pre-Pass 18: bu iki menü `enabled: false` + `P5`/`P8` rozeti ile görünüyordu;
// kullanıcı pasif görünce "henüz yapılmamış" sanıyordu fakat akış zaten aktif:
//   - Variation üretimi: `/references/[id]/variations` (reference detail launch)
//   - Mockup üretimi: `/selection/sets/[setId]/mockup/apply` (selection set launch)
// Top-level catalog sayfası tasarımca yok (intentional). Pasif menü misleading
// olduğu için tamamen kaldırıldı; entry point'ler zaten aktif menülerden akıyor:
// References (variations launch) → Review → Seçim (mockup launch) → Listingler.
export const USER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard, roles: ["USER", "ADMIN"], phase: 1, enabled: true },
  { href: "/trend-stories", label: "Trend Akışı", icon: Sparkles, roles: ["USER", "ADMIN"], phase: 4, enabled: true },
  { href: "/competitors", label: "Rakipler", icon: Store, roles: ["USER", "ADMIN"], phase: 3, enabled: true },
  { href: "/bookmarks", label: "Bookmark", icon: Bookmark, roles: ["USER", "ADMIN"], phase: 2, enabled: true },
  { href: "/references", label: "Referanslar", icon: ImageIcon, roles: ["USER", "ADMIN"], phase: 2, enabled: true },
  { href: "/collections", label: "Koleksiyonlar", icon: FolderOpen, roles: ["USER", "ADMIN"], phase: 2, enabled: true },
  { href: "/review", label: "Review", icon: ShieldCheck, roles: ["USER", "ADMIN"], phase: 6, enabled: true },
  { href: "/selection", label: "Seçim", icon: Layers, roles: ["USER", "ADMIN"], phase: 7, enabled: true },
  { href: "/listings", label: "Listingler", icon: ListChecks, roles: ["USER", "ADMIN"], phase: 9, enabled: true },
  { href: "/settings", label: "Ayarlar", icon: SettingsIcon, roles: ["USER", "ADMIN"], phase: 1, enabled: true },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Admin", icon: Shield, roles: ["ADMIN"], phase: 1, enabled: true },
  { href: "/admin/scraper-providers", label: "Scraper Providers", icon: Globe2, roles: ["ADMIN"], phase: 3, enabled: true },
  { href: "/admin/mockup-templates", label: "Mockup Templates", icon: Frame, roles: ["ADMIN"], phase: 8, enabled: true },
];

export function navForRole(role: UserRole): NavItem[] {
  return [...USER_NAV, ...(role === "ADMIN" ? ADMIN_NAV : [])].filter((n) => n.roles.includes(role));
}
