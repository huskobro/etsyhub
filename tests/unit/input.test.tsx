import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/ui/FormField";

describe("Input primitive", () => {
  it("default — wrapper h-control-md + border-border; input transparent", () => {
    render(<Input placeholder="Ara" />);
    const input = screen.getByPlaceholderText("Ara");
    const wrapper = input.parentElement!;
    expect(wrapper.className).toMatch(/h-control-md/);
    expect(wrapper.className).toMatch(/border-border\b/);
    expect(wrapper.className).toMatch(/focus-within:border-accent/);
    expect(input.className).toMatch(/bg-transparent/);
    expect(input.className).toMatch(/outline-none/);
  });

  it("prefix slot render eder, text-subtle rengi taşır", () => {
    render(<Input prefix={<span data-testid="pfx">@</span>} placeholder="x" />);
    const pfx = screen.getByTestId("pfx");
    expect(pfx.parentElement!.className).toMatch(/text-text-subtle/);
  });

  it("suffix slot render eder", () => {
    render(<Input suffix={<span data-testid="sfx">USD</span>} placeholder="x" />);
    expect(screen.getByTestId("sfx")).toBeInTheDocument();
  });

  it("state=error → wrapper border-danger + aria-invalid=true", () => {
    render(<Input state="error" placeholder="x" />);
    const input = screen.getByPlaceholderText("x");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.parentElement!.className).toMatch(/border-danger/);
  });

  it("aria-invalid prop'u verildiyse state otomatik error", () => {
    render(<Input aria-invalid placeholder="x" />);
    expect(screen.getByPlaceholderText("x").parentElement!.className).toMatch(
      /border-danger/,
    );
  });

  it("disabled → wrapper surface-2 + cursor-not-allowed, input disabled", () => {
    render(<Input disabled placeholder="x" />);
    const input = screen.getByPlaceholderText("x");
    expect(input).toBeDisabled();
    expect(input.parentElement!.className).toMatch(/bg-surface-2/);
    expect(input.parentElement!.className).toMatch(/cursor-not-allowed/);
  });

  it("ref forward edilir (HTMLInputElement)", () => {
    let got: HTMLInputElement | null = null;
    render(
      <Input
        placeholder="x"
        ref={(el) => {
          got = el;
        }}
      />,
    );
    expect(got).toBeInstanceOf(HTMLInputElement);
  });

  it("id verilmezse auto id input'a uygulanır", () => {
    render(<Input placeholder="x" />);
    expect(screen.getByPlaceholderText("x").id.length).toBeGreaterThan(0);
  });
});

describe("Textarea primitive", () => {
  it("min-h-textarea + resize-y + focus:border-accent", () => {
    render(<Textarea placeholder="desc" />);
    const ta = screen.getByPlaceholderText("desc");
    expect(ta.className).toMatch(/min-h-textarea/);
    expect(ta.className).toMatch(/resize-y/);
    expect(ta.className).toMatch(/focus:border-accent/);
  });

  it("state=error → border-danger + aria-invalid", () => {
    render(<Textarea state="error" placeholder="x" />);
    const ta = screen.getByPlaceholderText("x");
    expect(ta.className).toMatch(/border-danger/);
    expect(ta).toHaveAttribute("aria-invalid", "true");
  });

  it("disabled stilleri", () => {
    render(<Textarea disabled placeholder="x" />);
    const ta = screen.getByPlaceholderText("x");
    expect(ta).toBeDisabled();
    expect(ta.className).toMatch(/disabled:bg-surface-2/);
  });
});

describe("FormField composition", () => {
  it("label htmlFor child id ile eşleşir (auto)", () => {
    render(
      <FormField label="Başlık">
        <Input placeholder="x" />
      </FormField>,
    );
    const label = screen.getByText("Başlık") as HTMLLabelElement;
    const input = screen.getByPlaceholderText("x");
    expect(label.htmlFor).toBe(input.id);
    expect(input.id.length).toBeGreaterThan(0);
  });

  it("description varken aria-describedby bağlanır", () => {
    render(
      <FormField label="Başlık" description="Açıklama metni">
        <Input placeholder="x" />
      </FormField>,
    );
    const input = screen.getByPlaceholderText("x");
    const descId = input.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    const desc = document.getElementById(descId!);
    expect(desc?.textContent).toBe("Açıklama metni");
  });

  it("error → aria-invalid=true, description yerine error gösterilir", () => {
    render(
      <FormField
        label="E-posta"
        description="Kullanılmaz"
        error="Hatalı e-posta"
      >
        <Input placeholder="x" />
      </FormField>,
    );
    const input = screen.getByPlaceholderText("x");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Kullanılmaz")).toBeNull();
    expect(screen.getByText("Hatalı e-posta")).toBeInTheDocument();
  });

  it("required → yıldız işareti (*) danger renginde", () => {
    render(
      <FormField label="Ad" required>
        <Input placeholder="x" />
      </FormField>,
    );
    const star = screen.getByText("*");
    expect(star.className).toMatch(/text-danger/);
  });

  it("Textarea child ile de çalışır", () => {
    render(
      <FormField label="Not" error="Boş">
        <Textarea placeholder="desc" />
      </FormField>,
    );
    const ta = screen.getByPlaceholderText("desc");
    expect(ta).toHaveAttribute("aria-invalid", "true");
  });
});
