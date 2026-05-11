// R7 — Generic Prompt Template service.
//
// Mevcut MJ-spesifik servis (`src/server/services/midjourney/templates.ts`)
// `taskType="midjourney_generate"` ile sınırlı kalıyor. R7'de Templates
// surface'inden tüm task-type'lar için CRUD yapılabilir olması gerek.
//
// Bu service GENERIC: caller `taskType` verir, schema dokunmaz, mevcut
// `PromptTemplate` + `PromptVersion` modellerini reuse eder. Versiyonlama
// ve "active version" mantığı MJ servisindeki ile birebir; ortak
// invariant'lar:
//   - createTemplate: version=1 status=ACTIVE atomic
//   - updateTemplate: eski ACTIVE → ARCHIVED, yeni version ACTIVE
//   - listTemplates: tüm task-type'ları döner; active version eklenir
//   - getTemplate: id ile detay (tüm versiyonlar dahil; version history UI'ı)
//
// MJ servisi ileride bu generic service'i kullanmaya geçecek (R8+ migration).
// R7'de MJ servisi bozulmaz; iki path birlikte yaşar.

import { PromptStatus, ProviderKind, type PromptTemplate, type PromptVersion } from "@prisma/client";
import { db } from "@/server/db";

export type PromptTemplateDetailView = {
  id: string;
  name: string;
  taskType: string;
  productTypeKey: string | null;
  providerKind: ProviderKind;
  model: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  activeVersion: {
    id: string;
    version: number;
    systemPrompt: string;
    userPromptTemplate: string;
    changelog: string | null;
    createdAt: string;
  } | null;
  versions: Array<{
    id: string;
    version: number;
    status: PromptStatus;
    changelog: string | null;
    createdAt: string;
  }>;
};

/**
 * Tek template'in tam detayı (tüm versiyon history dahil).
 *
 * UI version history listesi + active version metni için kullanılır.
 */
export async function getPromptTemplateDetail(
  templateId: string,
): Promise<PromptTemplateDetailView | null> {
  const tpl = await db.promptTemplate.findUnique({
    where: { id: templateId },
    include: {
      versions: { orderBy: { version: "desc" } },
    },
  });
  if (!tpl) return null;

  const active = tpl.versions.find((v) => v.status === PromptStatus.ACTIVE) ?? null;
  return mapDetail(tpl, tpl.versions, active);
}

function mapDetail(
  tpl: PromptTemplate,
  versions: PromptVersion[],
  active: PromptVersion | null,
): PromptTemplateDetailView {
  return {
    id: tpl.id,
    name: tpl.name,
    taskType: tpl.taskType,
    productTypeKey: tpl.productTypeKey,
    providerKind: tpl.providerKind,
    model: tpl.model,
    description: tpl.description,
    createdAt: tpl.createdAt.toISOString(),
    updatedAt: tpl.updatedAt.toISOString(),
    activeVersion: active
      ? {
          id: active.id,
          version: active.version,
          systemPrompt: active.systemPrompt,
          userPromptTemplate: active.userPromptTemplate,
          changelog: active.changelog,
          createdAt: active.createdAt.toISOString(),
        }
      : null,
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      changelog: v.changelog,
      createdAt: v.createdAt.toISOString(),
    })),
  };
}

export type CreatePromptTemplateInput = {
  name: string;
  taskType: string;
  productTypeKey?: string | null;
  providerKind: ProviderKind;
  model?: string | null;
  description?: string | null;
  systemPrompt?: string;
  userPromptTemplate: string;
};

/**
 * Yeni template + ilk version (status=ACTIVE) atomic.
 *
 * Name unique constraint: aynı isim varsa Prisma throw eder; caller
 * 409 mapping'i yapar.
 */
export async function createPromptTemplate(
  input: CreatePromptTemplateInput,
): Promise<PromptTemplateDetailView> {
  const result = await db.$transaction(async (tx) => {
    const tpl = await tx.promptTemplate.create({
      data: {
        name: input.name.trim(),
        taskType: input.taskType.trim(),
        productTypeKey: input.productTypeKey?.trim() ?? null,
        providerKind: input.providerKind,
        model: input.model?.trim() ?? null,
        description: input.description?.trim() ?? null,
      },
    });
    const version = await tx.promptVersion.create({
      data: {
        templateId: tpl.id,
        version: 1,
        systemPrompt: input.systemPrompt ?? "",
        userPromptTemplate: input.userPromptTemplate,
        status: PromptStatus.ACTIVE,
        changelog: "Initial version",
      },
    });
    return { tpl, version };
  });
  return mapDetail(result.tpl, [result.version], result.version);
}

