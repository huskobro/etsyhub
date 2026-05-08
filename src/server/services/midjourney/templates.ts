// Pass 80 — MJ Persisted Templates service.
//
// Mevcut PromptTemplate Prisma modelini MJ için reuse eder
// (`taskType="midjourney_generate"`). Schema değişikliği YAPILMAZ —
// `PromptVersion.userPromptTemplate` alanına Mustache template yazılır,
// versiyonlama zaten var.
//
// Tasarım:
//   - taskType = "midjourney_generate" sabit (audit B kararı)
//   - providerKind = ProviderKind.AI (mevcut enum'da MJ için ayrı yok;
//     AI generic kategorisi yeterli)
//   - Active version filter (PromptStatus.ACTIVE) ile her template'in
//     "şu an kullanılan" sürümü resolve edilir
//   - userPromptTemplate alanına Mustache `{{var}}` template
//   - Caller (createMidjourneyJobFromTemplate / batch) bu template'i
//     ALIR + variables ile expand eder
//
// Domain-bağımsızlık: bu service MJ'a özel ama core helper
// (src/lib/prompt-template.ts) hâlâ taşınabilir; sadece persistence
// MJ scope.

import { PromptStatus, ProviderKind } from "@prisma/client";
import { db } from "@/server/db";

const MJ_TASK_TYPE = "midjourney_generate";

export type MjTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  productTypeKey: string | null;
  activeVersionId: string | null;
  activeVersion: number | null;
  promptTemplateText: string | null;
  templateVariables: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type ResolvedMjTemplate = {
  templateId: string;
  templateName: string;
  versionId: string;
  version: number;
  /** Mustache `{{var}}` syntax — caller expandPromptTemplate ile expand eder. */
  promptTemplateText: string;
  /** Template'te bulunan variable adları (UI form için). */
  templateVariables: string[];
};

