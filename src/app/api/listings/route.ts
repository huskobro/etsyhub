// Phase 9 V1 Task 18 — GET /api/listings (list user listings).
//
// Endpoint: GET /api/listings
// Response: { listings: ListingCompact[], pagination: {...} }
// Query params: status, limit, offset (optional, V1 basic)
//
// Spec §6.1 (listing index). Compact format (no readiness for perf).
// User sees own; admin can see all (future role support).

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { db } from "@/server/db";

// ────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────

async function handleList(req: NextRequest) {
  // 1. Auth guard
  const user = await requireUser();
  const userId = user.id;

  // 2. Parse query params (basic, V1)
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const limitStr = url.searchParams.get("limit");
  const offsetStr = url.searchParams.get("offset");

  const limit = limitStr ? Math.min(parseInt(limitStr), 100) : 50;
  const offset = offsetStr ? parseInt(offsetStr) : 0;

  // Validate limit/offset
  if (isNaN(limit) || isNaN(offset) || limit < 1 || offset < 0) {
    throw new ValidationError("Invalid limit/offset");
  }

  // 3. Build filter (V1: status optional, user-scoped)
  const where: any = {
    userId,
  };

  if (statusParam) {
    where.status = statusParam;
  }

  // 4. Fetch listings (compact index, no readiness)
  const listings = await db.listing.findMany({
    where,
    select: {
      id: true,
      status: true,
      title: true,
      mockupJobId: true,
      coverRenderId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  // 5. Fetch total count
  const total = await db.listing.count({ where });

  // 6. Return response
  return NextResponse.json({
    listings,
    pagination: {
      limit,
      offset,
      total,
      hasMore: offset + limit < total,
    },
  });
}

export const GET = withErrorHandling(handleList);
