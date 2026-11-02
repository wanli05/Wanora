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
    ignores: ["src/**/*.test.tsx", "src/test-utils/**"],
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
