// Phase 7 Task 24 — CreateSetModal TDD test sözleşmesi.
//
// Spec Section 3.1 + plan Task 24:
//   - Manuel "Yeni set oluştur" → küçük modal (Quick start'tan farklı)
//   - Zorunlu name input (trim min 1)
//   - Submit → POST /api/selection/sets → redirect /selection/sets/[id]
//   - Error inline (role=alert), modal açık kalır, retry mümkün
//   - Cancel + Escape → onOpenChange(false), name state temizlenir
//
// Pattern: confirm-dialog.test + bulk-approve-dialog.test paterni.
// Radix Dialog Portal jsdom'da document.body'e mount eder; matchMedia mock'u
// Radix animasyonları için gerekli.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

beforeEach(() => {
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

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

import { CreateSetModal } from "@/features/selection/components/CreateSetModal";

function wrap(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  pushMock.mockReset();
  vi.spyOn(global, "fetch").mockReset?.();
});

describe("CreateSetModal — render & default state", () => {
  it("open=false → modal DOM'da yok", () => {
    wrap(<CreateSetModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Yeni set oluştur")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=true → başlık + input + İptal/Oluştur butonları görünür", () => {
    wrap(<CreateSetModal open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Yeni set oluştur")).toBeInTheDocument();
    expect(screen.getByLabelText(/set adı/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^İptal$/ })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Oluştur$/ }),
    ).toBeInTheDocument();
  });

  it("input autoFocus uygulanır (initial focus)", () => {
    wrap(<CreateSetModal open onOpenChange={vi.fn()} />);
    const input = screen.getByLabelText(/set adı/i);
    expect(document.activeElement).toBe(input);
  });
});

describe("CreateSetModal — name validation", () => {
  it("empty name → 'Oluştur' disabled", () => {
    wrap(<CreateSetModal open onOpenChange={vi.fn()} />);
    const submit = screen.getByRole("button", { name: /^Oluştur$/ });
    expect(submit).toBeDisabled();
  });

  it("whitespace-only name (boşluk + tab) → 'Oluştur' disabled", () => {
    wrap(<CreateSetModal open onOpenChange={vi.fn()} />);
    const input = screen.getByLabelText(/set adı/i);
    fireEvent.change(input, { target: { value: "   \t  " } });
    const submit = screen.getByRole("button", { name: /^Oluştur$/ });
    expect(submit).toBeDisabled();
  });

  it("valid name 'abc' → 'Oluştur' enabled", () => {
    wrap(<CreateSetModal open onOpenChange={vi.fn()} />);
    const input = screen.getByLabelText(/set adı/i);
    fireEvent.change(input, { target: { value: "abc" } });
    const submit = screen.getByRole("button", { name: /^Oluştur$/ });
    expect(submit).not.toBeDisabled();
  });

  it("' abc ' → trim sonrası valid → 'Oluştur' enabled", () => {
    wrap(<CreateSetModal open onOpenChange={vi.fn()} />);
    const input = screen.getByLabelText(/set adı/i);
    fireEvent.change(input, { target: { value: " abc " } });
    const submit = screen.getByRole("button", { name: /^Oluştur$/ });
    expect(submit).not.toBeDisabled();
  });
});

describe("CreateSetModal — submit", () => {
  it("Oluştur tıklanınca POST /api/selection/sets çağrılır (trimmed name)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ set: { id: "set-1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    wrap(<CreateSetModal open onOpenChange={vi.fn()} />);
    const input = screen.getByLabelText(/set adı/i);
    fireEvent.change(input, { target: { value: "  Boho Wall Art  " } });
    fireEvent.click(screen.getByRole("button", { name: /^Oluştur$/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe("/api/selection/sets");
    const init = call[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Boho Wall Art" });
  });

  it("success → router.push('/selection/sets/{id}') + onOpenChange(false)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ set: { id: "set-42" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onOpenChange = vi.fn();

    wrap(<CreateSetModal open onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText(/set adı/i), {
      target: { value: "Nursery print" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Oluştur$/ }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/selection/sets/set-42");
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submit pending → 'Oluşturuluyor...' label + input/butonlar disabled", async () => {
    let resolve: ((value: unknown) => void) | undefined;
    const pending = new Promise((r) => {
      resolve = r;
    });
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    wrap(<CreateSetModal open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/set adı/i), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Oluştur$/ }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Oluşturuluyor/i }),
      ).toBeInTheDocument();
    });
    const submit = screen.getByRole("button", { name: /Oluşturuluyor/i });
    expect(submit).toBeDisabled();
    const cancel = screen.getByRole("button", { name: /^İptal$/ });
    expect(cancel).toBeDisabled();
    const input = screen.getByLabelText(/set adı/i) as HTMLInputElement;
    expect(input).toBeDisabled();

    // Sızıntı önleme — promise'i resolve et.
    resolve?.({ ok: true, json: async () => ({ set: { id: "z" } }) });
  });

  it("400 error → inline alert görünür, modal açık kalır, retry mümkün", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Geçersiz istek" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ set: { id: "s2" } }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const onOpenChange = vi.fn();

    wrap(<CreateSetModal open onOpenChange={onOpenChange} />);
    fireEvent.change(screen.getByLabelText(/set adı/i), {
      target: { value: "x" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Oluştur$/ }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert").textContent).toMatch(/Geçersiz istek/);
    // Modal hâlâ açık (onOpenChange(false) çağrılmamış olmalı).
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // Retry: ikinci tıklama success akışını çalıştırır.
    fireEvent.click(screen.getByRole("button", { name: /^Oluştur$/ }));
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/selection/sets/s2");
    });
  });
});

describe("CreateSetModal — cancel & escape", () => {
  it("İptal butonu → onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    wrap(<CreateSetModal open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^İptal$/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Escape tuşu → onOpenChange(false)", () => {
    const onOpenChange = vi.fn();
    wrap(<CreateSetModal open onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
