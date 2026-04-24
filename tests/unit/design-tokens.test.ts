import { describe, expect, it } from "vitest";
import { defaultTokens, tokensToCssVars } from "@/features/theme/design-tokens";

describe("tokensToCssVars", () => {
  it("default token setinden CSS variable objesi üretir", () => {
    const vars = tokensToCssVars(defaultTokens);
    expect(vars["--color-bg"]).toBe("60 23% 97%");
    expect(vars["--color-surface-muted"]).toBe("51 23% 94%");
    expect(vars["--color-accent"]).toBe("17 81% 53%");
    expect(vars["--radius-md"]).toBe("6px");
    expect(vars["--layout-sidebar-width"]).toBe("232px");
  });
});
