import { UserRole } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export type Role = "USER" | "ADMIN";
export type SessionLike = { role: Role } | null;

export function requireRole(session: SessionLike, role: Role) {
  if (!session) throw new UnauthorizedError();
  if (session.role !== role && session.role !== UserRole.ADMIN) throw new ForbiddenError();
}

export function assertOwnsResource(userId: string, resource: { userId: string }) {
  if (resource.userId !== userId) throw new ForbiddenError();
}

export function scopedWhere(userId: string) {
  return { userId, deletedAt: null as Date | null };
}
