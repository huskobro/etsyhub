import { describe, expect, it } from "vitest";
import { defaultTokens, tokensToCssVars } from "@/features/theme/design-tokens";

describe("tokensToCssVars", () => {
  it("default token setinden CSS variable objesi üretir", () => {
    const vars = tokensToCssVars(defaultTokens);
    expect(vars["--color-bg"]).toBe("45 36% 95%");
    expect(vars["--color-surface-muted"]).toBe("45 27% 92%");
    expect(vars["--color-accent"]).toBe("17 81% 53%");
    expect(vars["--radius-md"]).toBe("8px");
    expect(vars["--layout-sidebar-width"]).toBe("248px");
  });
});
