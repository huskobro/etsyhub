import {
  BookmarkStatus,
  RiskLevel,
  SourcePlatform,
  type Prisma,
} from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";
import { assertOwnsResource } from "@/server/authorization";
import type {
  CreateBookmarkInput,
  UpdateBookmarkInput,
  ListBookmarksQuery,
} from "@/features/bookmarks/schemas";

export async function listBookmarks(args: {
  userId: string;
  query: ListBookmarksQuery;
}) {
  const { userId } = args;
  const { status, productTypeId, collectionId, q, limit, cursor } = args.query;

  const where: Prisma.BookmarkWhereInput = {
    userId,
    deletedAt: null,
    ...(status ? { status: status as BookmarkStatus } : {}),
    ...(productTypeId ? { productTypeId } : {}),
    ...(collectionId ? { collectionId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { notes: { contains: q, mode: "insensitive" } },
            { sourceUrl: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await db.bookmark.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      asset: true,
      productType: { select: { id: true, key: true, displayName: true } },
      collection: { select: { id: true, name: true } },
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return { items, nextCursor };
}

export async function getBookmark(args: { userId: string; id: string }) {
  const bookmark = await db.bookmark.findFirst({
    where: { id: args.id, deletedAt: null },
    include: {
      asset: true,
      productType: true,
      collection: true,
      tags: { include: { tag: true } },
    },
  });
  if (!bookmark) throw new NotFoundError("Bookmark bulunamadı");
  assertOwnsResource(args.userId, bookmark);
  return bookmark;
}

export async function createBookmark(args: {
  userId: string;
  input: CreateBookmarkInput;
}) {
  const { userId, input } = args;
  if (input.productTypeId) {
    const pt = await db.productType.findUnique({
      where: { id: input.productTypeId },
    });
    if (!pt) throw new NotFoundError("Ürün tipi bulunamadı");
  }
  if (input.collectionId) {
    await ensureCollectionOwned(userId, input.collectionId);
  }
  if (input.assetId) {
    await ensureAssetOwned(userId, input.assetId);
  }
  if (input.tagIds?.length) {
    await ensureTagsOwned(userId, input.tagIds);
  }

  return db.bookmark.create({
    data: {
      userId,
      sourceUrl: input.sourceUrl,
      sourcePlatform: (input.sourcePlatform as SourcePlatform | undefined) ?? SourcePlatform.OTHER,
      assetId: input.assetId,
      title: input.title,
      notes: input.notes,
      productTypeId: input.productTypeId,
      collectionId: input.collectionId,
      status: BookmarkStatus.INBOX,
      ...(input.tagIds?.length
        ? {
            tags: {
              create: input.tagIds.map((tagId) => ({ tagId })),
            },
          }
        : {}),
    },
    include: {
      asset: true,
      productType: true,
      collection: true,
      tags: { include: { tag: true } },
    },
  });
}

export async function updateBookmark(args: {
  userId: string;
  id: string;
  input: UpdateBookmarkInput;
}) {
  const existing = await getBookmark({ userId: args.userId, id: args.id });
  const input = args.input;

  if (input.collectionId) {
    await ensureCollectionOwned(args.userId, input.collectionId);
  }
  if (input.assetId) {
    await ensureAssetOwned(args.userId, input.assetId);
  }

  const data: Prisma.BookmarkUpdateInput = {
    title: input.title,
    notes: input.notes,
    sourceUrl: input.sourceUrl,
    sourcePlatform: input.sourcePlatform as SourcePlatform | undefined,
    status: input.status as BookmarkStatus | undefined,
    riskLevel: input.riskLevel as RiskLevel | undefined,
    asset: input.assetId ? { connect: { id: input.assetId } } : undefined,
    productType: input.productTypeId
      ? { connect: { id: input.productTypeId } }
      : undefined,
    collection:
      input.collectionId === null
        ? { disconnect: true }
        : input.collectionId
          ? { connect: { id: input.collectionId } }
          : undefined,
  };

  if (input.tagIds) {
    await ensureTagsOwned(args.userId, input.tagIds);
    await db.bookmarkTag.deleteMany({ where: { bookmarkId: existing.id } });
    if (input.tagIds.length > 0) {
      await db.bookmarkTag.createMany({
        data: input.tagIds.map((tagId) => ({
          bookmarkId: existing.id,
          tagId,
        })),
        skipDuplicates: true,
      });
    }
  }

  return db.bookmark.update({
    where: { id: existing.id },
    data,
    include: {
      asset: true,
      productType: true,
      collection: true,
      tags: { include: { tag: true } },
    },
  });
}

export async function softDeleteBookmark(args: { userId: string; id: string }) {
  const existing = await getBookmark({ userId: args.userId, id: args.id });
  return db.bookmark.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), status: BookmarkStatus.ARCHIVED },
  });
}

async function ensureAssetOwned(userId: string, assetId: string) {
  const asset = await db.asset.findFirst({
    where: { id: assetId, deletedAt: null },
    select: { userId: true },
  });
  if (!asset) throw new NotFoundError("Asset bulunamadı");
  assertOwnsResource(userId, asset);
}

async function ensureCollectionOwned(userId: string, collectionId: string) {
  const c = await db.collection.findFirst({
    where: { id: collectionId, deletedAt: null },
    select: { userId: true },
  });
  if (!c) throw new NotFoundError("Koleksiyon bulunamadı");
  assertOwnsResource(userId, c);
}

async function ensureTagsOwned(userId: string, tagIds: string[]) {
  const tags = await db.tag.findMany({
    where: { id: { in: tagIds } },
    select: { id: true, userId: true },
  });
  if (tags.length !== tagIds.length) {
    throw new NotFoundError("Tag bulunamadı");
  }
  for (const t of tags) assertOwnsResource(userId, t);
}
