/**
 * admin-toggle.test.tsx
 *
 * Toggle yerel yardımcı sözleşmesi (brief 5.1 — carry-forward #1).
 * Sözleşme: on, onChange, size?, disabled?
 *
 * Senaryolar:
 *   1. on=true → aria-checked="true" + bg-accent track
 *   2. on=false → aria-checked="false" + bg-border track
 *   3. click → onChange(!on) çağrılır
 *   4. disabled → click no-op + opacity-50 + cursor-not-allowed
 *   5. size="sm" → küçük track/thumb dimensions
 *   6. size="md" (default) → medium dimensions
 *   7. role="switch" + ekran okuyucu uyumlu
 *   8. aria-label prop forward edilir
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toggle } from "@/features/admin/_shared/toggle";

describe("admin Toggle", () => {
  it("on=true → aria-checked='true' ve bg-accent track", () => {
    render(<Toggle on={true} onChange={() => {}} aria-label="aktif" />);
    const sw = screen.getByRole("switch", { name: "aktif" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw.className).toContain("bg-accent");
  });

  it("on=false → aria-checked='false' ve bg-border track", () => {
    render(<Toggle on={false} onChange={() => {}} aria-label="pasif" />);
    const sw = screen.getByRole("switch", { name: "pasif" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(sw.className).toContain("bg-border");
  });

  it("click → onChange(!on) çağrılır", () => {
    const onChange = vi.fn();
    render(<Toggle on={false} onChange={onChange} aria-label="x" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);

    onChange.mockReset();
    render(<Toggle on={true} onChange={onChange} aria-label="y" />);
    fireEvent.click(screen.getByRole("switch", { name: "y" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("disabled → click no-op + opacity/cursor sınıfları", () => {
    const onChange = vi.fn();
    render(
      <Toggle on={false} onChange={onChange} disabled aria-label="z" />,
    );
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    expect(onChange).not.toHaveBeenCalled();
    expect(sw).toBeDisabled();
    expect(sw.className).toContain("disabled:opacity-50");
    expect(sw.className).toContain("disabled:cursor-not-allowed");
  });

  it("size='sm' → küçük track ve thumb dimensions", () => {
    render(<Toggle on={false} onChange={() => {}} size="sm" aria-label="s" />);
    const sw = screen.getByRole("switch");
    expect(sw.className).toContain("h-4");
    expect(sw.className).toContain("w-7");
  });

  it("size default 'md' → medium dimensions", () => {
    render(<Toggle on={false} onChange={() => {}} aria-label="m" />);
    const sw = screen.getByRole("switch");
    expect(sw.className).toContain("h-5");
    expect(sw.className).toContain("w-9");
  });

  it("role='switch' kalıcı (ekran okuyucu sözleşmesi)", () => {
    render(<Toggle on={true} onChange={() => {}} aria-label="r" />);
    expect(screen.getByRole("switch", { name: "r" })).toBeInTheDocument();
  });

  it("aria-label prop forward edilir", () => {
    render(<Toggle on={false} onChange={() => {}} aria-label="özel etiket" />);
    expect(screen.getByLabelText("özel etiket")).toBeInTheDocument();
  });
});
