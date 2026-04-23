import { db } from "@/server/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { assertOwnsResource } from "@/server/authorization";
import type { CreateTagInput, UpdateTagInput } from "@/features/tags/schemas";

export async function listTags(userId: string) {
  return db.tag.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

export async function getTag(args: { userId: string; id: string }) {
  const tag = await db.tag.findUnique({ where: { id: args.id } });
  if (!tag) throw new NotFoundError("Tag bulunamadı");
  assertOwnsResource(args.userId, tag);
  return tag;
}

export async function createTag(args: {
  userId: string;
  input: CreateTagInput;
}) {
  try {
    return await db.tag.create({
      data: {
        userId: args.userId,
        name: args.input.name,
        color: args.input.color,
      },
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      throw new ConflictError("Aynı isimli tag zaten var");
    }
    throw err;
  }
}

export async function updateTag(args: {
  userId: string;
  id: string;
  input: UpdateTagInput;
}) {
  const existing = await getTag({ userId: args.userId, id: args.id });
  return db.tag.update({
    where: { id: existing.id },
    data: {
      name: args.input.name ?? undefined,
      color: args.input.color === undefined ? undefined : args.input.color,
    },
  });
}

export async function deleteTag(args: { userId: string; id: string }) {
  const existing = await getTag({ userId: args.userId, id: args.id });
  await db.tag.delete({ where: { id: existing.id } });
  return { id: existing.id };
}
