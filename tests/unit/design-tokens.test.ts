import { describe, expect, it } from "vitest";
import { defaultTokens, tokensToCssVars } from "@/features/theme/design-tokens";

describe("tokensToCssVars", () => {
  it("default token setinden CSS variable objesi üretir", () => {
    const vars = tokensToCssVars(defaultTokens);
    expect(vars["--color-bg"]).toBe("0 0% 100%");
    expect(vars["--color-surface-muted"]).toBe("0 0% 96%");
    expect(vars["--radius-md"]).toBe("8px");
    expect(vars["--layout-sidebar-width"]).toBe("240px");
  });
});
