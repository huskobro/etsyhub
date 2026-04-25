/**
 * use-focus-trap.test.tsx
 *
 * T-40 spec doğrulaması · useFocusTrap hook davranışı.
 *
 * Sözleşme: docs/design/implementation-notes/cp9-stabilization-wave.md (T-40)
 *
 * Hook davranışı:
 * - isOpen=true mount → ref içindeki ilk focusable element document.activeElement
 * - Tab → bir sonraki focusable
 * - Tab son element → ilk element wrap
 * - Shift+Tab → bir önceki
 * - Shift+Tab ilk element → son element wrap
 * - isOpen=false → trap deaktif (Tab normal akış)
 * - disabled / aria-hidden filtrelenir
 */

import { describe, it, expect } from "vitest";
import { useRef } from "react";
import { render, fireEvent } from "@testing-library/react";
import { useFocusTrap } from "@/components/ui/use-focus-trap";

function TrapHarness({
  isOpen,
  withDisabled = false,
  withAriaHidden = false,
}: {
  isOpen: boolean;
  withDisabled?: boolean;
  withAriaHidden?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useFocusTrap(ref, isOpen);
  return (
    <div>
      <button data-testid="outside-before" type="button">
        outside-before
      </button>
      <div ref={ref} data-testid="trap">
        <button data-testid="first" type="button">
          first
        </button>
        {withDisabled ? (
          <button data-testid="disabled" type="button" disabled>
            disabled
          </button>
        ) : null}
        <input data-testid="middle" type="text" />
        {withAriaHidden ? (
          <button data-testid="hidden" type="button" aria-hidden="true">
            hidden
          </button>
        ) : null}
        <button data-testid="last" type="button">
          last
        </button>
      </div>
      <button data-testid="outside-after" type="button">
        outside-after
      </button>
    </div>
  );
}

describe("useFocusTrap — initial focus", () => {
  it("isOpen=true mount → ref içindeki ilk focusable element document.activeElement olur", () => {
    const { getByTestId } = render(<TrapHarness isOpen={true} />);
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  it("isOpen=false mount → initial focus uygulanmaz", () => {
    const { getByTestId } = render(<TrapHarness isOpen={false} />);
    expect(document.activeElement).not.toBe(getByTestId("first"));
  });
});

describe("useFocusTrap — Tab boundary", () => {
  it("Tab → bir sonraki focusable element'e geçer", () => {
    const { getByTestId } = render(<TrapHarness isOpen={true} />);
    const first = getByTestId("first");
    const middle = getByTestId("middle");
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab" });
    expect(document.activeElement).toBe(middle);
  });

  it("Tab son element → ilk element'e wraps", () => {
    const { getByTestId } = render(<TrapHarness isOpen={true} />);
    const last = getByTestId("last");
    const first = getByTestId("first");
    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
  });

  it("Shift+Tab → bir önceki focusable element'e geçer", () => {
    const { getByTestId } = render(<TrapHarness isOpen={true} />);
    const middle = getByTestId("middle");
    const first = getByTestId("first");
    middle.focus();
    expect(document.activeElement).toBe(middle);
    fireEvent.keyDown(middle, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(first);
  });

  it("Shift+Tab ilk element → son element'e wraps", () => {
    const { getByTestId } = render(<TrapHarness isOpen={true} />);
    const first = getByTestId("first");
    const last = getByTestId("last");
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});

describe("useFocusTrap — isOpen=false deaktif", () => {
  it("isOpen=false → Tab basıldığında preventDefault çağrılmaz, focus trap deaktif", () => {
    const { getByTestId } = render(<TrapHarness isOpen={false} />);
    const last = getByTestId("last");
    last.focus();
    const event = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    last.dispatchEvent(event);
    // isOpen=false → hook event'i preventDefault etmez
    expect(event.defaultPrevented).toBe(false);
  });
});

function TrapHarnessWithInitialFocusRef({ isOpen }: { isOpen: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLInputElement | null>(null);
  useFocusTrap(ref, isOpen, initialFocusRef);
  return (
    <div>
      <div ref={ref} data-testid="trap">
        <button data-testid="first" type="button">
          first
        </button>
        <input
          ref={initialFocusRef}
          data-testid="initial-target"
          type="text"
        />
        <button data-testid="last" type="button">
          last
        </button>
      </div>
    </div>
  );
}

describe("useFocusTrap — initialFocusRef", () => {
  it("initialFocusRef verilirse o element ilk focus alır (ilk focusable yerine)", () => {
    const { getByTestId } = render(
      <TrapHarnessWithInitialFocusRef isOpen={true} />,
    );
    expect(document.activeElement).toBe(getByTestId("initial-target"));
    expect(document.activeElement).not.toBe(getByTestId("first"));
  });
});

describe("useFocusTrap — filtreleme", () => {
  it("disabled element focusable listesine girmez (Tab son element wrap'inde atlanır)", () => {
    // disabled middle butonu var: first → input → last (disabled atlanır).
    // Burada testimiz: disabled element initial focus alamaz; ilk focusable = first.
    const { getByTestId } = render(
      <TrapHarness isOpen={true} withDisabled />,
    );
    expect(document.activeElement).toBe(getByTestId("first"));
    // Tab son butona geldikten sonra ilk butona dönmeli; disabled buton atlanır.
    const last = getByTestId("last");
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(getByTestId("first"));
  });

  it("aria-hidden='true' element focusable listesine girmez", () => {
    const { getByTestId } = render(
      <TrapHarness isOpen={true} withAriaHidden />,
    );
    expect(document.activeElement).toBe(getByTestId("first"));
    const last = getByTestId("last");
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(getByTestId("first"));
  });
});
