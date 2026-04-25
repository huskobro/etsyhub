/**
 * collection-create-dialog.test.tsx
 *
 * C1 spec doğrulaması · CollectionCreateDialog disclosure pattern + a11y.
 *
 * Sözleşme: post CP-9 cleanup wave (C1) — Bookmarks PromoteDialog +
 * AddCompetitorDialog ile aynı manuel disclosure pattern'ine hizalama
 * doğrulaması. useFocusTrap'in 5. tüketim noktası.
 *
 * Eklenen davranışlar:
 * - role="dialog" + aria-modal="true" + aria-labelledby (zaten vardı, korundu)
 * - useFocusTrap → Tab boundary + initial focus ("İsim" input)
 * - Escape → onClose (busy iken iptal edilmez)
 * - Backdrop click → onClose (busy iken iptal edilmez)
 * - Dialog içi click → onClose çağrılmaz (event bubbling guard)
 * - Vazgeç → onClose
 *
 * Mevcut form mantığı (name/description/kind state, onSubmit handler,
 * busy/error prop davranışı) DOKUNULMAZ.
 *
 * Component pure prop driven; QueryClientProvider gerekmez.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CollectionCreateDialog } from "@/features/collections/components/collection-create-dialog";

describe("CollectionCreateDialog — a11y modal yapısı", () => {
  it("role=dialog + aria-modal=true + aria-labelledby render eder", () => {
    render(
      <CollectionCreateDialog
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "create-collection-title");
    const titleId = dialog.getAttribute("aria-labelledby")!;
    const labelEl = document.getElementById(titleId);
    expect(labelEl).not.toBeNull();
    expect(labelEl).toHaveTextContent(/Yeni Koleksiyon/i);
  });

  it("dialog açıldığında initial focus 'İsim' input'a uygulanır", () => {
    render(
      <CollectionCreateDialog
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    const input = screen.getByLabelText(/^İsim$/);
    expect(document.activeElement).toBe(input);
  });
});

describe("CollectionCreateDialog — C1 a11y davranışları", () => {
  it("Escape tuşu basıldığında onClose çağrılır (busy=false)", () => {
    const onClose = vi.fn();
    render(
      <CollectionCreateDialog
        onClose={onClose}
        onSubmit={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("busy=true iken Escape → onClose çağrılmaz", () => {
    const onClose = vi.fn();
    render(
      <CollectionCreateDialog
        onClose={onClose}
        onSubmit={vi.fn()}
        busy={true}
        error={null}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("backdrop (overlay) tıklamasında onClose çağrılır (busy=false)", () => {
    const onClose = vi.fn();
    render(
      <CollectionCreateDialog
        onClose={onClose}
        onSubmit={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    const dialog = screen.getByRole("dialog");
    // Overlay = dialog elementinin kendisi (target === currentTarget)
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("busy=true iken backdrop click → onClose çağrılmaz", () => {
    const onClose = vi.fn();
    render(
      <CollectionCreateDialog
        onClose={onClose}
        onSubmit={vi.fn()}
        busy={true}
        error={null}
      />,
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("dialog içi (başlık) tıklaması onClose çağırmaz (event bubbling guard)", () => {
    const onClose = vi.fn();
    render(
      <CollectionCreateDialog
        onClose={onClose}
        onSubmit={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    const dialog = screen.getByRole("dialog");
    const heading = within(dialog).getByText("Yeni Koleksiyon");
    fireEvent.click(heading);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Vazgeç butonu → onClose çağrılır", () => {
    const onClose = vi.fn();
    render(
      <CollectionCreateDialog
        onClose={onClose}
        onSubmit={vi.fn()}
        busy={false}
        error={null}
      />,
    );
    const cancelBtn = screen.getByRole("button", { name: /^Vazgeç$/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("CollectionCreateDialog — form mantığı (DOKUNULMAZ)", () => {
  it("geçerli isim girilip submit basıldığında onSubmit çağrılır", () => {
    const onSubmit = vi.fn();
    render(
      <CollectionCreateDialog
        onClose={vi.fn()}
        onSubmit={onSubmit}
        busy={false}
        error={null}
      />,
    );
    const input = screen.getByLabelText(/^İsim$/);
    fireEvent.change(input, { target: { value: "Boho Wall Art" } });
    const submitBtn = screen.getByRole("button", { name: /Oluştur/i });
    fireEvent.click(submitBtn);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      name: "Boho Wall Art",
      description: undefined,
      kind: "MIXED",
    });
  });
});
