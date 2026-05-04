import type { UserRole } from "@prisma/client";
import {
  LayoutDashboard,
  Sparkles,
  Store,
  Bookmark,
  Image as ImageIcon,
  FolderOpen,
  Wand2,
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

export const USER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard, roles: ["USER", "ADMIN"], phase: 1, enabled: true },
  { href: "/trend-stories", label: "Trend Akışı", icon: Sparkles, roles: ["USER", "ADMIN"], phase: 4, enabled: true },
  { href: "/competitors", label: "Rakipler", icon: Store, roles: ["USER", "ADMIN"], phase: 3, enabled: true },
  { href: "/bookmarks", label: "Bookmark", icon: Bookmark, roles: ["USER", "ADMIN"], phase: 2, enabled: true },
  { href: "/references", label: "Referanslar", icon: ImageIcon, roles: ["USER", "ADMIN"], phase: 2, enabled: true },
  { href: "/collections", label: "Koleksiyonlar", icon: FolderOpen, roles: ["USER", "ADMIN"], phase: 2, enabled: true },
  { href: "/variations", label: "Üret", icon: Wand2, roles: ["USER", "ADMIN"], phase: 5, enabled: false },
  { href: "/review", label: "Review", icon: ShieldCheck, roles: ["USER", "ADMIN"], phase: 6, enabled: true },
  { href: "/selection", label: "Seçim", icon: Layers, roles: ["USER", "ADMIN"], phase: 7, enabled: true },
  { href: "/mockups", label: "Mockup", icon: Frame, roles: ["USER", "ADMIN"], phase: 8, enabled: false },
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
