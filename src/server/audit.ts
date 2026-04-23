import { db } from "@/server/db";

export type AuditArgs = {
  actor: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
};

export async function audit(args: AuditArgs): Promise<void> {
  await db.auditLog.create({
    data: {
      actor: args.actor,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      metadata: args.metadata as object | undefined,
      userId: args.userId,
    },
  });
}
