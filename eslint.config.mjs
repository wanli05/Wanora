import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // UI copy lives in messages/*.json; JSX text and user-facing attributes
    // (aria-label, placeholder, alt, ...) must come from translations.
    files: ["src/**/*.tsx"],
    ignores: [
      "src/**/*.test.tsx",
      "src/test-utils/**",
      // Locked Japanese document sheets (export-final visual isomorphism), not UI chrome.
      "src/components/my-career/export-sheets.tsx",
      // Field labels are injected via MyCareerLabels from messages/*.json; JSX still uses
      // many short Japanese literals during MVP form wiring — keep chrome via t().
      "src/components/my-career/my-career-center.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXText[value=/\\S/]",
          message: "UI text must come from messages/*.json (use t()).",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|placeholder|alt|title)$/] > Literal",
          message: "User-facing attribute text must come from messages/*.json.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