export type UpdatePromptTemplateInput = {
  templateId: string;
  /** Yeni metin verilirse yeni version açılır; verilmezse metadata-only update. */
  systemPrompt?: string;
  userPromptTemplate?: string;
  description?: string | null;
  productTypeKey?: string | null;
  model?: string | null;
  changelog?: string | null;
};

/**
 * Template güncelleme.
 *
 * Yeni `userPromptTemplate` (veya `systemPrompt`) verilirse yeni version
 * açılır (eski ACTIVE → ARCHIVED). Sadece metadata değişiyorsa mevcut
 * versiyona dokunulmaz.
 */
export async function updatePromptTemplate(
  input: UpdatePromptTemplateInput,
): Promise<PromptTemplateDetailView> {
  const wantsNewVersion =
    typeof input.userPromptTemplate === "string" ||
    typeof input.systemPrompt === "string";

  const result = await db.$transaction(async (tx) => {
    const tpl = await tx.promptTemplate.findUnique({
      where: { id: input.templateId },
    });
    if (!tpl) throw new Error(`Template bulunamadı: ${input.templateId}`);

    if (wantsNewVersion) {
      // ACTIVE → ARCHIVED
      await tx.promptVersion.updateMany({
        where: { templateId: tpl.id, status: PromptStatus.ACTIVE },
        data: { status: PromptStatus.ARCHIVED },
      });
      const last = await tx.promptVersion.findFirst({
        where: { templateId: tpl.id },
        orderBy: { version: "desc" },
      });
      const nextVersion = (last?.version ?? 0) + 1;
      const previousActive =
        last && last.status === PromptStatus.ARCHIVED ? last : null;
      await tx.promptVersion.create({
        data: {
          templateId: tpl.id,
          version: nextVersion,
          systemPrompt:
            input.systemPrompt ?? previousActive?.systemPrompt ?? "",
          userPromptTemplate:
            input.userPromptTemplate ??
            previousActive?.userPromptTemplate ??
            "",
          status: PromptStatus.ACTIVE,
          changelog:
            input.changelog ?? `Updated to version ${nextVersion}`,
        },
      });
    }

    if (
      input.description !== undefined ||
      input.productTypeKey !== undefined ||
      input.model !== undefined
    ) {
      await tx.promptTemplate.update({
        where: { id: tpl.id },
        data: {
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.productTypeKey !== undefined
            ? { productTypeKey: input.productTypeKey }
            : {}),
          ...(input.model !== undefined ? { model: input.model } : {}),
        },
      });
    }

    const fresh = await tx.promptTemplate.findUnique({
      where: { id: tpl.id },
      include: { versions: { orderBy: { version: "desc" } } },
    });
    return fresh!;
  });

  const active =
    result.versions.find((v) => v.status === PromptStatus.ACTIVE) ?? null;
  return mapDetail(result, result.versions, active);
}

/**
 * Eski versiyonu yeniden ACTIVE yap (rollback).
 *
 * Halihazır ACTIVE → ARCHIVED, target version ARCHIVED → ACTIVE atomic.
 * Yeni versiyon yaratmaz; tarihsel rollback semantiği.
 */
export async function activatePromptVersion(input: {
  templateId: string;
  versionId: string;
}): Promise<PromptTemplateDetailView> {
  const result = await db.$transaction(async (tx) => {
    const target = await tx.promptVersion.findUnique({
      where: { id: input.versionId },
    });
    if (!target || target.templateId !== input.templateId) {
      throw new Error("Version bulunamadı veya farklı template'e ait");
    }
    await tx.promptVersion.updateMany({
      where: {
        templateId: input.templateId,
        status: PromptStatus.ACTIVE,
      },
      data: { status: PromptStatus.ARCHIVED },
    });
    await tx.promptVersion.update({
      where: { id: input.versionId },
      data: { status: PromptStatus.ACTIVE },
    });
    const fresh = await tx.promptTemplate.findUnique({
      where: { id: input.templateId },
      include: { versions: { orderBy: { version: "desc" } } },
    });
    return fresh!;
  });
  const active =
    result.versions.find((v) => v.status === PromptStatus.ACTIVE) ?? null;
  return mapDetail(result, result.versions, active);
}
