import { notFound } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { S7JobView } from "@/features/mockups/components/S7JobView";

export const metadata = { title: "Mockup Job — EtsyHub" };

export default async function Page({
  params,
}: {
  params: { setId: string; jobId: string };
}) {
  const session = await auth();
  if (!session?.user) notFound();

  // SSR ownership check: set + job (cross-user 404)
  const set = await db.selectionSet.findFirst({
    where: { id: params.setId, userId: session.user.id },
    select: { id: true },
  });
  if (!set) notFound();

  const job = await db.mockupJob.findFirst({
    where: { id: params.jobId, userId: session.user.id, setId: params.setId },
    select: { id: true },
  });
  if (!job) notFound();

  return <S7JobView setId={params.setId} jobId={params.jobId} />;
}
