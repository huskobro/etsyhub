import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";

export const GET = withErrorHandling(async () => {
  await requireAdmin();
  const users = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ users });
});

const patchBody = z.object({
  userId: z.string().min(1),
  role: z.enum(["USER", "ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
});

export const PATCH = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = patchBody.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const { userId, role, status } = parsed.data;
  const user = await db.user.update({
    where: { id: userId },
    data: {
      role: role ? (role as UserRole) : undefined,
      status: status ? (status as UserStatus) : undefined,
    },
    select: { id: true, email: true, role: true, status: true },
  });
  await audit({
    actor: admin.email,
    userId: admin.id,
    action: "admin.user.update",
    targetType: "User",
    targetId: userId,
    metadata: { role, status },
  });
  return NextResponse.json({ user });
});
