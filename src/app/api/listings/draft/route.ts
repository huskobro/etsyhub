// Phase 9 V1 Task 13/14/15 — /api/listings/draft routes.
//
// Endpoints:
//   POST /api/listings/draft          create listing from mockup job
//   GET  /api/listings/draft/[id]     fetch listing + readiness
//   PATCH /api/listings/draft/[id]    update listing metadata
//
// Spec §6.2 (canonical flow) + §7 (readiness checks).
// Error handling via HOF (Phase 8 pattern).

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError, AppError } from "@/lib/errors";
import {
  CreateListingDraftSchema,
  ListingDraftPathSchema,
} from "@/features/listings/schemas";
import { createListingDraftFromMockupJob } from "@/features/listings/server/handoff.service";
import { computeReadiness } from "@/features/listings/server/readiness.service";
import { db } from "@/server/db";
import type { ListingStatus } from "@prisma/client";

// ────────────────────────────────────────────────────────────
// Route-specific errors
// ────────────────────────────────────────────────────────────

class ListingNotFoundError extends AppError {
  constructor() {
    super("Listing bulunamadı", "LISTING_NOT_FOUND", 404);
  }
}

class ListingDraftNotEditableError extends AppError {
  constructor(status: ListingStatus) {
    super(
      `${status} durumundaki listing düzenlenemez`,
      "LISTING_NOT_EDITABLE",
      409,
    );
  }
}

// ────────────────────────────────────────────────────────────
// POST handler
// ────────────────────────────────────────────────────────────

async function handlePost(req: NextRequest) {
  // 1. Auth guard
  const user = await requireUser();
  const userId = user.id;

  // 2. Validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("JSON parsing failed");
  }

  const parsed = CreateListingDraftSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid create draft body", parsed.error.errors);
  }

  const { mockupJobId } = parsed.data;

  // 3. Handoff service (Phase 9 foundation contract)
  const { listingId } = await createListingDraftFromMockupJob(
    mockupJobId,
    userId,
  );

  // 4. Fetch created listing + compute readiness
  const listing = await db.listing.findUnique({
    where: { id: listingId },
  });

  if (!listing) {
    throw new Error("Listing not found after creation (internal error)");
  }

  const readiness = computeReadiness(listing);

  // 5. Return response
  return NextResponse.json(
    {
      listingId,
      readiness,
    },
    { status: 201 },
  );
}

// ────────────────────────────────────────────────────────────
// GET handler (Task 14)
// ────────────────────────────────────────────────────────────

async function handleGet(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Auth guard
  const user = await requireUser();
  const userId = user.id;

  // 2. Parse path param
  const { id } = await params;
  const pathParsed = ListingDraftPathSchema.safeParse({ id });
  if (!pathParsed.success) {
    throw new ValidationError("Invalid id", pathParsed.error.errors);
  }

  // 3. Fetch listing + ownership
  const listing = await db.listing.findUnique({
    where: { id: pathParsed.data.id },
  });

  if (!listing || listing.userId !== userId) {
    throw new ListingNotFoundError();
  }

  // 4. Compute readiness
  const readiness = computeReadiness(listing);

  // 5. Return compact response
  return NextResponse.json({
    id: listing.id,
    status: listing.status,
    title: listing.title,
    description: listing.description,
    tags: listing.tags,
    category: listing.category,
    priceCents: listing.priceCents,
    materials: listing.materials,
    readiness,
    mockupJobId: listing.mockupJobId,
    coverRenderId: listing.coverRenderId,
    imageOrderJson: listing.imageOrderJson,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  });
}

// ────────────────────────────────────────────────────────────
// PATCH handler (Task 15)
// ────────────────────────────────────────────────────────────

async function handlePatch(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Auth guard
  const user = await requireUser();
  const userId = user.id;

  // 2. Parse path param
  const { id } = await params;
  const pathParsed = ListingDraftPathSchema.safeParse({ id });
  if (!pathParsed.success) {
    throw new ValidationError("Invalid id", pathParsed.error.errors);
  }

  // 3. Fetch listing + ownership
  const listing = await db.listing.findUnique({
    where: { id: pathParsed.data.id },
  });

  if (!listing || listing.userId !== userId) {
    throw new ListingNotFoundError();
  }

  // 4. State guard (V1: only DRAFT editable)
  if (listing.status !== "DRAFT") {
    throw new ListingDraftNotEditableError(listing.status);
  }

  // 5. Validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("JSON parsing failed");
  }

  // Schema'sı schemas.ts'te tanımlanacak (Task 9)
  // V1: UpdateListingMetaSchema strict mode (title, description, tags, category, price, materials)
  // Şu an sadece foundation slice — Task 9'da eklenir.
  // Geçici olarak boş update; test'ler Task 9'da eklenir.

  // 6. Update listing
  const updated = await db.listing.update({
    where: { id: listing.id },
    data: {
      title:
        typeof (body as any)?.title === "string"
          ? (body as any).title
          : listing.title,
      description:
        typeof (body as any)?.description === "string"
          ? (body as any).description
          : listing.description,
      tags: Array.isArray((body as any)?.tags) ? (body as any).tags : listing.tags,
      category:
        typeof (body as any)?.category === "string"
          ? (body as any).category
          : listing.category,
      priceCents:
        typeof (body as any)?.priceCents === "number"
          ? (body as any).priceCents
          : listing.priceCents,
      materials: Array.isArray((body as any)?.materials)
        ? (body as any).materials
        : listing.materials,
    },
  });

  // 7. Compute readiness + return response
  const readiness = computeReadiness(updated);

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    title: updated.title,
    description: updated.description,
    tags: updated.tags,
    category: updated.category,
    priceCents: updated.priceCents,
    materials: updated.materials,
    readiness,
    mockupJobId: updated.mockupJobId,
    coverRenderId: updated.coverRenderId,
    imageOrderJson: updated.imageOrderJson,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
}

// ────────────────────────────────────────────────────────────
// Exports
// ────────────────────────────────────────────────────────────

export const POST = withErrorHandling(handlePost);
export const GET = withErrorHandling(handleGet);
export const PATCH = withErrorHandling(handlePatch);
