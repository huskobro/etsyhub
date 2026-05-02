/**
 * Phase 9 Task 1-3: Listing Handoff Foundation
 * Zod schemas for validation (request/response + handoff).
 */

import { z } from "zod";
import { ListingStatus } from "@prisma/client";

// ============= Base Schemas =============

const ListingStatusEnum = z.enum([
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
  "REJECTED",
  "NEEDS_REVIEW",
] as const);

const StringArrayOrEmpty = z.array(z.string()).default([]);
const OptionalPositiveInt = z.number().int().positive().nullable().optional();

// ============= Listing DTOs =============

export const ListingDTOSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  storeId: z.string().cuid().nullable(),
  generatedDesignId: z.string().cuid().nullable(),
  productTypeId: z.string().cuid().nullable(),
  mockupJobId: z.string().cuid().nullable(), // Phase 9
  title: z.string().max(500).nullable(),
  description: z.string().max(5000).nullable(),
  tags: StringArrayOrEmpty,
  category: z.string().max(200).nullable(),
  priceCents: OptionalPositiveInt,
  materials: StringArrayOrEmpty,
  status: ListingStatusEnum,
  etsyDraftId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
});

export type ListingDTO = z.infer<typeof ListingDTOSchema>;

// ============= Create/Update =============

export const CreateListingSchema = z.object({
  userId: z.string().cuid(),
  storeId: z.string().cuid().nullable().optional(),
  generatedDesignId: z.string().cuid().nullable().optional(),
  productTypeId: z.string().cuid().nullable().optional(),
  mockupJobId: z.string().cuid().nullable().optional(), // Phase 9
  title: z.string().max(500).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().max(200).nullable().optional(),
  priceCents: OptionalPositiveInt,
  materials: z.array(z.string()).optional().default([]),
});

export type CreateListingPayload = z.infer<typeof CreateListingSchema>;

export const UpdateListingSchema = z.object({
  title: z.string().max(500).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().max(200).nullable().optional(),
  priceCents: OptionalPositiveInt,
  materials: z.array(z.string()).optional().default([]),
  status: ListingStatusEnum.optional(),
  mockupJobId: z.string().cuid().nullable().optional(), // Phase 9 handoff
  etsyDraftId: z.string().nullable().optional(),
});

export type UpdateListingPayload = z.infer<typeof UpdateListingSchema>;

// ============= Handoff (Phase 9 Task 2) =============

export const HandoffRequestSchema = z.object({
  mockupJobId: z.string().cuid().describe("MockupJob immutable reference"),
  selectionSetId: z.string().cuid().describe("Context selection set"),
  productTypeId: z.string().cuid().nullable().optional(),
  title: z.string().max(500).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  category: z.string().max(200).nullable().optional(),
  materials: z.array(z.string()).optional().default([]),
  priceCents: OptionalPositiveInt,
});

export type HandoffRequest = z.infer<typeof HandoffRequestSchema>;

export const HandoffResponseSchema = z.object({
  listing: ListingDTOSchema,
  mockupCount: z.number().int().nonnegative(),
  message: z.string(),
});

export type HandoffResponse = z.infer<typeof HandoffResponseSchema>;

// ============= Pagination / Query =============

export const ListingFilterSchema = z
  .object({
    userId: z.string().cuid(),
    storeId: z.string().cuid().nullable().optional(),
    status: ListingStatusEnum.nullable().optional(),
    productTypeId: z.string().cuid().nullable().optional(),
    mockupJobId: z.string().cuid().nullable().optional(), // Phase 9
    limit: z.number().int().positive().max(100).default(20),
    offset: z.number().int().nonnegative().default(0),
  })
  .partial()
  .required({ userId: true });

export type ListingFilter = z.infer<typeof ListingFilterSchema>;