/** Aktif version'lı tek template'i getirir (id ile). */
export async function getMjTemplate(
  templateId: string,
): Promise<ResolvedMjTemplate | null> {
  const tpl = await db.promptTemplate.findFirst({
    where: { id: templateId, taskType: MJ_TASK_TYPE },
    include: {
      versions: {
        where: { status: PromptStatus.ACTIVE },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });
  if (!tpl) return null;
  const active = tpl.versions[0];
  if (!active) return null;

  // Lazy import (circular avoidance + Pass 79 helper paylaşımı)
  const { extractTemplateVariables } = await import("@/lib/prompt-template");
  return {
    templateId: tpl.id,
    templateName: tpl.name,
    versionId: active.id,
    version: active.version,
    promptTemplateText: active.userPromptTemplate,
    templateVariables: extractTemplateVariables(active.userPromptTemplate),
  };
}

/** Tüm MJ template'lerini listeler (active version + boş template'ler dahil). */
export async function listMjTemplates(): Promise<MjTemplateSummary[]> {
  const tpls = await db.promptTemplate.findMany({
    where: { taskType: MJ_TASK_TYPE },
    include: {
      versions: {
        where: { status: PromptStatus.ACTIVE },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  const { extractTemplateVariables } = await import("@/lib/prompt-template");
  return tpls.map((tpl) => {
    const active = tpl.versions[0] ?? null;
    return {
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      productTypeKey: tpl.productTypeKey,
      activeVersionId: active?.id ?? null,
      activeVersion: active?.version ?? null,
      promptTemplateText: active?.userPromptTemplate ?? null,
      templateVariables: active
        ? extractTemplateVariables(active.userPromptTemplate)
        : [],
      createdAt: tpl.createdAt,
      updatedAt: tpl.updatedAt,
    };
  });
}

export type CreateMjTemplateInput = {
  name: string;
  description?: string;
  productTypeKey?: string;
  /** Mustache `{{var}}` template metni. */
  promptTemplateText: string;
};

/**
 * Yeni MJ template + ilk version (DRAFT → ACTIVE atomic).
 *
 * Initial version=1, status=ACTIVE (operatör hemen kullanmaya başlasın).
 * Sonraki update'ler `updateMjTemplate` ile yeni version açar
 * (eski version ARCHIVED, yeni version ACTIVE).
 */
export async function createMjTemplate(
  input: CreateMjTemplateInput,
): Promise<ResolvedMjTemplate> {
  // Mustache validation: template'i parse et, variable'ları çıkar
  const { extractTemplateVariables } = await import("@/lib/prompt-template");
  const variables = extractTemplateVariables(input.promptTemplateText);

  const result = await db.$transaction(async (tx) => {
    const tpl = await tx.promptTemplate.create({
      data: {
        name: input.name,
        taskType: MJ_TASK_TYPE,
        productTypeKey: input.productTypeKey ?? null,
        providerKind: ProviderKind.AI,
        description: input.description ?? null,
      },
    });
    const version = await tx.promptVersion.create({
      data: {
        templateId: tpl.id,
        version: 1,
        systemPrompt: "", // MJ generate'te systemPrompt kullanılmıyor; bu alan AI provider için
        userPromptTemplate: input.promptTemplateText,
        status: PromptStatus.ACTIVE,
        changelog: "Initial version",
      },
    });
    return { tpl, version };
  });

  return {
    templateId: result.tpl.id,
    templateName: result.tpl.name,
    versionId: result.version.id,
    version: result.version.version,
    promptTemplateText: result.version.userPromptTemplate,
    templateVariables: variables,
  };
}

export type UpdateMjTemplateInput = {
  templateId: string;
  promptTemplateText: string;
  description?: string;
  changelog?: string;
};

/**
 * Template metnini günceller — eski ACTIVE version ARCHIVED, yeni
 * version ACTIVE. Audit lineage: PromptVersion sıralı (version 1, 2, 3, ...).
 *
 * Eski versionlar referans olarak kalır (eski jobların lineage izi);
 * yeni jobs en son ACTIVE version'ı kullanır.
 */
export async function updateMjTemplate(
  input: UpdateMjTemplateInput,
): Promise<ResolvedMjTemplate> {
  const { extractTemplateVariables } = await import("@/lib/prompt-template");
  const variables = extractTemplateVariables(input.promptTemplateText);

  const result = await db.$transaction(async (tx) => {
    const tpl = await tx.promptTemplate.findFirst({
      where: { id: input.templateId, taskType: MJ_TASK_TYPE },
    });
    if (!tpl) throw new Error(`MJ template bulunamadı: ${input.templateId}`);

    // Mevcut ACTIVE version'ı ARCHIVED yap
    await tx.promptVersion.updateMany({
      where: { templateId: tpl.id, status: PromptStatus.ACTIVE },
      data: { status: PromptStatus.ARCHIVED },
    });

    // Yeni version numarası
    const last = await tx.promptVersion.findFirst({
      where: { templateId: tpl.id },
      orderBy: { version: "desc" },
    });
    const nextVersion = (last?.version ?? 0) + 1;

    const version = await tx.promptVersion.create({
      data: {
        templateId: tpl.id,
        version: nextVersion,
        systemPrompt: "",
        userPromptTemplate: input.promptTemplateText,
        status: PromptStatus.ACTIVE,
        changelog: input.changelog ?? `Updated to version ${nextVersion}`,
      },
    });

    if (input.description !== undefined) {
      await tx.promptTemplate.update({
        where: { id: tpl.id },
        data: { description: input.description },
      });
    }

    return { tpl, version };
  });

  return {
    templateId: result.tpl.id,
    templateName: result.tpl.name,
    versionId: result.version.id,
    version: result.version.version,
    promptTemplateText: result.version.userPromptTemplate,
    templateVariables: variables,
  };
}

/**
 * Template'i sil (cascade ile tüm versiyonlar).
 * UYARI: Geçmişte kullanılmış GeneratedDesign'lar promptVersionId
 * üzerinden bu template'e bağlı olabilir. Mevcut schema'da PromptVersion
 * → GeneratedDesign relation'ı SET NULL davranışında değil; cascade'i
 * test etmeden delete RİSKLİ. Pass 80 V1: SADECE "kullanılmamış"
 * template'leri silmeye izin ver. Daha güvenli: archive (taskType
 * yerine status="ARCHIVED" template-level) — ama mevcut model
 * status'u version-level. Pass 80 V1'de delete YOK; soft-delete
 * Pass 81+ scope.
 *
 * @deprecated Pass 80 V1: yok. Caller sıfır olarak signal'e bağlar.
 */
export const deleteMjTemplate = async (
  _templateId: string,
): Promise<never> => {
  throw new Error(
    "Pass 80 V1: template delete desteklenmiyor (lineage koruma; Pass 81+ soft-delete)",
  );
};
