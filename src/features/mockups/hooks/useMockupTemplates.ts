"use client";

// Phase 8 Task 22 — useMockupTemplates real implementation.
//
// Task 14 stub'ını gerçek API çağrısına çevirir. `MockupTemplateView` shape'i SABİT
// kalacak (consumer'lar — useMockupPackState Task 14, S3ApplyView Task 23+ —
// bu shape'e bağlı; kırılmaz).
//
// Endpoint: Task 22 GET /api/mockup/templates?categoryId=...
// Response: { templates: MockupTemplateView[] }

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

// View shape — Task 14'ten taşınan sabit sözleşme.
// Phase 65 — `ownership` field eklendi (admin catalog vs my templates ayrımı).
const MockupTemplateViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  aspectRatios: z.array(z.string()),
  tags: z.array(z.string()),
  thumbKey: z.string(),
  estimatedRenderMs: z.number(),
  hasActiveBinding: z.boolean(),
  /** Phase 65 — "global" (admin catalog) | "own" (operator's library). */
  ownership: z.enum(["global", "own"]).default("global"),
  /** Phase 76 — Multi-slot template slot count.
   *  - 1: legacy single-slot (Phase 8 baseline)
   *  - >1: multi-slot template (sticker sheet 9-up, bundle preview, etc.)
   *  Apply view bu sayıyı multi-design assignment panel'i göstermek için
   *  kullanır. Backend Phase 74-75 multi-slot render execution + slot-
   *  mapped designUrls hazır; operator slot başına farklı kept asset
   *  atayabilir. */
  slotCount: z.number().int().min(1).default(1),
});

const ResponseSchema = z.object({
  templates: z.array(MockupTemplateViewSchema),
});

export type MockupTemplateView = z.infer<typeof MockupTemplateViewSchema>;

export const mockupTemplatesQueryKey = (categoryId: string) =>
  ["mockup-templates", categoryId] as const;

/**
 * Aktif mockup template listesi.
 *
 * @param params.categoryId Spec §9 + V2 multi-category (HEAD `5eabffc`+):
 *                          MOCKUP_CATEGORY_VALUES enum'undan biri (canvas,
 *                          wall_art, printable, clipart, sticker, tshirt,
 *                          hoodie, dtf). V1 sadece "canvas" template
 *                          seed'liyor (admin asset prep); diğer kategorilerde
 *                          empty array döner. Backend endpoint zaten herhangi
 *                          string kabul ediyor (DB string kolon).
 */
export function useMockupTemplates(params: { categoryId: string }) {
  return useQuery<MockupTemplateView[]>({
    queryKey: mockupTemplatesQueryKey(params.categoryId),
    queryFn: async () => {
      const url = `/api/mockup/templates?categoryId=${encodeURIComponent(params.categoryId)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          `Template listesi alınamadı (HTTP ${res.status})`,
        );
      }
      const json = await res.json();
      const parsed = ResponseSchema.parse(json);
      return parsed.templates;
    },
    enabled: !!params.categoryId,
  });
}
