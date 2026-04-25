/**
 * dashboard-page.test.tsx — T-31
 *
 * Dashboard widget grid migrasyonu test sözleşmesi
 * (`docs/design/implementation-notes/dashboard-widgets.md`).
 *
 * Server component (`src/app/(app)/dashboard/page.tsx`) async function ve
 * `requireUser` + Prisma çağrıları içerir; bu testler page'i bütün olarak
 * render etmek yerine page'in compose ettiği client component parçalarını
 * (StatRow / RecentJobsCard / RecentReferencesCard / RecentCollectionsGrid +
 * DashboardQuickActions yerleşimi) doğrular.
 *
 * Senaryolar (kilitli liste — dashboard-widgets.md):
 *  1. 4 stat kart render (Bookmark/Referans/Koleksiyon/Aktif job sayıları)
 *  2. "Aktif job" stat'ı QUEUED + RUNNING sayar (FAILED hariç)
 *  3. Son işler kartı: 5 satır + status badge tone matrisi
 *  4. Son referanslar kartı: 4 thumb grid (5'ten az ise placeholder)
 *  5. Son koleksiyonlar grid: 4 kart, bookmark/reference count görünür
 *  6. DashboardQuickActions korundu (regresyon)
 *  7. Empty state: tüm sayılar 0 + listeler boş → 4 kart 0 + "yok" mesajları
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DashboardStatRow } from "@/features/dashboard/components/stat-row";
import {
  RecentJobsCard,
  type DashboardJob,
} from "@/features/dashboard/components/recent-jobs-card";
import { RecentReferencesCard } from "@/features/dashboard/components/recent-references-card";
import { RecentCollectionsGrid } from "@/features/dashboard/components/recent-collections-grid";

beforeEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function makeJobs(): DashboardJob[] {
  const now = new Date();
  return [
    { id: "j1", type: "scrape_competitor", status: "QUEUED", createdAt: now },
    { id: "j2", type: "generate_variations", status: "RUNNING", createdAt: now },
    { id: "j3", type: "review_design", status: "SUCCESS", createdAt: now },
    { id: "j4", type: "create_mockup", status: "FAILED", createdAt: now },
    { id: "j5", type: "push_etsy_draft", status: "CANCELLED", createdAt: now },
  ];
}

describe("DashboardStatRow", () => {
  it("4 stat kart render eder (Bookmark/Referans/Koleksiyon/Aktif job)", () => {
    render(
      <DashboardStatRow
        bookmarkCount={12}
        referenceCount={7}
        collectionCount={3}
        activeJobCount={2}
      />,
    );
    const row = screen.getByTestId("dashboard-stat-row");
    expect(row).toBeInTheDocument();
    expect(within(row).getAllByRole("link")).toHaveLength(4);
    expect(screen.getByTestId("stat-card-Bookmark")).toBeInTheDocument();
    expect(screen.getByTestId("stat-card-Referans")).toBeInTheDocument();
    expect(screen.getByTestId("stat-card-Koleksiyon")).toBeInTheDocument();
    expect(screen.getByTestId("stat-card-Aktif job")).toBeInTheDocument();
    expect(screen.getByTestId("stat-value-Bookmark").textContent).toBe("12");
    expect(screen.getByTestId("stat-value-Referans").textContent).toBe("7");
    expect(screen.getByTestId("stat-value-Koleksiyon").textContent).toBe("3");
    expect(screen.getByTestId("stat-value-Aktif job").textContent).toBe("2");
  });

  it("'Aktif job' stat tonu accent (text-accent), diğerleri text-text", () => {
    render(
      <DashboardStatRow
        bookmarkCount={1}
        referenceCount={1}
        collectionCount={1}
        activeJobCount={1}
      />,
    );
    expect(
      screen.getByTestId("stat-value-Aktif job").className,
    ).toMatch(/text-accent/);
    expect(
      screen.getByTestId("stat-value-Bookmark").className,
    ).toMatch(/text-text\b/);
    expect(
      screen.getByTestId("stat-value-Bookmark").className,
    ).not.toMatch(/text-accent/);
  });

  it("stat kart Link className'inde focus-visible ring tokenları (klavye a11y)", () => {
    render(
      <DashboardStatRow
        bookmarkCount={0}
        referenceCount={0}
        collectionCount={0}
        activeJobCount={0}
      />,
    );
    const link = screen.getByTestId("stat-card-Bookmark");
    // Token disiplini: focus-visible:ring-accent + ring-offset-bg.
    expect(link.className).toMatch(/focus-visible:ring-2/);
    expect(link.className).toMatch(/focus-visible:ring-accent/);
    expect(link.className).toMatch(/focus-visible:ring-offset-2/);
    expect(link.className).toMatch(/focus-visible:ring-offset-bg/);
  });

  it("4 kart grid layout (sm:grid-cols-2 lg:grid-cols-4) ve mikro grafik yok", () => {
    const { container } = render(
      <DashboardStatRow
        bookmarkCount={0}
        referenceCount={0}
        collectionCount={0}
        activeJobCount={0}
      />,
    );
    const row = screen.getByTestId("dashboard-stat-row");
    expect(row.className).toMatch(/grid-cols-1/);
    expect(row.className).toMatch(/sm:grid-cols-2/);
    expect(row.className).toMatch(/lg:grid-cols-4/);
    // CP-7 wave kuralı: sparkline / progress / svg trend yok
    expect(container.querySelector("svg.sparkline")).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });
});

describe("RecentJobsCard", () => {
  it("5 satır render eder ve status badge tone matrisi doğru", () => {
    render(<RecentJobsCard jobs={makeJobs()} />);
    const rows = screen.getAllByTestId("recent-jobs-row");
    expect(rows).toHaveLength(5);

    // Tone matrisi (Badge primitive class'ları üzerinden):
    // QUEUED neutral → bg-surface-2
    // RUNNING accent → bg-accent-soft
    // SUCCESS success → bg-success-soft
    // FAILED danger → bg-danger-soft
    // CANCELLED neutral → bg-surface-2
    const queuedBadge = within(rows[0]!).getByText("QUEUED");
    const runningBadge = within(rows[1]!).getByText("RUNNING");
    const successBadge = within(rows[2]!).getByText("SUCCESS");
    const failedBadge = within(rows[3]!).getByText("FAILED");
    const cancelledBadge = within(rows[4]!).getByText("CANCELLED");

    expect(queuedBadge.className).toMatch(/bg-surface-2/);
    expect(runningBadge.className).toMatch(/bg-accent-soft/);
    expect(successBadge.className).toMatch(/bg-success-soft/);
    expect(failedBadge.className).toMatch(/bg-danger-soft/);
    expect(cancelledBadge.className).toMatch(/bg-surface-2/);
  });

  it("empty state: 'Henüz job çalışmadı.' mesajı render eder", () => {
    render(<RecentJobsCard jobs={[]} />);
    expect(screen.getByText("Henüz job çalışmadı.")).toBeInTheDocument();
    expect(screen.queryAllByTestId("recent-jobs-row")).toHaveLength(0);
  });

  it("header etiketi 'son 5 iş' (sözleşme: take:5, zaman filtresi yok)", () => {
    render(<RecentJobsCard jobs={makeJobs()} />);
    // Etiket "son 24 saat" yanıltıcıydı; sorgu zaman filtresi yapmıyor,
    // sadece take:5. Etiket take:5 ile birebir uyumlu olmalı.
    expect(screen.getByText("son 5 iş")).toBeInTheDocument();
    expect(screen.queryByText("son 24 saat")).toBeNull();
  });
});

describe("'Aktif job' sayımı (QUEUED + RUNNING, FAILED hariç)", () => {
  it("page-level filter: QUEUED + RUNNING sayar, FAILED/SUCCESS/CANCELLED hariç", () => {
    const jobs = makeJobs();
    const activeCount = jobs.filter(
      (j) => j.status === "QUEUED" || j.status === "RUNNING",
    ).length;
    expect(activeCount).toBe(2);
    render(
      <DashboardStatRow
        bookmarkCount={0}
        referenceCount={0}
        collectionCount={0}
        activeJobCount={activeCount}
      />,
    );
    expect(screen.getByTestId("stat-value-Aktif job").textContent).toBe("2");
  });
});

describe("RecentReferencesCard", () => {
  it("4 thumb grid render eder; 5'ten az ise placeholder eklenir", () => {
    const refs = [
      { id: "r1", title: "Boho Wall Art" },
      { id: "r2", title: "Nursery Print" },
    ];
    render(<RecentReferencesCard references={refs} />);
    const thumbs = screen.getAllByTestId("recent-references-thumb");
    const placeholders = screen.getAllByTestId("recent-references-placeholder");
    expect(thumbs).toHaveLength(2);
    expect(placeholders).toHaveLength(2);
    expect(thumbs.length + placeholders.length).toBe(4);
  });

  it("5+ referans verilse bile 4 ile sınırlanır (slice(0,4))", () => {
    const refs = Array.from({ length: 6 }, (_, i) => ({
      id: `r${i}`,
      title: `Ref ${i}`,
    }));
    render(<RecentReferencesCard references={refs} />);
    expect(screen.getAllByTestId("recent-references-thumb")).toHaveLength(4);
    expect(screen.queryAllByTestId("recent-references-placeholder")).toHaveLength(
      0,
    );
  });

  it("CTA 'Referans havuzuna git' /references'a link verir", () => {
    render(<RecentReferencesCard references={[]} />);
    const cta = screen.getByText("Referans havuzuna git");
    expect(cta.getAttribute("href")).toBe("/references");
  });

  it("empty state: 'Henüz referans yok.' mesajı render eder", () => {
    render(<RecentReferencesCard references={[]} />);
    expect(screen.getByText("Henüz referans yok.")).toBeInTheDocument();
  });
});

describe("RecentCollectionsGrid", () => {
  it("4 kart grid render eder, bookmark/reference count görünür", () => {
    const collections = [
      {
        id: "c1",
        name: "Christmas Wall Art",
        kind: "MIXED" as const,
        createdAt: new Date(),
        _count: { bookmarks: 3, references: 2 },
      },
      {
        id: "c2",
        name: "Nursery Clipart",
        kind: "REFERENCE" as const,
        createdAt: new Date(),
        _count: { bookmarks: 0, references: 7 },
      },
      {
        id: "c3",
        name: "Halloween Stickers",
        kind: "BOOKMARK" as const,
        createdAt: new Date(),
        _count: { bookmarks: 4, references: 0 },
      },
      {
        id: "c4",
        name: "Boho Canvas",
        kind: "MIXED" as const,
        createdAt: new Date(),
        _count: { bookmarks: 1, references: 1 },
      },
    ];
    render(<RecentCollectionsGrid collections={collections} />);
    expect(screen.getByText("Son koleksiyonlar")).toBeInTheDocument();
    // Mevcut CollectionCard count'u "X bookmark/referans/kayıt" formatıyla
    // render eder. MIXED toplamı: 3+2 = 5 kayıt.
    expect(screen.getByText("Christmas Wall Art")).toBeInTheDocument();
    expect(screen.getByText("Nursery Clipart")).toBeInTheDocument();
    expect(screen.getByText("Halloween Stickers")).toBeInTheDocument();
    expect(screen.getByText("Boho Canvas")).toBeInTheDocument();
    expect(screen.getByText("5 kayıt")).toBeInTheDocument();
    expect(screen.getByText("7 referans")).toBeInTheDocument();
    expect(screen.getByText("4 bookmark")).toBeInTheDocument();
  });

  it("5+ koleksiyon verilse bile 4 ile sınırlanır (slice(0,4))", () => {
    const collections = Array.from({ length: 6 }, (_, i) => ({
      id: `c${i}`,
      name: `Coll ${i}`,
      kind: "MIXED" as const,
      createdAt: new Date(),
      _count: { bookmarks: 1, references: 1 },
    }));
    render(<RecentCollectionsGrid collections={collections} />);
    // Son koleksiyon kartı (idx 4 ve 5) görünmemeli.
    expect(screen.queryByText("Coll 4")).toBeNull();
    expect(screen.queryByText("Coll 5")).toBeNull();
    expect(screen.getByText("Coll 0")).toBeInTheDocument();
    expect(screen.getByText("Coll 3")).toBeInTheDocument();
  });

  it("empty state: 'Koleksiyon henüz yok.' mesajı render eder", () => {
    render(<RecentCollectionsGrid collections={[]} />);
    expect(screen.getByText("Koleksiyon henüz yok.")).toBeInTheDocument();
  });
});

describe("Empty state — full dashboard composition", () => {
  it("tüm sayılar 0 + listeler boş → 4 kart 0 gösterir, listeler 'yok' mesajları", () => {
    const { unmount: u1 } = render(
      <DashboardStatRow
        bookmarkCount={0}
        referenceCount={0}
        collectionCount={0}
        activeJobCount={0}
      />,
    );
    expect(screen.getByTestId("stat-value-Bookmark").textContent).toBe("0");
    expect(screen.getByTestId("stat-value-Referans").textContent).toBe("0");
    expect(screen.getByTestId("stat-value-Koleksiyon").textContent).toBe("0");
    expect(screen.getByTestId("stat-value-Aktif job").textContent).toBe("0");
    u1();

    const { unmount: u2 } = render(<RecentJobsCard jobs={[]} />);
    expect(screen.getByText("Henüz job çalışmadı.")).toBeInTheDocument();
    u2();

    const { unmount: u3 } = render(<RecentReferencesCard references={[]} />);
    expect(screen.getByText("Henüz referans yok.")).toBeInTheDocument();
    u3();

    render(<RecentCollectionsGrid collections={[]} />);
    expect(screen.getByText("Koleksiyon henüz yok.")).toBeInTheDocument();
  });
});

describe("DashboardQuickActions yerleşim regresyonu", () => {
  it("page kompozisyonu: QuickActions stat row ile iki kolon arasında durmalı", async () => {
    // Page server component (async) ve `requireUser` + Prisma çağırır;
    // direkt render edilemez. Bunun yerine page kaynak metnini okuyup
    // composition order'ını statik kontrol ederiz.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/(app)/dashboard/page.tsx"),
      "utf8",
    );
    const idxStat = src.indexOf("DashboardStatRow");
    const idxQa = src.indexOf("DashboardQuickActions");
    const idxJobs = src.indexOf("RecentJobsCard");
    const idxRefs = src.indexOf("RecentReferencesCard");
    const idxColls = src.indexOf("RecentCollectionsGrid");

    // Tüm parçalar mevcut olmalı.
    expect(idxStat).toBeGreaterThan(-1);
    expect(idxQa).toBeGreaterThan(-1);
    expect(idxJobs).toBeGreaterThan(-1);
    expect(idxRefs).toBeGreaterThan(-1);
    expect(idxColls).toBeGreaterThan(-1);

    // composition order: stat row → QuickActions → iki kolon → koleksiyonlar
    // (idxQa, importun referansı değil JSX render referansı olabilir; bu
    // yüzden son geçişin pozisyonunu alıyoruz)
    const lastStat = src.lastIndexOf("<DashboardStatRow");
    const lastQa = src.lastIndexOf("<DashboardQuickActions");
    const lastJobs = src.lastIndexOf("<RecentJobsCard");
    const lastRefs = src.lastIndexOf("<RecentReferencesCard");
    const lastColls = src.lastIndexOf("<RecentCollectionsGrid");

    expect(lastStat).toBeLessThan(lastQa);
    expect(lastQa).toBeLessThan(lastJobs);
    expect(lastQa).toBeLessThan(lastRefs);
    expect(Math.max(lastJobs, lastRefs)).toBeLessThan(lastColls);

    // Eski "Son Bookmark'lar" section'ı silinmiş olmalı.
    expect(src).not.toContain("Son Bookmark");
    expect(src).not.toContain("recentBookmarks");
  });
});
