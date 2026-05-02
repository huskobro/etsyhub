import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MetadataSection } from "@/features/listings/components/MetadataSection";
import { useUpdateListingDraft } from "@/features/listings/hooks/useUpdateListingDraft";
import type { ListingDraftView } from "@/features/listings/types";

vi.mock("@/features/listings/hooks/useUpdateListingDraft");

const mockListing: ListingDraftView = {
  id: "test-123",
  title: "Test Title",
  description: "Test Description",
  tags: ["tag1", "tag2"],
  priceCents: 999,
  materials: [],
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
};

describe("MetadataSection", () => {
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

  it("renders title input with initial value", () => {
    render(<MetadataSection listing={mockListing} />);
    const titleInput = screen.getByLabelText("Başlık");
    expect(titleInput).toHaveValue("Test Title");
  });

  it("renders description textarea with initial value", () => {
    render(<MetadataSection listing={mockListing} />);
    const descInput = screen.getByLabelText("Açıklama");
    expect(descInput).toHaveValue("Test Description");
  });

  it("renders tags input with comma-separated tags", () => {
    render(<MetadataSection listing={mockListing} />);
    const tagsInput = screen.getByLabelText("Etiketler (maksimum 13)");
    expect(tagsInput).toHaveValue("tag1, tag2");
  });

  it("shows tag count", () => {
    render(<MetadataSection listing={mockListing} />);
    expect(screen.getByText(/2\/13 etiket/)).toBeInTheDocument();
  });

  it("disables Save button initially (no changes)", () => {
    render(<MetadataSection listing={mockListing} />);
    const saveButton = screen.getByRole("button", { name: /Kaydet/i });
    expect(saveButton).toBeDisabled();
  });

  it("enables Save button when title changes", () => {
    render(<MetadataSection listing={mockListing} />);
    const titleInput = screen.getByLabelText("Başlık") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "New Title" } });
    const saveButton = screen.getByRole("button", { name: /Kaydet/i });
    expect(saveButton).not.toBeDisabled();
  });

  it("calls mutate with parsed tags on Save", () => {
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

    render(<MetadataSection listing={mockListing} />);
    const titleInput = screen.getByLabelText("Başlık") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Updated Title" } });
    const saveButtons = screen.getAllByRole("button", { name: /Kaydet/i });
    const saveBtn = saveButtons[0];
    if (saveBtn) fireEvent.click(saveBtn);

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Updated Title",
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

    render(<MetadataSection listing={mockListing} />);
    const alert = screen.getByRole("alert") as HTMLElement;
    expect(alert).toHaveTextContent("Kaydetme başarısız: Save failed");
  });

  it("disables AI button (placeholder for Task 21)", () => {
    render(<MetadataSection listing={mockListing} />);
    const aiButton = screen.getByRole("button", { name: /AI Oluştur/i });
    expect(aiButton).toBeDisabled();
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

    render(<MetadataSection listing={mockListing} />);
    const titleInput = screen.getByLabelText("Başlık");
    fireEvent.change(titleInput, { target: { value: "New Title" } });
    const saveButtons = screen.getAllByRole("button", { name: /Kaydediliyor/i });
    expect(saveButtons[0]).toBeDisabled();
  });
});
