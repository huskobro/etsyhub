/**
 * Phase 9 Task 1-3: Listing Handoff Foundation
 * Domain types (services + types only; schemas in schemas.ts).
 */

import { Listing, ListingStatus } from "@prisma/client";

/**
 * Public listing DTO (client-safe projection).
 * Açık hangi alanlar harici kaynaklar için sağlanır.
 */
export interface ListingDTO {
  id: string;
  userId: string;
  storeId: string | null;
  generatedDesignId: string | null;
  productTypeId: string | null;
  mockupJobId: string | null; // Phase 9
  title: string | null;
  description: string | null;
  tags: string[];
  category: string | null;
  priceCents: number | null;
  materials: string[];
  status: ListingStatus;
  etsyDraftId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Mock data for Phase 9 integration tests.
 */
export const MOCK_LISTING_ID = "listing_mock_001";
export const MOCK_MOCKUP_JOB_ID = "job_mock_canvas_001";
export const MOCK_PRODUCT_TYPE_ID = "pt_canvas";
