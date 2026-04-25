/**
 * toast.test.tsx
 *
 * T-38 spec doğrulaması · Toast primitive terfisi.
 *
 * Sözleşme: docs/design/implementation-notes/cp9-stabilization-wave.md
 * - 3 tone: success / error / info (yalnızca, fazlası YOK)
 * - tone="success" / "info" → role="status" + aria-live="polite"
 * - tone="error" → role="alert" + aria-live="assertive"
 * - bg-{tone}-soft + text-{tone} + border-{tone} token sınıfları
 * - className prop dış sınıfları cn helper ile merge eder
 * - Auto-dismiss / portal / stack / icon zorunluluğu YOK
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toast } from "@/components/ui/Toast";

describe("Toast primitive — aria semantics", () => {
  it("tone='success' → role='status' + aria-live='polite'", () => {
    render(<Toast tone="success" message="İşlem başarılı." />);
    const node = screen.getByRole("status");
    expect(node).toHaveAttribute("aria-live", "polite");
    expect(node.textContent).toContain("İşlem başarılı.");
  });

  it("tone='info' → role='status' + aria-live='polite'", () => {
    render(<Toast tone="info" message="Bilgi mesajı." />);
    const node = screen.getByRole("status");
    expect(node).toHaveAttribute("aria-live", "polite");
    expect(node.textContent).toContain("Bilgi mesajı.");
  });

  it("tone='error' → role='alert' + aria-live='assertive'", () => {
    render(<Toast tone="error" message="Hata oluştu." />);
    const node = screen.getByRole("alert");
    expect(node).toHaveAttribute("aria-live", "assertive");
    expect(node.textContent).toContain("Hata oluştu.");
  });
});

describe("Toast primitive — token discipline", () => {
  it("message prop text content olarak render edilir", () => {
    render(<Toast tone="info" message="Tarama kuyruğa alındı." />);
    expect(screen.getByText("Tarama kuyruğa alındı.")).toBeInTheDocument();
  });

  it("tone='success' → bg-success-soft + text-success + border-success", () => {
    render(<Toast tone="success" message="ok" />);
    const node = screen.getByRole("status");
    expect(node.className).toMatch(/bg-success-soft/);
    expect(node.className).toMatch(/text-success\b/);
    expect(node.className).toMatch(/border-success\b/);
  });

  it("tone='error' → bg-danger-soft + text-danger + border-danger", () => {
    render(<Toast tone="error" message="err" />);
    const node = screen.getByRole("alert");
    expect(node.className).toMatch(/bg-danger-soft/);
    expect(node.className).toMatch(/text-danger\b/);
    expect(node.className).toMatch(/border-danger\b/);
  });

  it("className prop forward edilir (custom class merge)", () => {
    render(
      <Toast tone="success" message="ok" className="mt-2 custom-extra" />,
    );
    const node = screen.getByRole("status");
    expect(node.className).toMatch(/mt-2/);
    expect(node.className).toMatch(/custom-extra/);
    // Default token sınıfları korunur (cn merge dışı override yok).
    expect(node.className).toMatch(/bg-success-soft/);
  });
});
