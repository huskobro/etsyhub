"use client";

// Phase 8 Task 14 — `useMockupTemplates` STUB.
//
// PHASE 8 TASK 14 STUB — Task 22'de gerçek implementation gelir.
//
// Sözleşme (Task 22): GET /api/mockup/templates?categoryId=... endpoint'inden
// aktif template'leri çeker (yalın View shape: id, name, aspectRatios, tags,
// thumbKey, estimatedRenderMs, hasActiveBinding). `useMockupPackState` (Task 14)
// `selectQuickPackDefault` (Task 13) input'u için tüketir.
//
// Şu anki STUB davranışı: `enabled: false` ile fetch yapmıyor; `data` undefined
// kalıyor. Test ortamında `vi.mock("@/features/mockups/hooks/useMockupTemplates")`
// ile override edilerek stable shape döndürülmesi yeterli (Task 14 senaryoları).
//
// Task 22'de bu dosya gerçek `queryFn` + `enabled: !!params.categoryId` ile
// değiştirilecek; `MockupTemplateView` shape'i sabit kalacak (consumer'lar
// kırılmaz).

import { useQuery } from "@tanstack/react-query";

/**
 * Template view shape (Spec §6.1 + §9 V1 envanter).
 *
 * Backend `/api/mockup/templates` route'u (Task 22) bu yalın View'ı döndürür;
 * raw `MockupTemplate` row'u değil. `tags` ve `aspectRatios` string array
 * (JSON column), `hasActiveBinding` snapshot resolver çıktısı.
 */
export type MockupTemplateView = {
  id: string;
  name: string;
  aspectRatios: string[];
  tags: string[];
  thumbKey: string;
  estimatedRenderMs: number;
  hasActiveBinding: boolean;
};

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
      // PHASE 8 TASK 14 STUB — Task 22'de gerçek fetch + zod parse.
      return [];
    },
    // Task 22'de `enabled: !!params.categoryId` olacak; STUB sürede fetch
    // tetiklenmesin diye false.
    enabled: false,
  });
}
