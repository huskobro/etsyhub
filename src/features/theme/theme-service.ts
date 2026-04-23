import { ThemeStatus } from "@prisma/client";
import { defaultTokens, type DesignTokens } from "@/features/theme/design-tokens";
import { db } from "@/server/db";

type PartialTokens = {
  colors?: Partial<DesignTokens["colors"]>;
  radius?: Partial<DesignTokens["radius"]>;
  shadow?: Partial<DesignTokens["shadow"]>;
  spacing?: Partial<DesignTokens["spacing"]>;
  font?: Partial<DesignTokens["font"]>;
  layout?: Partial<DesignTokens["layout"]>;
};

export async function resolveActiveTokens(): Promise<DesignTokens> {
  const active = await db.theme
    .findFirst({ where: { status: ThemeStatus.ACTIVE } })
    .catch(() => null);
  const dbTokens = (active?.tokens ?? {}) as PartialTokens;
  return {
    colors: { ...defaultTokens.colors, ...(dbTokens.colors ?? {}) },
    radius: { ...defaultTokens.radius, ...(dbTokens.radius ?? {}) },
    shadow: { ...defaultTokens.shadow, ...(dbTokens.shadow ?? {}) },
    spacing: { ...defaultTokens.spacing, ...(dbTokens.spacing ?? {}) },
    font: { ...defaultTokens.font, ...(dbTokens.font ?? {}) },
    layout: { ...defaultTokens.layout, ...(dbTokens.layout ?? {}) },
  };
}
