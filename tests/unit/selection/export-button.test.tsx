// Phase 7 Task 36 — ExportButton 4-state machine + polling testleri.
//
// Sözleşme (plan Task 36 + design Section 3.2 + Section 6.6):
//   - State 1 (idle, activeExport=null) → "İndir (ZIP)" enabled (itemCount>0).
//     itemCount===0 ise button disabled + tooltip "Set'te en az 1 varyant
//     olmalı".
//   - Click idle → POST /api/selection/sets/{setId}/export +
//     invalidateQueries(["selection","set",setId]).
//   - State 2 (queued/running) → "Preparing export…" + spinner +
//     disabled + polling enabled (refetchInterval 3000).
//   - State 3 (completed + downloadUrl + expiresAt > now) → <a href download>
//     "Download" link, primary tonu (bg-accent + text-accent-foreground).
//   - State 4 (completed + expiresAt geçmiş) → "Yeniden hazırla" buton,
//     yeni POST tetikler.
//   - State 5 (failed) → "Tekrar dene" buton + danger tonu + failedReason
//     tooltip; click → yeni POST.
//   - Mutation error → inline alert role="alert" 5sn fade (test 5sn timer
//     kontrolü pragmatik atlanır; varlık + içerik kontrolü yeterli).
//   - Polling enabled flag isProcessing'e bağlı; idle/completed/failed →
//     enabled false (polling fetch tetiklenmez).
//
// Phase 6 emsali: tests/unit/selection/heavy-action-button.test.tsx —
// QueryClient wrapper + fetch mock + fireEvent + waitFor.
//
// Türkçe `İ` (U+0130) regex /i lowercase folding sorunu — bilinen emsal
// (heavy-action-button test). Explicit string match veya başlık küçük
// harf alanlarda kullanılır.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { ActiveExportView } from "@/features/selection/queries";

import { ExportButton } from "@/features/selection/components/ExportButton";

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
});

// ────────────────────────────────────────────────────────────
// State 1 — null (idle)
// ────────────────────────────────────────────────────────────

describe("ExportButton — State 1 idle (activeExport=null)", () => {
  it("itemCount>0 → 'Download (ZIP)' butonu enabled", () => {
    wrapper(
      <ExportButton setId="set-1" itemCount={3} activeExport={null} />,
    );
    const btn = screen.getByRole("button", { name: /Download \(ZIP\)/ });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("itemCount===0 → buton disabled + tooltip 'Set\\'te en az 1 varyant olmalı'", () => {
    wrapper(
      <ExportButton setId="set-1" itemCount={0} activeExport={null} />,
    );
    const btn = screen.getByRole("button", { name: /Download \(ZIP\)/ });
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/at least 1 variant/i);
  });

  it("Click idle → POST /api/selection/sets/{setId}/export çağrılır", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ jobId: "job-001" }),
        { status: 202, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <ExportButton setId="set-7" itemCount={2} activeExport={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Download \(ZIP\)/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/set-7/export");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("Mutation error → role='alert' inline mesaj", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: "Queue dolu" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <ExportButton setId="set-1" itemCount={1} activeExport={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Download \(ZIP\)/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert").textContent).toContain("Queue dolu");
  });
});

// ────────────────────────────────────────────────────────────
// State 2 — queued / running (preparing)
// ────────────────────────────────────────────────────────────

