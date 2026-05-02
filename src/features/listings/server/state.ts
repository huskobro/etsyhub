// Phase 9 V1 Task 7 — Listing state machine (foundation slice).
//
// Listing status transitions + invariants.
// State: draft → scheduled/failed → published (future V2+)
// V1: DRAFT (only state)
//
// Spec §5.1 (state machine rules) + §3.3.1 (invariants).

import { ListingStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";

// ────────────────────────────────────────────────────────────
// Listing state machine errors
// ────────────────────────────────────────────────────────────

export class ListingInvalidTransitionError extends AppError {
  constructor(fromStatus: ListingStatus, toStatus: ListingStatus) {
    super(
      `Listing '${fromStatus}' durumundan '${toStatus}' durumuna geçiş geçersiz`,
      "LISTING_INVALID_TRANSITION",
      409,
    );
  }
}

// ────────────────────────────────────────────────────────────
// V1 Invariants (K4 lock: state machine rules in code)
// ────────────────────────────────────────────────────────────

/**
 * V1 allowed transitions: only DRAFT (single state).
 * Future transitions (V2): DRAFT → SCHEDULED → PUBLISHED/FAILED (TBD).
 *
 * Invariant: Core state machine rules hardcoded, cannot be disabled.
 * (Spec §3.3.1: "Core invariants ... remain in code and cannot be disabled
 *  from admin panel.")
 */
export const ALLOWED_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  DRAFT: [], // V1 lock: no transitions; future SCHEDULED, FAILED (V2+)
  SCHEDULED: [], // Future V2
  PUBLISHED: [], // Future V2
  FAILED: [], // Future V2
  REJECTED: [], // Future: Task 17 review reject
  NEEDS_REVIEW: [], // Future: Task 17 soft warn → hard gate
};

/**
 * isValidTransition(from, to) — state machine guard.
 *
 * V1: Always false (no mutations except create → DRAFT).
 * Returns true only if 'to' in ALLOWED_TRANSITIONS[from].
 */
export function isValidTransition(
  from: ListingStatus,
  to: ListingStatus,
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) {
    return false; // Unknown state
  }
  return allowed.includes(to);
}

/**
 * assertValidTransition(from, to) — guard helper.
 * Throws ListingInvalidTransitionError if transition invalid.
 * Usage: API endpoint pre-checks before mutation.
 */
export function assertValidTransition(
  from: ListingStatus,
  to: ListingStatus,
): void {
  if (!isValidTransition(from, to)) {
    throw new ListingInvalidTransitionError(from, to);
  }
}

/**
 * isListingEditable(status) — V1 editability guard.
 *
 * V1: Only DRAFT and NEEDS_REVIEW are editable.
 * Terminal statuses (PUBLISHED, FAILED, REJECTED) are not editable.
 */
export function isListingEditable(status: ListingStatus): boolean {
  return status === "DRAFT" || status === "NEEDS_REVIEW";
}
