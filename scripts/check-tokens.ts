import { execSync } from "node:child_process";

type Pattern = { label: string; regex: string };

const patterns: Pattern[] = [
  { label: "Raw hex renk", regex: "#[0-9a-fA-F]{3,8}\\b" },
  {
    label: "Tailwind arbitrary value",
    regex: "\\b(bg|text|border|w|h|p|m|gap|rounded|shadow|aspect|min-h|scale)-\\[[^\\]]+\\]",
  },
  { label: "Inline style attribute", regex: "style=\\{\\{" },
  { label: "hsl/rgb sabit", regex: "\\b(hsl|rgb)a?\\(" },
];

const whitelist = [
  "src/features/theme/design-tokens.ts",
  "src/app/globals.css",
  "src/features/tags/color-map.ts",
  "tailwind.config.ts",
];

let hadError = false;

for (const { label, regex } of patterns) {
  try {
    const out = execSync(
      `rg -n --no-messages "${regex}" src tests || true`,
      { encoding: "utf8", shell: "/bin/bash" },
    );
    const hits = out
      .split("\n")
      .filter((line) => line && !whitelist.some((w) => line.includes(w)));
    if (hits.length > 0) {
      console.error(`\n❌ ${label}:`);
      for (const h of hits) console.error(`  ${h}`);
      hadError = true;
    }
  } catch (err) {
    console.error(`rg hata: ${(err as Error).message}`);
    hadError = true;
  }
}

if (!hadError) {
  console.log("✓ Token ihlali yok (src + tests).");
}

process.exit(hadError ? 1 : 0);
