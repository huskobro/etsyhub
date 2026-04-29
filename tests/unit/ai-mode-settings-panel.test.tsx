// Phase 6 Aşama 1.1 — AI Mode Settings Panel UI testi.
//
// Code quality reviewer Önemli #1 kapanışı: Aşama 1'de eklenen
// `reviewProvider` <select> dropdown'u için UI test yok idi. Bu dosya
// 4 sözleşmeyi doğrular:
//
//   1. Panel render olduğunda "KIE (önerilen)" default seçili görünür.
//   2. Helper text "Bugün kullandığınız akış KIE ise bunu seçin." görünür.
//   3. Kullanıcı seçimi "google-gemini"ye değiştirebilir (form state update).
//   4. Submit sonrası PUT body `reviewProvider` alanını taşır.
//
// Mock stratejisi:
//   - Component TanStack `useQuery` ile GET /api/settings/ai-mode çağırıyor
//     ve `useMutation` ile PUT yapıyor. `global.fetch` mock'lanır;
//     QueryClientProvider wrap edilir.
//   - Initial GET response masked yapıda: kieApiKey/geminiApiKey null,
//     reviewProvider "kie" (default).
//   - PUT response echo: body'deki reviewProvider'ı geri verir.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AiModeSettingsPanel } from "@/features/settings/ai-mode/components/ai-mode-settings-panel";

const fetchMock = vi.fn();

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("AiModeSettingsPanel — Phase 6 Aşama 1 review provider seçimi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;

    // Default mock: GET masked + PUT echo. Diğer URL'ler için throw —
    // beklenmeyen network leak'i hızlıca yakalanır.
    fetchMock.mockImplementation(
      async (url: string, init?: RequestInit | undefined) => {
        if (typeof url === "string" && url.includes("/api/settings/ai-mode")) {
          const method = init?.method ?? "GET";
          if (method === "GET") {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                settings: {
                  kieApiKey: null,
                  geminiApiKey: null,
                  reviewProvider: "kie",
                },
              }),
            };
          }
          // PUT — echo reviewProvider from body
          const body = init?.body
            ? (JSON.parse(init.body as string) as {
                reviewProvider: "kie" | "google-gemini";
              })
            : { reviewProvider: "kie" as const };
          return {
            ok: true,
            status: 200,
            json: async () => ({
              settings: {
                kieApiKey: null,
                geminiApiKey: null,
                reviewProvider: body.reviewProvider,
              },
            }),
          };
        }
        throw new Error(`Unmocked fetch: ${url}`);
      },
    );
  });

  it("render: 'KIE (önerilen)' default seçili görünür", async () => {
    renderWithQuery(<AiModeSettingsPanel />);

    // Component "Yükleniyor…" → success transition; select async ortaya çıkar
    const select = (await screen.findByLabelText(
      "Review sağlayıcısı",
    )) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("kie");

    // Option label kullanıcıya görünür
    const kieOption = screen.getByRole("option", {
      name: /KIE \(önerilen\)/i,
    }) as HTMLOptionElement;
    expect(kieOption).toBeInTheDocument();
    expect(kieOption.selected).toBe(true);
  });

  it("helper text görünür: 'Bugün kullandığınız akış KIE ise bunu seçin.'", async () => {
    renderWithQuery(<AiModeSettingsPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("Bugün kullandığınız akış KIE ise bunu seçin."),
      ).toBeInTheDocument();
    });
  });

  it("seçim 'google-gemini' yapılabiliyor (form state update)", async () => {
    renderWithQuery(<AiModeSettingsPanel />);

    const select = (await screen.findByLabelText(
      "Review sağlayıcısı",
    )) as HTMLSelectElement;

    // Her iki option mevcut
    expect(
      screen.getByRole("option", { name: /KIE \(önerilen\)/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /Google Gemini \(ileri seviye\)/i }),
    ).toBeInTheDocument();

    // Seçimi değiştir
    fireEvent.change(select, { target: { value: "google-gemini" } });

    expect(select.value).toBe("google-gemini");
  });

  it("submit sonrası PUT body 'reviewProvider' alanını taşır", async () => {
    renderWithQuery(<AiModeSettingsPanel />);

    const select = (await screen.findByLabelText(
      "Review sağlayıcısı",
    )) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "google-gemini" } });

    // "Kaydet" submit butonu
    const submitButton = screen.getByRole("button", { name: /kaydet/i });
    fireEvent.click(submitButton);

    // PUT request mutation tarafından gönderildi
    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        (call) => (call[1] as RequestInit | undefined)?.method === "PUT",
      );
      expect(putCall).toBeDefined();
    });

    const putCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "PUT",
    )!;
    const init = putCall[1] as RequestInit;
    const body = JSON.parse(init.body as string) as {
      reviewProvider: "kie" | "google-gemini";
    };
    expect(body).toHaveProperty("reviewProvider");
    expect(body.reviewProvider).toBe("google-gemini");
  });
});
