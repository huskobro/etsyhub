import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { db } from "@/server/db";

const body = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  const flag = await db.featureFlag.findUnique({ where: { key: "registration.enabled" } });
  if (!flag?.enabled) {
    return NextResponse.json({ error: "Kayıt şu an kapalı." }, { status: 403 });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const exists = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (exists) {
    return NextResponse.json({ error: "Bu e-posta kullanımda." }, { status: 409 });
  }

  await db.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      role: UserRole.USER,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
