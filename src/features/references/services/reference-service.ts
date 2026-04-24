import { BookmarkStatus, type Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { assertOwnsResource } from "@/server/authorization";
import type {
  CreateReferenceInput,
  UpdateReferenceInput,
  PromoteBookmarkInput,
  ListReferencesQuery,
} from "@/features/references/schemas";

export async function listReferences(args: {
  userId: string;
  query: ListReferencesQuery;
}) {
  const { userId } = args;
  const { productTypeId, collectionId, q, limit, cursor } = args.query;

  const where: Prisma.ReferenceWhereInput = {
    userId,
    deletedAt: null,
    ...(productTypeId ? { productTypeId } : {}),
    ...(collectionId === "uncategorized"
      ? { collectionId: null }
      : collectionId
        ? { collectionId }
        : {}),
    ...(q
      ? {
          OR: [
            { notes: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await db.reference.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      asset: true,
      productType: { select: { id: true, key: true, displayName: true } },
      collection: { select: { id: true, name: true } },
      bookmark: { select: { id: true, title: true, sourceUrl: true } },
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return { items, nextCursor };
}

export async function getReference(args: { userId: string; id: string }) {
  const ref = await db.reference.findFirst({
    where: { id: args.id, deletedAt: null },
    include: {
      asset: true,
      productType: true,
      collection: true,
      bookmark: true,
      tags: { include: { tag: true } },
    },
  });
  if (!ref) throw new NotFoundError("Referans bulunamadı");
  assertOwnsResource(args.userId, ref);
  return ref;
}

export async function createReference(args: {
  userId: string;
  input: CreateReferenceInput;
}) {
  const { userId, input } = args;

  await ensureAssetOwned(userId, input.assetId);
  await ensureProductType(input.productTypeId);
  if (input.collectionId) await ensureCollectionOwned(userId, input.collectionId);
  if (input.bookmarkId) await ensureBookmarkOwned(userId, input.bookmarkId);
  if (input.tagIds?.length) await ensureTagsOwned(userId, input.tagIds);

  return db.reference.create({
    data: {
      userId,
      assetId: input.assetId,
      productTypeId: input.productTypeId,
      bookmarkId: input.bookmarkId,
      collectionId: input.collectionId,
      notes: input.notes,
      ...(input.tagIds?.length
        ? { tags: { create: input.tagIds.map((tagId) => ({ tagId })) } }
        : {}),
    },
    include: {
      asset: true,
      productType: true,
      collection: true,
      bookmark: true,
      tags: { include: { tag: true } },
    },
  });
}

export async function updateReference(args: {
  userId: string;
  id: string;
  input: UpdateReferenceInput;
}) {
  const existing = await getReference({ userId: args.userId, id: args.id });
  const input = args.input;

  if (input.productTypeId) await ensureProductType(input.productTypeId);
  if (input.collectionId) await ensureCollectionOwned(args.userId, input.collectionId);

  const data: Prisma.ReferenceUpdateInput = {
    notes: input.notes ?? undefined,
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
    await db.referenceTag.deleteMany({ where: { referenceId: existing.id } });
    if (input.tagIds.length > 0) {
      await db.referenceTag.createMany({
        data: input.tagIds.map((tagId) => ({
          referenceId: existing.id,
          tagId,
        })),
        skipDuplicates: true,
      });
    }
  }

  return db.reference.update({
    where: { id: existing.id },
    data,
    include: {
      asset: true,
      productType: true,
      collection: true,
      bookmark: true,
      tags: { include: { tag: true } },
    },
  });
}

export async function softDeleteReference(args: {
  userId: string;
  id: string;
}) {
  const existing = await getReference({ userId: args.userId, id: args.id });
  return db.reference.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });
}

export async function createReferenceFromBookmark(args: {
  userId: string;
  input: PromoteBookmarkInput;
}) {
  const { userId, input } = args;
  const bm = await db.bookmark.findFirst({
    where: { id: input.bookmarkId, deletedAt: null },
  });
  if (!bm) throw new NotFoundError("Bookmark bulunamadı");
  assertOwnsResource(userId, bm);

  if (!bm.assetId) {
    throw new ValidationError(
      "Bookmark'ın asset'i yok; önce görsel ekle veya URL import tamamlansın",
    );
  }

  await ensureProductType(input.productTypeId);
  if (input.collectionId) await ensureCollectionOwned(userId, input.collectionId);

  const created = await db.$transaction(async (tx) => {
    const ref = await tx.reference.create({
      data: {
        userId,
        assetId: bm.assetId!,
        productTypeId: input.productTypeId,
        bookmarkId: bm.id,
        collectionId: input.collectionId,
        notes: input.notes ?? bm.notes ?? undefined,
      },
      include: {
        asset: true,
        productType: true,
        collection: true,
        bookmark: true,
        tags: { include: { tag: true } },
      },
    });
    await tx.bookmark.update({
      where: { id: bm.id },
      data: { status: BookmarkStatus.REFERENCED },
    });
    return ref;
  });

  return created;
}

async function ensureAssetOwned(userId: string, assetId: string) {
  const asset = await db.asset.findFirst({
    where: { id: assetId, deletedAt: null },
    select: { userId: true },
  });
  if (!asset) throw new NotFoundError("Asset bulunamadı");
  assertOwnsResource(userId, asset);
}

async function ensureBookmarkOwned(userId: string, bookmarkId: string) {
  const bm = await db.bookmark.findFirst({
    where: { id: bookmarkId, deletedAt: null },
    select: { userId: true },
  });
  if (!bm) throw new NotFoundError("Bookmark bulunamadı");
  assertOwnsResource(userId, bm);
}

async function ensureCollectionOwned(userId: string, collectionId: string) {
  const c = await db.collection.findFirst({
    where: { id: collectionId, deletedAt: null },
    select: { userId: true },
  });
  if (!c) throw new NotFoundError("Koleksiyon bulunamadı");
  assertOwnsResource(userId, c);
}

async function ensureProductType(productTypeId: string) {
  const pt = await db.productType.findUnique({
    where: { id: productTypeId },
    select: { id: true },
  });
  if (!pt) throw new NotFoundError("Ürün tipi bulunamadı");
}

async function ensureTagsOwned(userId: string, tagIds: string[]) {
  if (tagIds.length === 0) return;
  const tags = await db.tag.findMany({
    where: { id: { in: tagIds } },
    select: { id: true, userId: true },
  });
  if (tags.length !== tagIds.length) {
    throw new NotFoundError("Tag bulunamadı");
  }
  for (const t of tags) assertOwnsResource(userId, t);
}
