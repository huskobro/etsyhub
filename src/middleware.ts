import { NextResponse, type NextRequest } from "next/server";

/**
 * Kivasy IA migration redirects (rollout-1).
 *
 * Old top-level surfaces collapse into the new 8-item / 2-group nav. We
 * preserve old URLs as 308 permanent redirects so existing bookmarks /
 * deep-links keep working through the rollout.
 *
 * Source: docs/IMPLEMENTATION_HANDOFF.md §10 rollout-1.
 *
 * Strategy:
 * - `/dashboard`              → `/overview`
 * - `/listings*`              → `/products*`
 * - `/admin/midjourney/library`     → `/library`
 * - `/admin/midjourney/batches*`    → `/batches*`
 * - `/admin/midjourney/kept`        → `/selections?view=all-kept`
 * - `/admin/midjourney/templates*`  → `/templates*`
 * - `/admin/midjourney/preferences` → `/settings`
 * - `/admin/midjourney/batch-run`   → `/batches?action=new`
 *
 * Out of scope here:
 * - Old Bookmark / Reference / Trend / Competitor / Collection top-level
 *   routes survive untouched in rollout-1; rollout-6 consolidates them
 *   under `/references`. Their redirects land then.
 * - Auth + admin gating already handled inside (app)/(admin) layouts.
 */

const REDIRECT_MAP: Array<[RegExp, (url: URL) => string]> = [
  // Exact matches first
  [/^\/dashboard\/?$/, () => "/overview"],
  [/^\/admin\/midjourney\/library\/?$/, () => "/library"],
  [/^\/admin\/midjourney\/preferences\/?$/, () => "/settings"],
  [/^\/admin\/midjourney\/kept\/?$/, () => "/selections?view=all-kept"],
  [/^\/admin\/midjourney\/batch-run\/?$/, () => "/batches?action=new"],

  // Prefix rewrites
  [/^\/admin\/midjourney\/batches(\/.*)?$/, (url) => url.pathname.replace("/admin/midjourney/batches", "/batches") + url.search],
  [/^\/admin\/midjourney\/templates(\/.*)?$/, (url) => url.pathname.replace("/admin/midjourney/templates", "/templates") + url.search],

  // /listings/draft/[id] → /products/[id]; /listings → /products
  [/^\/listings\/draft\/([^/]+)\/?$/, (url) => {
    const match = url.pathname.match(/^\/listings\/draft\/([^/]+)\/?$/);
    return match ? `/products/${match[1]}${url.search}` : "/products";
  }],
  [/^\/listings(\/.*)?$/, (url) => url.pathname.replace(/^\/listings/, "/products") + url.search],
];

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const path = url.pathname;

  for (const [pattern, target] of REDIRECT_MAP) {
    if (pattern.test(path)) {
      const dest = target(url);
      const redirectUrl = new URL(dest, request.url);
      // Preserve any query params not already encoded into the target
      if (!dest.includes("?")) {
        redirectUrl.search = url.search;
      }
      return NextResponse.redirect(redirectUrl, 308);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/listings",
    "/listings/:path*",
    "/admin/midjourney/library",
    "/admin/midjourney/preferences",
    "/admin/midjourney/kept",
    "/admin/midjourney/batch-run",
    "/admin/midjourney/batches/:path*",
    "/admin/midjourney/batches",
    "/admin/midjourney/templates/:path*",
    "/admin/midjourney/templates",
  ],
};
