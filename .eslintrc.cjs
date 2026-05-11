module.exports = {
  extends: ["next/core-web-vitals"],
  ignorePatterns: [
    ".next/",
    "node_modules/",
    "coverage/",
    "playwright-report/",
    "test-results/",
    "prisma/migrations/",
  ],
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
        message: "Raw hex renk yasak. design-tokens.ts üzerinden CSS variable kullan.",
      },
      {
        // Disallow arbitrary hex colors only. Arbitrary px values are allowed for Kivasy DS
        // small-type and half-pixel typography (CLAUDE.md Madde L). Only hex colors banned here.
        selector: "Literal[value=/\\[#[0-9a-fA-F]{3,8}\\]/]",
        message: "Tailwind arbitrary hex renk yasak. design-tokens.ts üzerinden CSS variable kullan.",
      },
      {
        selector: "JSXAttribute[name.name='style'] ObjectExpression",
        message: "Inline style yasak. Tailwind token sınıfı veya CSS variable kullan.",
      },
    ],
  },
};