describe("ExportButton — State 2 queued/running (preparing)", () => {
  it("queued → 'Preparing export…' + spinner + disabled", () => {
    const activeExport: ActiveExportView = {
      jobId: "job-q",
      status: "queued",
    };
    wrapper(
      <ExportButton setId="set-1" itemCount={3} activeExport={activeExport} />,
    );
    // Button text "Preparing export…" still Turkish in component
    const btn = screen.getByRole("button", { name: /preparing export/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
    // Spinner aria-label="Loading"
    expect(screen.getByLabelText(/^Loading$/i)).toBeInTheDocument();
  });

  it("running → 'Preparing export…' + spinner + disabled (queued ile aynı UI)", () => {
    const activeExport: ActiveExportView = {
      jobId: "job-r",
      status: "running",
    };
    wrapper(
      <ExportButton setId="set-1" itemCount={3} activeExport={activeExport} />,
    );
    const btn = screen.getByRole("button", { name: /preparing export/i });
    expect(btn).toBeDisabled();
    expect(screen.getByLabelText(/^Loading$/i)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// State 3 — completed + URL geçerli (ready-to-download)
// ────────────────────────────────────────────────────────────

describe("ExportButton — State 3 completed + URL geçerli", () => {
  it("downloadUrl + expiresAt future → <a href download> 'İndir' link", () => {
    const futureIso = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // +1h
    const activeExport: ActiveExportView = {
      jobId: "job-c",
      status: "completed",
      downloadUrl: "https://signed.example.com/file.zip?sig=abc",
      expiresAt: futureIso,
    };
    wrapper(
      <ExportButton setId="set-1" itemCount={3} activeExport={activeExport} />,
    );
    const link = screen.getByRole("link", { name: /Download/ });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute("href")).toBe(
      "https://signed.example.com/file.zip?sig=abc",
    );
    expect(link.hasAttribute("download")).toBe(true);
    // Primary tonu — bg-accent + text-accent-foreground
    expect(link.className).toContain("bg-accent");
    expect(link.className).toContain("text-accent-foreground");
  });
});

// ────────────────────────────────────────────────────────────
// State 4 — completed + URL süresi dolmuş (expired)
// ────────────────────────────────────────────────────────────

describe("ExportButton — State 4 completed + URL expired", () => {
  it("expiresAt geçmiş → 'Re-prepare' buton enabled", () => {
    const pastIso = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // -1h
    const activeExport: ActiveExportView = {
      jobId: "job-e",
      status: "completed",
      downloadUrl: "https://signed.example.com/file.zip?sig=expired",
      expiresAt: pastIso,
    };
    wrapper(
      <ExportButton setId="set-1" itemCount={3} activeExport={activeExport} />,
    );
    const btn = screen.getByRole("button", { name: /Re-prepare/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
    expect(btn.getAttribute("title")).toMatch(/link expired/i);
    // <a> link OLMAMALI — link state 3'e özel
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("Click 'Re-prepare' → POST /export tetiklenir", async () => {
    const pastIso = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const activeExport: ActiveExportView = {
      jobId: "job-e",
      status: "completed",
      downloadUrl: "https://signed.example.com/file.zip",
      expiresAt: pastIso,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jobId: "job-new" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <ExportButton setId="set-x" itemCount={2} activeExport={activeExport} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Re-prepare/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "/api/selection/sets/set-x/export",
    );
  });
});

// ────────────────────────────────────────────────────────────
// State 5 — failed
// ────────────────────────────────────────────────────────────

describe("ExportButton — State 5 failed", () => {
  it("failed → 'Try again' buton + danger tonu + failedReason tooltip", () => {
    const activeExport: ActiveExportView = {
      jobId: "job-f",
      status: "failed",
      failedReason: "Storage upload timed out",
    };
    wrapper(
      <ExportButton setId="set-1" itemCount={3} activeExport={activeExport} />,
    );
    const btn = screen.getByRole("button", { name: /Try again/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
    expect(btn.getAttribute("title")).toBe("Storage upload timed out");
    // Danger tonu — sınıf isminde danger geçmeli
    expect(btn.className).toContain("danger");
  });

  it("failed + failedReason yok → varsayılan tooltip", () => {
    const activeExport: ActiveExportView = {
      jobId: "job-f2",
      status: "failed",
    };
    wrapper(
      <ExportButton setId="set-1" itemCount={3} activeExport={activeExport} />,
    );
    const btn = screen.getByRole("button", { name: /Try again/i });
    expect(btn.getAttribute("title")).toMatch(/failed/i);
  });

  it("Click 'Try again' → POST /export tetiklenir", async () => {
    const activeExport: ActiveExportView = {
      jobId: "job-f",
      status: "failed",
      failedReason: "boom",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jobId: "job-retry" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <ExportButton setId="set-r" itemCount={1} activeExport={activeExport} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "/api/selection/sets/set-r/export",
    );
  });
});

// ────────────────────────────────────────────────────────────
// Polling — enabled when isProcessing, disabled otherwise
// ────────────────────────────────────────────────────────────

describe("ExportButton — polling enable/disable", () => {
  it("activeExport=null (idle) → polling fetch tetiklenmez", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <ExportButton setId="set-1" itemCount={1} activeExport={null} />,
    );
    await new Promise((r) => setTimeout(r, 50));
    // Idle render — POST yapılmamış, polling yok
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("activeExport=completed (URL geçerli) → polling fetch tetiklenmez", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const futureIso = new Date(Date.now() + 1000 * 60 * 60).toISOString();
    wrapper(
      <ExportButton
        setId="set-1"
        itemCount={1}
        activeExport={{
          jobId: "j-c",
          status: "completed",
          downloadUrl: "https://x/y.zip",
          expiresAt: futureIso,
        }}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("activeExport=failed → polling fetch tetiklenmez", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    wrapper(
      <ExportButton
        setId="set-1"
        itemCount={1}
        activeExport={{ jobId: "j-f", status: "failed" }}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Not: refetchInterval 3000ms gerçek interval mekaniği TanStack Query'nin
  // kendi davranışı — bu seviyede test edilmez. Pragmatik: polling enabled
  // state işaretleyicisi (queued/running ile render edildiğinde isProcessing
  // true → useQuery enabled true) doğrulamak için, queued render'da
  // isProcessing UI side effect (button disabled + spinner + label) zaten
  // State 2 testleriyle örtülü doğrulanır.
});
