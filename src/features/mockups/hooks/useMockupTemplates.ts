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
const MockupTemplateViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  aspectRatios: z.array(z.string()),
  tags: z.array(z.string()),
  thumbKey: z.string(),
  estimatedRenderMs: z.number(),
  hasActiveBinding: z.boolean(),
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
 * @param params.categoryId V1'de tek değer: `"canvas"` (Spec §9). İleride
 *                          farklı kategoriler eklenirse genişler.
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
