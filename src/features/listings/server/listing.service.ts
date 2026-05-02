/**
 * Phase 9 Task 1: Listing Service Foundation
 * Core CRUD operations for Listing model.
 */

import { PrismaClient, Listing, ListingStatus } from "@prisma/client";
import type {
  CreateListingPayload,
  UpdateListingPayload,
} from "../schemas";

export async function createListingInternal(
  prisma: PrismaClient,
  payload: CreateListingPayload
): Promise<Listing> {
  return prisma.listing.create({
    data: {
      userId: payload.userId,
      storeId: payload.storeId || undefined,
      generatedDesignId: payload.generatedDesignId || undefined,
      productTypeId: payload.productTypeId || undefined,
      mockupJobId: payload.mockupJobId || undefined, // Phase 9
      title: payload.title || undefined,
      description: payload.description || undefined,
      tags: payload.tags || [],
      category: payload.category || undefined,
      priceCents: payload.priceCents || undefined,
      materials: payload.materials || [],
      status: ListingStatus.DRAFT,
    },
  });
}

/**
 * Fetch Listing by ID with authorization check.
 */
export async function getListingById(
  prisma: PrismaClient,
  listingId: string,
  userId: string
): Promise<Listing | null> {
  return prisma.listing.findFirst({
    where: {
      id: listingId,
      userId, // Authorization
      deletedAt: null, // Active only
    },
  });
}

/**
 * Update Listing.
 */
export async function updateListing(
  prisma: PrismaClient,
  listingId: string,
  userId: string,
  payload: UpdateListingPayload
): Promise<Listing> {
  // Authorize
  const existing = await getListingById(prisma, listingId, userId);
  if (!existing) {
    throw new Error(`Listing not found or unauthorized: ${listingId}`);
  }

  // K6 Lock: mockupJobId immutable (cannot update if already set)
  if (
    payload.mockupJobId !== undefined &&
    existing.mockupJobId !== null &&
    existing.mockupJobId !== payload.mockupJobId
  ) {
    throw new Error(
      "K6 Lock: mockupJobId is immutable after initial handoff. Cannot change reference."
    );
  }

  return prisma.listing.update({
    where: { id: listingId },
    data: {
      title: payload.title !== undefined ? payload.title : undefined,
      description:
        payload.description !== undefined ? payload.description : undefined,
      tags: payload.tags !== undefined ? payload.tags : undefined,
      category: payload.category !== undefined ? payload.category : undefined,
      priceCents:
        payload.priceCents !== undefined ? payload.priceCents : undefined,
      materials:
        payload.materials !== undefined ? payload.materials : undefined,
      status: payload.status !== undefined ? payload.status : undefined,
      mockupJobId:
        payload.mockupJobId !== undefined ? payload.mockupJobId : undefined,
      etsyDraftId:
        payload.etsyDraftId !== undefined ? payload.etsyDraftId : undefined,
    },
  });
}

/**
 * List user's Listings.
 */
export async function listListingsByUser(
  prisma: PrismaClient,
  userId: string,
  filters?: {
    status?: ListingStatus;
    storeId?: string | null;
    mockupJobId?: string | null; // Phase 9
    limit?: number;
    offset?: number;
  }
): Promise<Listing[]> {
  return prisma.listing.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.storeId !== undefined && { storeId: filters.storeId }),
      ...(filters?.mockupJobId !== undefined && {
        mockupJobId: filters.mockupJobId,
      }),
    },
    orderBy: { createdAt: "desc" },
    take: filters?.limit || 20,
    skip: filters?.offset || 0,
  });
}

/**
 * Soft-delete Listing.
 */
export async function softDeleteListing(
  prisma: PrismaClient,
  listingId: string,
  userId: string
): Promise<Listing> {
  const existing = await getListingById(prisma, listingId, userId);
  if (!existing) {
    throw new Error(`Listing not found or unauthorized: ${listingId}`);
  }

  return prisma.listing.update({
    where: { id: listingId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Count Listings by MockupJob (Phase 9 validation).
 */
export async function countListingsByMockupJob(
  prisma: PrismaClient,
  mockupJobId: string
): Promise<number> {
  return prisma.listing.count({
    where: {
      mockupJobId,
      deletedAt: null,
    },
  });
}
