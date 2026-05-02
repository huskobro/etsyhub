import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MetadataSection } from "@/features/listings/components/MetadataSection";
import { useUpdateListingDraft } from "@/features/listings/hooks/useUpdateListingDraft";
import { useGenerateListingMeta } from "@/features/listings/hooks/useGenerateListingMeta";
import type { ListingDraftView } from "@/features/listings/types";

vi.mock("@/features/listings/hooks/useUpdateListingDraft");
vi.mock("@/features/listings/hooks/useGenerateListingMeta");

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

function idleAiMutation() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    isSuccess: false,
    status: "idle",
    data: undefined,
    reset: vi.fn(),
    variables: undefined,
    context: undefined,
  } as any;
}

function idleSaveMutation() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
    status: "idle",
    data: undefined,
    reset: vi.fn(),
    variables: undefined,
    context: undefined,
  } as any;
}

describe("MetadataSection", () => {
  beforeEach(() => {
    vi.mocked(useUpdateListingDraft).mockReturnValue(idleSaveMutation());
    vi.mocked(useGenerateListingMeta).mockReturnValue(idleAiMutation());
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
      ...idleSaveMutation(),
      mutate: mockMutate,
    });

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

  it("shows error alert on save mutation error", () => {
    vi.mocked(useUpdateListingDraft).mockReturnValue({
      ...idleSaveMutation(),
      error: new Error("Save failed"),
      status: "error",
    });

    render(<MetadataSection listing={mockListing} />);
    expect(screen.getByText(/Kaydetme başarısız: Save failed/)).toBeInTheDocument();
  });

  it("shows pending state on Save button during mutation", () => {
    vi.mocked(useUpdateListingDraft).mockReturnValue({
      ...idleSaveMutation(),
      isPending: true,
      status: "pending",
    });

    render(<MetadataSection listing={mockListing} />);
    const titleInput = screen.getByLabelText("Başlık");
    fireEvent.change(titleInput, { target: { value: "New Title" } });
    const saveButtons = screen.getAllByRole("button", { name: /Kaydediliyor/i });
    expect(saveButtons[0]).toBeDisabled();
  });

  // ────────────────────────────────────────────────────────────
  // Phase 9 V1 Task 16 — AI Oluştur button binding tests
  // ────────────────────────────────────────────────────────────

  it("AI button enabled by default", () => {
    render(<MetadataSection listing={mockListing} />);
    const aiButton = screen.getByRole("button", { name: /AI Oluştur/i });
    expect(aiButton).not.toBeDisabled();
  });

  it("AI button click → mutate called", () => {
    const aiMutate = vi.fn();
    vi.mocked(useGenerateListingMeta).mockReturnValue({
      ...idleAiMutation(),
      mutate: aiMutate,
    });
    render(<MetadataSection listing={mockListing} />);
    const aiButton = screen.getByRole("button", { name: /AI Oluştur/i });
    fireEvent.click(aiButton);
    expect(aiMutate).toHaveBeenCalled();
  });

  it("AI button isPending → 'Üretiliyor…' + disabled", () => {
    vi.mocked(useGenerateListingMeta).mockReturnValue({
      ...idleAiMutation(),
      isPending: true,
      status: "pending",
    });
    render(<MetadataSection listing={mockListing} />);
    const aiButton = screen.getByRole("button", { name: /Üretiliyor/i });
    expect(aiButton).toBeDisabled();
  });

  it("AI mutation error → ayrı alert (kaydetme hatasından farklı)", () => {
    vi.mocked(useGenerateListingMeta).mockReturnValue({
      ...idleAiMutation(),
      error: new Error("AI servis hatası"),
      status: "error",
    });
    render(<MetadataSection listing={mockListing} />);
    expect(
      screen.getByText(/AI üretim başarısız: AI servis hatası/),
    ).toBeInTheDocument();
  });

  it("save error + AI error → iki ayrı alert birlikte gösterilir", () => {
    vi.mocked(useUpdateListingDraft).mockReturnValue({
      ...idleSaveMutation(),
      error: new Error("Save failed"),
      status: "error",
    });
    vi.mocked(useGenerateListingMeta).mockReturnValue({
      ...idleAiMutation(),
      error: new Error("AI servis hatası"),
      status: "error",
    });
    render(<MetadataSection listing={mockListing} />);
    expect(screen.getByText(/AI üretim başarısız: AI servis hatası/)).toBeInTheDocument();
    expect(screen.getByText(/Kaydetme başarısız: Save failed/)).toBeInTheDocument();
  });

  it("AI isSuccess true → status mesajı görünür", () => {
    vi.mocked(useGenerateListingMeta).mockReturnValue({
      ...idleAiMutation(),
      isSuccess: true,
      status: "success",
      data: {
        output: { title: "AI Title", description: "AI Desc", tags: [] },
        providerSnapshot: "gemini-2.5-flash@2026-05-03",
        promptVersion: "v1.0",
      },
    });
    render(<MetadataSection listing={mockListing} />);
    expect(
      screen.getByText(/AI önerisi alanlara yazıldı/i),
    ).toBeInTheDocument();
  });

  it("AI mutation onSuccess callback → form alanları doldurulur", () => {
    const tags = Array.from({ length: 13 }, (_, i) => `t${i + 1}`);
    const aiMutate = vi.fn().mockImplementation((_input, options) => {
      options?.onSuccess?.({
        output: {
          title: "AI New Title",
          description: "AI Desc",
          tags,
        },
        providerSnapshot: "gemini-2.5-flash@2026-05-03",
        promptVersion: "v1.0",
      });
    });
    vi.mocked(useGenerateListingMeta).mockReturnValue({
      ...idleAiMutation(),
      mutate: aiMutate,
    });

    // Save mutation must NOT be called (auto-save YOK)
    const saveMutate = vi.fn();
    vi.mocked(useUpdateListingDraft).mockReturnValue({
      ...idleSaveMutation(),
      mutate: saveMutate,
    });

    render(<MetadataSection listing={mockListing} />);
    fireEvent.click(screen.getByRole("button", { name: /AI Oluştur/i }));

    expect(screen.getByLabelText("Başlık")).toHaveValue("AI New Title");
    expect(screen.getByLabelText("Açıklama")).toHaveValue("AI Desc");
    expect(screen.getByLabelText("Etiketler (maksimum 13)")).toHaveValue(
      tags.join(", "),
    );
    // Auto-save guard: PATCH mutation NOT called
    expect(saveMutate).not.toHaveBeenCalled();
  });
});
