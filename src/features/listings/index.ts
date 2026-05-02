/**
 * Phase 9 Task 1-3: Listing Foundation
 * Barrel exports for listings feature.
 */

// Types (interfaces only)
export type { ListingDTO } from "./types";
export { MOCK_LISTING_ID, MOCK_MOCKUP_JOB_ID, MOCK_PRODUCT_TYPE_ID } from "./types";

// Schemas (Zod + inferred types)
export {
  ListingDTOSchema,
  CreateListingSchema,
  UpdateListingSchema,
  HandoffRequestSchema,
  HandoffResponseSchema,
  ListingFilterSchema,
} from "./schemas";
export type {
  CreateListingPayload,
  UpdateListingPayload,
  HandoffRequest,
  HandoffResponse,
  ListingFilter,
} from "./schemas";

// Services
export { createListingInternal, getListingById, updateListing, listListingsByUser, softDeleteListing, countListingsByMockupJob } from "./server/listing.service";
export { HandoffService } from "./server/handoff.service";
