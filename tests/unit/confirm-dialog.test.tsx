import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Radix Dialog Portal jsdom'da document.body'e mount eder.
// Ayrıca window.matchMedia Radix animasyonları için mock gerekebilir.
beforeEach(() => {
  // matchMedia mock
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

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  title: "Test başlığı",
  description: "Test açıklaması",
  confirmLabel: "Sil",
  cancelLabel: "Vazgeç",
  onConfirm: vi.fn(),
};

describe("ConfirmDialog", () => {
  it("open=false iken dialog DOM'da yok", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Test başlığı")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("open=true iken title, description ve iki buton render eder", () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText("Test başlığı")).toBeInTheDocument();
    expect(screen.getByText("Test açıklaması")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vazgeç" })).toBeInTheDocument();
  });

  it("Türkçe label'lar bozulmadan render eder", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        title="Koleksiyonu arşivle"
        description="Bu koleksiyon arşivlenecek. İçindeki bookmark'ların bağlantısı kopar."
        confirmLabel="Arşivle"
        cancelLabel="Vazgeç"
      />,
    );
    expect(screen.getByText("Koleksiyonu arşivle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arşivle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vazgeç" })).toBeInTheDocument();
    // Türkçe karakterler bozulmamış mı?
    expect(screen.getByText(/İçindeki/)).toBeInTheDocument();
    expect(screen.getByText(/bağlantısı/)).toBeInTheDocument();
  });

  it("Cancel butonuna click → onOpenChange(false) çağrılır; onConfirm çağrılmaz", () => {
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Confirm butonuna click → onConfirm çağrılır", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Sil" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("busy=true iken confirm butonu disabled olur", () => {
    render(<ConfirmDialog {...defaultProps} busy />);
    const confirmBtn = screen.getByRole("button", { name: /Çalışıyor/i });
    expect(confirmBtn).toBeDisabled();
  });

  it("busy=true iken onOpenChange overlay/ESC ile çağrılmaz", () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        busy
      />,
    );
    // Radix Dialog'un ESC tuşu ile kapanmasını simüle et
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("tone=destructive → confirm butonunda bg-danger class var", () => {
    render(<ConfirmDialog {...defaultProps} tone="destructive" />);
    const btn = screen.getByRole("button", { name: "Sil" });
    expect(btn.className).toContain("bg-danger");
  });

  it("tone=warning → confirm butonunda bg-warning class var", () => {
    render(
      <ConfirmDialog {...defaultProps} tone="warning" confirmLabel="Aktifleştir" />,
    );
    const btn = screen.getByRole("button", { name: "Aktifleştir" });
    expect(btn.className).toContain("bg-warning");
  });

  it("tone=neutral → confirm butonunda bg-accent class var", () => {
    render(
      <ConfirmDialog {...defaultProps} tone="neutral" confirmLabel="Güncelle" />,
    );
    const btn = screen.getByRole("button", { name: "Güncelle" });
    expect(btn.className).toContain("bg-accent");
  });

  it("errorMessage dolu iken role=alert banner ve 'Tekrar dene' label render eder", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        errorMessage="Sunucu 500 verdi"
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Sunucu 500 verdi");
    // confirmLabel yerine "Tekrar dene" görünmeli
    expect(screen.getByRole("button", { name: "Tekrar dene" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sil" })).not.toBeInTheDocument();
  });

  it("errorMessage=null iken alert banner DOM'da yok, orijinal confirmLabel görünür", () => {
    render(<ConfirmDialog {...defaultProps} errorMessage={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sil" })).toBeInTheDocument();
  });
});
