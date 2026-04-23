import { UserRole } from "@prisma/client";
import { auth } from "@/server/auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) throw new ForbiddenError();
  return user;
}
