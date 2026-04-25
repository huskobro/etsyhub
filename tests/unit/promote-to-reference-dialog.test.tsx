/**
 * promote-to-reference-dialog.test.tsx
 *
 * T-40 spec doğrulaması · PromoteToReferenceDialog a11y davranışları.
 *
 * Sözleşme: docs/design/implementation-notes/cp9-stabilization-wave.md (T-40)
 *
 * Eklenen davranışlar:
 * - Escape → onClose
 * - Initial focus → ürün tipi select (varsa) / Vazgeç butonu (yoksa)
 * - Tab boundary → modal dışına kaçamaz
 * - Backdrop click → onClose
 * - Dialog içi click → onClose çağrılmaz
 *
 * Mevcut form mantığı (productTypeId state, onSubmit) DOKUNULMAZ.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PromoteToReferenceDialog } from "@/features/competitors/components/promote-to-reference-dialog";
import type { CompetitorListing } from "@/features/competitors/queries/use-competitor";

function makeListing(
  overrides: Partial<CompetitorListing> = {},
): CompetitorListing {
  return {
    id: overrides.id ?? "l-1",
    externalId: overrides.externalId ?? "ext-1",
    platform: overrides.platform ?? "ETSY",
    sourceUrl: overrides.sourceUrl ?? "https://etsy.com/listing/1",
    title: overrides.title ?? "Boho Wall Art Print",
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    imageUrls: overrides.imageUrls ?? [],
    priceCents: overrides.priceCents ?? 1500,
    currency: overrides.currency ?? "USD",
    reviewCount: overrides.reviewCount ?? 12,
    favoritesCount: overrides.favoritesCount ?? null,
    listingCreatedAt: overrides.listingCreatedAt ?? null,
    latestReviewAt: overrides.latestReviewAt ?? null,
    firstSeenAt: overrides.firstSeenAt ?? "2026-04-01T00:00:00.000Z",
    lastSeenAt: overrides.lastSeenAt ?? "2026-04-01T00:00:00.000Z",
    status: overrides.status ?? "ACTIVE",
  };
}

const productTypes = [
  { id: "pt-wall", displayName: "Wall Art" },
  { id: "pt-clipart", displayName: "Clipart" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PromoteToReferenceDialog — a11y modal yapısı (KORUNDU)", () => {
  it("role=dialog + aria-modal=true + aria-labelledby render eder", () => {
    render(
      <PromoteToReferenceDialog
        listing={makeListing()}
        productTypes={productTypes}
        isPending={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute(
      "aria-labelledby",
      "promote-listing-title",
    );
  });
});

describe("PromoteToReferenceDialog — T-40 a11y davranışları", () => {
  it("Escape tuşu basıldığında onClose çağrılır", () => {
    const onClose = vi.fn();
    render(
      <PromoteToReferenceDialog
        listing={makeListing()}
        productTypes={productTypes}
        isPending={false}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dialog açıldığında initial focus ürün tipi select'i olur", () => {
    render(
      <PromoteToReferenceDialog
        listing={makeListing()}
        productTypes={productTypes}
        isPending={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const select = screen.getByLabelText(/Ürün tipi/i);
    expect(document.activeElement).toBe(select);
  });

  it("ürün tipi yokken initial focus Vazgeç butonuna düşer", () => {
    render(
      <PromoteToReferenceDialog
        listing={makeListing()}
        productTypes={[]}
        isPending={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const cancelBtn = screen.getByRole("button", { name: /^Vazgeç$/i });
    expect(document.activeElement).toBe(cancelBtn);
  });

  it("backdrop tıklamasında onClose çağrılır; dialog içi tıklamada çağrılmaz", () => {
    const onClose = vi.fn();
    render(
      <PromoteToReferenceDialog
        listing={makeListing()}
        productTypes={productTypes}
        isPending={false}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    // Dialog içi tıklama → onClose ÇAĞRILMAZ
    const heading = within(dialog).getByText(/Referans'a Taşı/i);
    fireEvent.click(heading);
    expect(onClose).not.toHaveBeenCalled();

    // Backdrop tıklama → onClose çağrılır
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Tab boundary — son focusable element'te Tab basınca ilk focusable'a wrap eder", () => {
    render(
      <PromoteToReferenceDialog
        listing={makeListing()}
        productTypes={productTypes}
        isPending={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const closeBtn = screen.getByRole("button", { name: /^Kapat$/i });
    const submitBtn = screen.getByRole("button", { name: /Referansa Taşı/i });
    submitBtn.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);
  });

  it("Tab boundary — ilk focusable element'te Shift+Tab son focusable'a wrap eder", () => {
    render(
      <PromoteToReferenceDialog
        listing={makeListing()}
        productTypes={productTypes}
        isPending={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    const closeBtn = screen.getByRole("button", { name: /^Kapat$/i });
    const submitBtn = screen.getByRole("button", { name: /Referansa Taşı/i });
    closeBtn.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(submitBtn);
  });
});

describe("PromoteToReferenceDialog — mevcut form mantığı (DOKUNULMAZ)", () => {
  it("Referansa Taşı butonu seçili productTypeId ile onSubmit çağırır", () => {
    const onSubmit = vi.fn();
    render(
      <PromoteToReferenceDialog
        listing={makeListing()}
        productTypes={productTypes}
        isPending={false}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Referansa Taşı/i }));
    expect(onSubmit).toHaveBeenCalledWith("pt-wall");
  });
});
