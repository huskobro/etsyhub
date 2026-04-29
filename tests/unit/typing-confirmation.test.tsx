// Phase 6 Dalga B (Task 17) — TypingConfirmation primitive testleri.
//
// Sözleşme:
//   - phrase eşleşmedi ⇒ confirm disabled
//   - phrase eşleşti ⇒ confirm enabled
//   - case-sensitive (yanlış case ⇒ disabled kalır)
//   - confirm click ⇒ onConfirm tetiklenir
//   - isLoading ⇒ confirm disabled (eşleşse bile)

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TypingConfirmation } from "@/components/ui/TypingConfirmation";

describe("TypingConfirmation", () => {
  it("phrase eşleşmedi: confirm disabled", () => {
    render(
      <TypingConfirmation
        phrase="SİL"
        message="X asseti silinecek"
        onConfirm={() => {}}
      />,
    );
    const btn = screen.getByTestId("typing-confirmation-confirm");
    expect(btn).toBeDisabled();
  });

  it("phrase tam eşleşti: confirm enabled + click ⇒ onConfirm", () => {
    const onConfirm = vi.fn();
    render(
      <TypingConfirmation
        phrase="SİL"
        message="X asseti silinecek"
        onConfirm={onConfirm}
      />,
    );
    const input = screen.getByTestId("typing-confirmation-input");
    fireEvent.change(input, { target: { value: "SİL" } });
    const btn = screen.getByTestId("typing-confirmation-confirm");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("case-sensitive: yanlış case ⇒ disabled", () => {
    render(
      <TypingConfirmation
        phrase="SİL"
        message="X asseti silinecek"
        onConfirm={() => {}}
      />,
    );
    const input = screen.getByTestId("typing-confirmation-input");
    fireEvent.change(input, { target: { value: "sil" } });
    expect(screen.getByTestId("typing-confirmation-confirm")).toBeDisabled();
  });

  it("isLoading ⇒ disabled (eşleşse bile)", () => {
    render(
      <TypingConfirmation
        phrase="SİL"
        message="X asseti silinecek"
        isLoading
        onConfirm={() => {}}
      />,
    );
    const input = screen.getByTestId("typing-confirmation-input");
    fireEvent.change(input, { target: { value: "SİL" } });
    expect(screen.getByTestId("typing-confirmation-confirm")).toBeDisabled();
  });

  it("phrase görsel olarak gösteriliyor (a11y görünürlük)", () => {
    render(
      <TypingConfirmation
        phrase="SİL"
        message="X asseti silinecek"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByTestId("typing-confirmation-phrase")).toHaveTextContent(
      "SİL",
    );
  });
});
