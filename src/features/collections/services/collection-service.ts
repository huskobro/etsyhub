import { CollectionKind, type Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { assertOwnsResource } from "@/server/authorization";
import type {
  CreateCollectionInput,
  ListCollectionsQuery,
  UpdateCollectionInput,
} from "@/features/collections/schemas";

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "koleksiyon";
}

async function uniqueSlug(userId: string, base: string) {
  let slug = base;
  let i = 1;
  while (
    await db.collection.findFirst({
      where: { userId, slug, deletedAt: null },
      select: { id: true },
    })
  ) {
    i += 1;
    slug = `${base}-${i}`;
  }
  return slug;
}

export async function listCollections(args: {
  userId: string;
  query: ListCollectionsQuery;
}) {
  const { userId } = args;
  const { kind, q, limit } = args.query;

  const where: Prisma.CollectionWhereInput = {
    userId,
    deletedAt: null,
    ...(kind ? { kind: kind as CollectionKind } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return db.collection.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      _count: { select: { bookmarks: true, references: true } },
    },
  });
}

export async function getCollection(args: { userId: string; id: string }) {
  const c = await db.collection.findFirst({
    where: { id: args.id, deletedAt: null },
    include: {
      _count: { select: { bookmarks: true, references: true } },
    },
  });
  if (!c) throw new NotFoundError("Koleksiyon bulunamadı");
  assertOwnsResource(args.userId, c);
  return c;
}

export async function createCollection(args: {
  userId: string;
  input: CreateCollectionInput;
}) {
  const nameClash = await db.collection.findFirst({
    where: { userId: args.userId, name: args.input.name, deletedAt: null },
    select: { id: true },
  });
  if (nameClash) throw new ConflictError("Aynı isimli koleksiyon zaten var");

  const base = slugify(args.input.name);
  const slug = await uniqueSlug(args.userId, base);
  try {
    return await db.collection.create({
      data: {
        userId: args.userId,
        name: args.input.name,
        description: args.input.description,
        kind: args.input.kind as CollectionKind,
        slug,
      },
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new ConflictError("Aynı isimli koleksiyon zaten var");
    }
    throw err;
  }
}

export async function updateCollection(args: {
  userId: string;
  id: string;
  input: UpdateCollectionInput;
}) {
  const existing = await getCollection({ userId: args.userId, id: args.id });
  const { name, description, kind } = args.input;
  return db.collection.update({
    where: { id: existing.id },
    data: {
      name: name ?? undefined,
      description: description ?? undefined,
      kind: (kind as CollectionKind | undefined) ?? undefined,
    },
  });
}

export async function softDeleteCollection(args: {
  userId: string;
  id: string;
}) {
  const existing = await getCollection({ userId: args.userId, id: args.id });
  return db.collection.update({
    where: { id: existing.id },
    data: { deletedAt: new Date() },
  });
}
