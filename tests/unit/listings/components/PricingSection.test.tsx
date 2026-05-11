import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PricingSection } from "@/features/listings/components/PricingSection";
import { useUpdateListingDraft } from "@/features/listings/hooks/useUpdateListingDraft";
import type { ListingDraftView } from "@/features/listings/types";

vi.mock("@/features/listings/hooks/useUpdateListingDraft");

const mockListing: ListingDraftView = {
  id: "test-123",
  title: "Test Listing",
  description: "Test description",
  tags: ["tag1"],
  priceCents: 999, // $9.99
  materials: ["Digital download"],
  status: "DRAFT",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  mockupJobId: null,
  coverRenderId: null,
  imageOrder: [],
  category: null,
  submittedAt: null,
  publishedAt: null,
  etsyListingId: null,
  failedReason: null,
  readiness: [],
  etsyShop: null,
};

describe("PricingSection", () => {
  beforeEach(() => {
    vi.mocked(useUpdateListingDraft).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      status: "idle",
      data: undefined,
      reset: vi.fn(),
      variables: undefined,
      context: undefined,
    } as any);
  });

  it("renders price input with value converted from cents", () => {
    render(<PricingSection listing={mockListing} />);
    const priceInput = screen.getByLabelText("Fiyat (USD)") as HTMLInputElement;
    expect(priceInput.value).toBe("9.99");
  });

  it("renders materials textarea with initial value", () => {
    render(<PricingSection listing={mockListing} />);
    const materialsInput = screen.getByLabelText("Materials");
    expect(materialsInput).toHaveValue("Digital download");
  });

  it("disables Save button initially (no changes)", () => {
    render(<PricingSection listing={mockListing} />);
    const saveButton = screen.getByRole("button", { name: /Kaydet/i });
    expect(saveButton).toBeDisabled();
  });

  it("enables Save button when price changes", () => {
    render(<PricingSection listing={mockListing} />);
    const priceInput = screen.getByLabelText("Fiyat (USD)");
    fireEvent.change(priceInput, { target: { value: "12.99" } });
    const saveButton = screen.getByRole("button", { name: /Kaydet/i });
    expect(saveButton).not.toBeDisabled();
  });

  it("enables Save button when materials change", () => {
    render(<PricingSection listing={mockListing} />);
    const materialsInput = screen.getByLabelText("Materials");
    fireEvent.change(materialsInput, { target: { value: "PNG + Vector" } });
    const saveButton = screen.getByRole("button", { name: /Kaydet/i });
    expect(saveButton).not.toBeDisabled();
  });

  it("calls mutate with price in cents on Save", () => {
    const mockMutate = vi.fn();
    vi.mocked(useUpdateListingDraft).mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      status: "idle",
      data: undefined,
      reset: vi.fn(),
      variables: undefined,
      context: undefined,
    } as any);

    render(<PricingSection listing={mockListing} />);
    const priceInput = screen.getByLabelText("Fiyat (USD)");
    fireEvent.change(priceInput, { target: { value: "15.50" } });
    const saveButton = screen.getByRole("button", { name: /Kaydet/i });
    fireEvent.click(saveButton);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        priceCents: 1550,
      }),
    );
  });

  it("shows error alert on mutation error", () => {
    vi.mocked(useUpdateListingDraft).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      error: new Error("Save failed"),
      status: "error",
      data: undefined,
      reset: vi.fn(),
      variables: undefined,
      context: undefined,
    } as any);

    render(<PricingSection listing={mockListing} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Save failed: Save failed");
  });

  it("shows pending state on Save button during mutation", () => {
    vi.mocked(useUpdateListingDraft).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: true,
      error: null,
      status: "pending",
      data: undefined,
      reset: vi.fn(),
      variables: undefined,
      context: undefined,
    } as any);

    render(<PricingSection listing={mockListing} />);
    const priceInput = screen.getByLabelText("Fiyat (USD)");
    fireEvent.change(priceInput, { target: { value: "10.00" } });
    const saveButton = screen.getByRole("button", { name: /Kaydediliyor/i });
    expect(saveButton).toBeDisabled();
  });

  it("handles price with rounding (cents conversion)", () => {
    const mockMutate = vi.fn();
    vi.mocked(useUpdateListingDraft).mockReturnValue({
      mutate: mockMutate,
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      status: "idle",
      data: undefined,
      reset: vi.fn(),
      variables: undefined,
      context: undefined,
    } as any);

    render(<PricingSection listing={mockListing} />);
    const priceInput = screen.getByLabelText("Fiyat (USD)");
    fireEvent.change(priceInput, { target: { value: "7.999" } });
    const saveButton = screen.getByRole("button", { name: /Kaydet/i });
    fireEvent.click(saveButton);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        priceCents: 800, // 7.999 * 100 rounded to 800
      }),
    );
  });
});
