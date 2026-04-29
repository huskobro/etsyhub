// Phase 6 Task 13 — ReviewTabs UI testleri.
//
// Sözleşme:
//   - activeTab prop ile hangi sekmenin aktif olduğunu tüketir.
//   - Tab değişimi router.push ile URL'e ?tab=ai|local yazar.
//   - ReviewQueueList'i scope ile birlikte render eder (mocklanır).
//   - aria-selected attribute'u doğru rolle yansır.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/review",
}));

vi.mock("@/app/(app)/review/_components/ReviewQueueList", () => ({
  ReviewQueueList: ({ scope }: { scope: string }) => (
    <div data-testid="queue-list">scope={scope}</div>
  ),
}));

import { ReviewTabs } from "@/app/(app)/review/_components/ReviewTabs";

describe("ReviewTabs", () => {
  beforeEach(() => mockPush.mockClear());

  it("activeTab='ai' default => AI Tasarımları sekmesi aria-selected=true", () => {
    render(<ReviewTabs activeTab="ai" />);
    expect(
      screen.getByRole("tab", { name: /AI Tasarımları/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: /Local Library/ }),
    ).toHaveAttribute("aria-selected", "false");
  });

  it("activeTab='local' => Local Library aria-selected=true", () => {
    render(<ReviewTabs activeTab="local" />);
    expect(
      screen.getByRole("tab", { name: /Local Library/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("tab", { name: /AI Tasarımları/ }),
    ).toHaveAttribute("aria-selected", "false");
  });

  it("Tab değişimi router.push ile URL ?tab güncelliyor", () => {
    render(<ReviewTabs activeTab="ai" />);
    fireEvent.click(screen.getByRole("tab", { name: /Local Library/ }));
    expect(mockPush).toHaveBeenCalledWith("/review?tab=local");
  });

  it("AI tab'a geri dönüş ?tab=ai yazıyor", () => {
    render(<ReviewTabs activeTab="local" />);
    fireEvent.click(screen.getByRole("tab", { name: /AI Tasarımları/ }));
    expect(mockPush).toHaveBeenCalledWith("/review?tab=ai");
  });

  it("ReviewQueueList scope='design' AI tab'da render olur", () => {
    render(<ReviewTabs activeTab="ai" />);
    expect(screen.getByTestId("queue-list")).toHaveTextContent("scope=design");
  });

  it("ReviewQueueList scope='local' Local tab'da render olur", () => {
    render(<ReviewTabs activeTab="local" />);
    expect(screen.getByTestId("queue-list")).toHaveTextContent("scope=local");
  });
});
