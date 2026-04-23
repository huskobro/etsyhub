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
        selector: "Literal[value=/\\[(#[0-9a-fA-F]{3,8}|[0-9]+px)\\]/]",
        message: "Tailwind arbitrary value (hex veya px) yasak. Token scale veya CSS variable kullan.",
      },
      {
        selector: "JSXAttribute[name.name='style'] ObjectExpression",
        message: "Inline style yasak. Tailwind token sınıfı veya CSS variable kullan.",
      },
    ],
  },
};
