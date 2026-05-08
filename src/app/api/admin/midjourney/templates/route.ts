// Pass 80 — MJ Templates CRUD endpoint.
//
// GET /api/admin/midjourney/templates
//   → list all MJ templates (with active version + extracted variables)
//
// POST /api/admin/midjourney/templates
//   body: { name, description?, productTypeKey?, promptTemplateText }
//   → create new MJ template + initial ACTIVE version

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { audit } from "@/server/audit";
import {
  createMjTemplate,
  listMjTemplates,
} from "@/server/services/midjourney/templates";

export const GET = withErrorHandling(async () => {
  await requireAdmin();
  const templates = await listMjTemplates();
  return NextResponse.json({ ok: true, templates });
});

const createBody = z.object({
  name: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-zA-Z0-9 _\-./]+$/, "Sadece harf, rakam, boşluk, _ - . /"),
  description: z.string().max(500).optional(),
  productTypeKey: z.string().min(1).max(60).optional(),
  promptTemplateText: z.string().min(3).max(2000),
});

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const parsed = createBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz template oluşturma isteği",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const result = await createMjTemplate({
      name: parsed.data.name,
      description: parsed.data.description,
      productTypeKey: parsed.data.productTypeKey,
      promptTemplateText: parsed.data.promptTemplateText,
    });

    await audit({
      actor: admin.id,
      action: "MIDJOURNEY_TEMPLATE_CREATE",
      targetType: "PromptTemplate",
      targetId: result.templateId,
      metadata: {
        name: parsed.data.name,
        productTypeKey: parsed.data.productTypeKey ?? null,
        promptTemplateText: parsed.data.promptTemplateText.slice(0, 500),
        variables: result.templateVariables,
      },
    });

    return NextResponse.json({ ok: true, template: result }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      throw new ValidationError("Bu isimde template zaten var", {
        name: ["Unique"],
      });
    }
    throw err;
  }
});
