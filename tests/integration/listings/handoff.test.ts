/**
 * Phase 9 Task 1-3: Integration Tests
 * Handoff workflow + Listing foundation
 *
 * Test scenarios (5-7 core):
 * 1. Create Listing with mockupJobId reference (K6 contract)
 * 2. Handoff MockupJob (COMPLETED) → Listing (contract K5)
 * 3. Handoff with ProductType inference from SelectionSet metadata
 * 4. K6 Lock: mockupJobId immutable after creation
 * 5. Authorization: user isolation enforced server-side
 * 6. Validation: handoff requires COMPLETED or PARTIAL_COMPLETE job status
 * 7. Legacy backward compat: Listing without mockupJobId still works
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  createListingInternal,
  getListingById,
  updateListing,
  listListingsByUser,
  countListingsByMockupJob,
  softDeleteListing,
  HandoffService,
  HandoffRequest,
  ListingDTO,
} from "../../../src/features/listings";

let prisma: PrismaClient;
let handoffService: HandoffService;

// Test fixtures
let testUserId: string;
let testStoreId: string;
let testProductTypeId: string;
let testMockupJobId: string;
let testSelectionSetId: string;

beforeAll(async () => {
  prisma = new PrismaClient();
  handoffService = new HandoffService(prisma);

  // Create test user
  const user = await prisma.user.create({
    data: {
      email: `test-phase9-${Date.now()}@example.com`,
      passwordHash: "test_hash",
      role: "USER",
    },
  });
  testUserId = user.id;

  // Create test store
  const store = await prisma.store.create({
    data: {
      userId: testUserId,
      name: "Test Store Phase 9",
    },
  });
  testStoreId = store.id;

  // Create test product type
  const productType = await prisma.productType.create({
    data: {
      key: `canvas_test_${Date.now()}`,
      displayName: "Test Canvas",
      isSystem: false,
    },
  });
  testProductTypeId = productType.id;

  // Create test selection set
  const selectionSet = await prisma.selectionSet.create({
    data: {
      userId: testUserId,
      name: "Test Selection Set",
      sourceMetadata: {
        productTypeId: testProductTypeId,
      },
    },
  });
  testSelectionSetId = selectionSet.id;

  // Create test MockupJob (COMPLETED state)
  const job = await prisma.mockupJob.create({
    data: {
      userId: testUserId,
      setId: testSelectionSetId,
      setSnapshotId: `snapshot_${Date.now()}`,
      categoryId: "canvas",
      status: "COMPLETED",
      packSize: 10,
      actualPackSize: 10,
      totalRenders: 10,
      successRenders: 10,
      failedRenders: 0,
    },
  });
  testMockupJobId = job.id;

  // Create MockupRender (cover at position 0)
  const coverRender = await prisma.mockupRender.create({
    data: {
      jobId: testMockupJobId,
      variantId: "variant_001",
      bindingId: "binding_001",
      templateSnapshot: { template: "canvas_test" },
      packPosition: 0,
      selectionReason: "COVER",
      status: "SUCCESS",
      outputKey: "output_001.png",
    },
  });

  // Update job with cover ID
  await prisma.mockupJob.update({
    where: { id: testMockupJobId },
    data: { coverRenderId: coverRender.id },
  });
});

afterAll(async () => {
  // Cleanup (cascade deletes via FK)
  await prisma.user.delete({
    where: { id: testUserId },
  });
  await prisma.$disconnect();
});

describe("Phase 9 Task 1-3: Listing Handoff Foundation", () => {
  // ============= Scenario 1: Create with mockupJobId =============
  it("Scenario 1: Create Listing with mockupJobId reference (K6 contract)", async () => {
    const listing = await createListingInternal(prisma, {
      userId: testUserId,
      storeId: testStoreId,
      mockupJobId: testMockupJobId, // K6: immutable reference
      title: "Test Listing with Mockup",
      description: "Canvas art design",
      category: "Canvas Prints",
      priceCents: 1999,
      tags: [],
      materials: [],
    });

    expect(listing).toBeDefined();
    expect(listing.userId).toBe(testUserId);
    expect(listing.mockupJobId).toBe(testMockupJobId);
    expect(listing.status).toBe("DRAFT");
    expect(listing.title).toBe("Test Listing with Mockup");

    // Cleanup
    await softDeleteListing(prisma, listing.id, testUserId);
  });

  // ============= Scenario 2: Handoff MockupJob → Listing =============
  it("Scenario 2: Handoff completed MockupJob to Listing (contract K5)", async () => {
    const req: HandoffRequest = {
      mockupJobId: testMockupJobId,
      selectionSetId: testSelectionSetId,
      title: "Canvas from Handoff",
      description: "Handoff-generated listing",
      category: "Art Prints",
      materials: [],
    };

    const response = await handoffService.handoffMockupToListing(
      testUserId,
      req
    );

    expect(response).toBeDefined();
    expect(response.listing).toBeDefined();
    expect(response.listing.mockupJobId).toBe(testMockupJobId);
    expect(response.listing.title).toBe("Canvas from Handoff");
    expect(response.mockupCount).toBeGreaterThanOrEqual(0);
    expect(response.message).toContain("Listing created from MockupJob");

    // Cleanup
    await softDeleteListing(prisma, response.listing.id, testUserId);
  });

  // ============= Scenario 3: ProductType inference =============
  it("Scenario 3: Handoff infers productTypeId from SelectionSet metadata", async () => {
    const req: HandoffRequest = {
      mockupJobId: testMockupJobId,
      selectionSetId: testSelectionSetId,
      materials: [],
      // No explicit productTypeId; should be inferred from metadata
    };

    const response = await handoffService.handoffMockupToListing(
      testUserId,
      req
    );

    expect(response.listing.productTypeId).toBe(testProductTypeId);

    // Cleanup
    await softDeleteListing(prisma, response.listing.id, testUserId);
  });

  // ============= Scenario 4: K6 Lock — immutable mockupJobId =============
  it("Scenario 4: K6 Lock — cannot update mockupJobId after creation", async () => {
    const listing = await createListingInternal(prisma, {
      userId: testUserId,
      mockupJobId: testMockupJobId,
      title: "Original Listing",
      tags: [],
      materials: [],
    });

    // Try to change mockupJobId
    const anotherJob = await prisma.mockupJob.create({
      data: {
        userId: testUserId,
        setId: testSelectionSetId,
        setSnapshotId: `snapshot2_${Date.now()}`,
        categoryId: "canvas",
        status: "COMPLETED",
        packSize: 10,
        actualPackSize: 10,
        totalRenders: 10,
        successRenders: 10,
        failedRenders: 0,
      },
    });

    await expect(
      updateListing(prisma, listing.id, testUserId, {
        mockupJobId: anotherJob.id,
        tags: [],
        materials: [],
      })
    ).rejects.toThrow("K6 Lock");

    // Cleanup
    await softDeleteListing(prisma, listing.id, testUserId);
    await prisma.mockupJob.delete({ where: { id: anotherJob.id } });
  });

  // ============= Scenario 5: Authorization — user isolation =============
  it("Scenario 5: Authorization enforced — user isolation", async () => {
    // Create another user
    const otherUser = await prisma.user.create({
      data: {
        email: `other-user-${Date.now()}@example.com`,
        passwordHash: "test_hash",
        role: "USER",
      },
    });

    const listing = await createListingInternal(prisma, {
      userId: testUserId,
      mockupJobId: testMockupJobId,
      title: "User1 Listing",
      tags: [],
      materials: [],
    });

    // Other user cannot access
    const result = await getListingById(
      prisma,
      listing.id,
      otherUser.id
    );
    expect(result).toBeNull();

    // Cleanup
    await softDeleteListing(prisma, listing.id, testUserId);
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  // ============= Scenario 6: Validation — job status =============
  it("Scenario 6: Handoff validates job status (COMPLETED or PARTIAL_COMPLETE)", async () => {
    // Create QUEUED job (invalid for handoff)
    const queuedJob = await prisma.mockupJob.create({
      data: {
        userId: testUserId,
        setId: testSelectionSetId,
        setSnapshotId: `snapshot3_${Date.now()}`,
        categoryId: "canvas",
        status: "QUEUED",
        packSize: 10,
        actualPackSize: 0,
        totalRenders: 0,
        successRenders: 0,
        failedRenders: 0,
      },
    });

    const req: HandoffRequest = {
      mockupJobId: queuedJob.id,
      selectionSetId: testSelectionSetId,
      materials: [],
    };

    await expect(
      handoffService.handoffMockupToListing(testUserId, req)
    ).rejects.toThrow("Invalid MockupJob status");

    // Cleanup
    await prisma.mockupJob.delete({ where: { id: queuedJob.id } });
  });

  // ============= Scenario 7: Legacy backward compat =============
  it("Scenario 7: Legacy backward compat — Listing without mockupJobId", async () => {
    const listing = await createListingInternal(prisma, {
      userId: testUserId,
      title: "Legacy Listing",
      description: "No mockup job reference",
      tags: [],
      materials: [],
    });

    expect(listing.mockupJobId).toBeNull();
    expect(listing.title).toBe("Legacy Listing");

    // Should list fine
    const listings = await listListingsByUser(prisma, testUserId, {
      limit: 100,
    });
    const found = listings.find((l) => l.id === listing.id);
    expect(found).toBeDefined();

    // Cleanup
    await softDeleteListing(prisma, listing.id, testUserId);
  });

  // ============= Helper: Count by MockupJob =============
  it("Helper: Count Listings by MockupJob", async () => {
    const listing = await createListingInternal(prisma, {
      userId: testUserId,
      mockupJobId: testMockupJobId,
      title: "Count Test",
      tags: [],
      materials: [],
    });

    const count = await countListingsByMockupJob(
      prisma,
      testMockupJobId
    );
    expect(count).toBeGreaterThan(0);

    // Cleanup
    await softDeleteListing(prisma, listing.id, testUserId);
  });
});
