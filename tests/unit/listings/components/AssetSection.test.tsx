import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssetSection } from "@/features/listings/components/AssetSection";
import type { ListingDraftView } from "@/features/listings/types";

const mockListing: ListingDraftView = {
  id: "test-123",
  title: "Test Listing",
  description: "Test description",
  tags: ["tag1", "tag2"],
  priceCents: 999,
  materials: [],
  status: "DRAFT",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  mockupJobId: "job-1",
  coverRenderId: "cover-1",
  imageOrder: [
    {
      renderId: "cover-1",
      isCover: true,
      packPosition: 0,
      outputKey: "/images/cover.png",
      templateName: "canvas_a4",
    },
    {
      renderId: "img-1",
      isCover: false,
      packPosition: 1,
      outputKey: "/images/img1.png",
      templateName: "canvas_a4",
    },
    {
      renderId: "img-2",
      isCover: false,
      packPosition: 2,
      outputKey: "/images/img2.png",
      templateName: "canvas_a4",
    },
  ],
  category: null,
  submittedAt: null,
  publishedAt: null,
  etsyListingId: null,
  failedReason: null,
  readiness: [],
};

describe("AssetSection", () => {
  it("renders cover image with orange border", () => {
    render(<AssetSection listing={mockListing} />);
    const coverImg = screen.getByAltText("cover");
    expect(coverImg).toBeInTheDocument();
    expect(coverImg.closest("div")).toHaveClass("border-accent");
  });

  it("renders cover badge", () => {
    render(<AssetSection listing={mockListing} />);
    expect(screen.getByText("★ COVER")).toBeInTheDocument();
  });

  it("renders other images with position badges", () => {
    render(<AssetSection listing={mockListing} />);
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("shows ZIP download link when all images ready", () => {
    render(<AssetSection listing={mockListing} />);
    const zipLink = screen.getByRole("link", { name: /ZIP İndir/i });
    expect(zipLink).toBeInTheDocument();
    expect(zipLink).toHaveAttribute("href", `/api/listings/${mockListing.id}/assets/download`);
  });

  it("hides ZIP download when images not ready", () => {
    const listingWithoutCoverOutput = {
      ...mockListing,
      imageOrder: mockListing.imageOrder.map((img: any, idx: number) =>
        idx === 0 ? { ...img, outputKey: null } : img,
      ),
    };
    render(<AssetSection listing={listingWithoutCoverOutput} />);
    expect(screen.queryByRole("link", { name: /ZIP İndir/i })).not.toBeInTheDocument();
  });

  it("shows mockup count badge", () => {
    render(<AssetSection listing={mockListing} />);
    expect(screen.getByText("1 mockup")).toBeInTheDocument();
  });

  it("shows ZIP ready indicator", () => {
    render(<AssetSection listing={mockListing} />);
    expect(screen.getByText("✓ ZIP'e hazır")).toBeInTheDocument();
  });

  it("shows waiting indicator when not all images ready", () => {
    const listingNotReady = {
      ...mockListing,
      imageOrder: mockListing.imageOrder.map((img: any, idx: number) =>
        idx === 2 ? { ...img, outputKey: null } : img,
      ),
    };
    render(<AssetSection listing={listingNotReady} />);
    expect(screen.getByText("Tüm görseller yüklenmeyi bekliyor")).toBeInTheDocument();
  });
});
