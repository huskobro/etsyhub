export type ListingCursor = { firstSeenAt: Date; listingId: string };

export function encodeListingCursor(c: ListingCursor): string {
  return Buffer.from(`${c.firstSeenAt.toISOString()}|${c.listingId}`, "utf8").toString("base64");
}

export function decodeListingCursor(raw: string | null | undefined): ListingCursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const [firstSeenAtStr, listingId] = decoded.split("|");

    if (!firstSeenAtStr || !listingId) return null;

    const firstSeenAt = new Date(firstSeenAtStr);
    if (Number.isNaN(firstSeenAt.getTime())) return null;

    return { firstSeenAt, listingId };
  } catch {
    return null;
  }
}
