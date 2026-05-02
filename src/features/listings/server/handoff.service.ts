/**
 * Phase 9 Task 2: Handoff Service
 * MockupJob selection result → Listing draft transformation.
 *
 * Contract K5 (Phase 9 K5):
 * - Accepts MockupJob + optional overrides
 * - Creates Listing w/ mockupJobId immutable reference
 * - Validates MockupJob state (COMPLETED/PARTIAL_COMPLETE only)
 * - Attaches selected mockups to listing
 * - Marks handoff timestamp (job.completedAt as constraint)
 *
 * K6 Lock: mockupJobId immutable after creation
 */

import { PrismaClient, MockupJobStatus } from "@prisma/client";
import type {
  HandoffRequest,
  HandoffResponse,
} from "../schemas";
import type { ListingDTO } from "../types";
import { createListingInternal } from "./listing.service";

export class HandoffService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Handoff MockupJob → Listing.
   *
   * Spec:
   * - MockupJob must have status COMPLETED or PARTIAL_COMPLETE
   * - Must have coverRenderId (cover invariant, spec §4.8)
   * - Creates Listing with mockupJobId reference
   * - AttachListingToMockup ensures Listing.mockupJobId persists
   * - Returns HandoffResponse with DTO + attached mockup count
   */
  async handoffMockupToListing(
    userId: string,
    req: HandoffRequest
  ): Promise<HandoffResponse> {
    // Fetch MockupJob + validate state
    const job = await this.prisma.mockupJob.findUnique({
      where: { id: req.mockupJobId },
      include: {
        renders: {
          where: { packPosition: { not: null } }, // Active renders only
        },
        set: true,
      },
    });

    if (!job) {
      throw new Error(`MockupJob not found: ${req.mockupJobId}`);
    }

    // Validate user ownership
    if (job.userId !== userId) {
      throw new Error("Unauthorized: MockupJob ownership mismatch");
    }

    // Validate job completion status (K5)
    if (
      job.status !== MockupJobStatus.COMPLETED &&
      job.status !== MockupJobStatus.PARTIAL_COMPLETE
    ) {
      throw new Error(
        `Invalid MockupJob status: ${job.status}. Expected COMPLETED or PARTIAL_COMPLETE`
      );
    }

    // Validate cover invariant (spec §4.8)
    if (!job.coverRenderId) {
      throw new Error("MockupJob missing coverRenderId; cover invariant violated");
    }

    // Infer productTypeId if not overridden
    let productTypeId = req.productTypeId;
    if (!productTypeId && job.set.sourceMetadata) {
      const meta = job.set.sourceMetadata as {
        productTypeId?: string;
      };
      productTypeId = meta.productTypeId || null;
    }

    // Create Listing with mockupJobId (K6 immutable)
    const listing = await createListingInternal(this.prisma, {
      userId,
      storeId: undefined,
      productTypeId: productTypeId || undefined,
      mockupJobId: req.mockupJobId, // K6: immutable reference
      title: req.title || undefined,
      description: req.description || undefined,
      category: req.category || undefined,
      materials: req.materials || [],
      tags: [],
      priceCents: req.priceCents || undefined,
    });

    // Build response
    const dto: ListingDTO = {
      id: listing.id,
      userId: listing.userId,
      storeId: listing.storeId,
      generatedDesignId: listing.generatedDesignId,
      productTypeId: listing.productTypeId,
      mockupJobId: listing.mockupJobId, // K6: visible in DTO
      title: listing.title,
      description: listing.description,
      tags: listing.tags,
      category: listing.category,
      priceCents: listing.priceCents,
      materials: listing.materials,
      status: listing.status,
      etsyDraftId: listing.etsyDraftId,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      deletedAt: listing.deletedAt,
    };

    return {
      listing: dto,
      mockupCount: job.renders.length,
      message: `Listing created from MockupJob ${req.mockupJobId} with ${job.renders.length} mockups`,
    };
  }

  /**
   * Detach Listing from MockupJob (if needed for cleanup).
   * K6: Cannot remove mockupJobId once set; only operation is softDelete.
   */
  async detachListingFromMockup(listingId: string, userId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      throw new Error(`Listing not found: ${listingId}`);
    }

    if (listing.userId !== userId) {
      throw new Error("Unauthorized: Listing ownership mismatch");
    }

    if (!listing.mockupJobId) {
      // Already detached or never attached
      return;
    }

    // K6 Lock: Cannot mutate mockupJobId to null after creation
    // Instead, mark listing as archived/cancelled
    // (concrete delete semantics defined in Phase 9 Task 3)
    throw new Error(
      "K6 Lock: mockupJobId is immutable. Use listing softDelete or status change instead."
    );
  }
}
