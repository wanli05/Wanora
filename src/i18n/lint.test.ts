// @vitest-environment node
import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ cwd: process.cwd() });

async function ruleIds(code: string, file = "src/app/[locale]/sample.tsx") {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(process.cwd(), file),
  });
  return result.messages.map((m) => m.ruleId);
}

describe("hard-coded UI copy lint", () => {
  it.each([
    "export const A = () => <p>ログイン</p>;\n",
    "export function A() {\n  return (\n    <p>\n      Sign in\n    </p>\n  );\n}\n",
  ])("rejects literal JSX text: %s", async (code) => {
    expect(await ruleIds(code)).toEqual(["no-restricted-syntax"]);
  });

  it("rejects literal user-facing attributes", async () => {
    expect(
      await ruleIds(
        'export const A = () => <input aria-label="Email" placeholder="you@example.com" />;\n',
      ),
    ).toEqual(["no-restricted-syntax", "no-restricted-syntax"]);
  });

  it("allows translated text and non-copy props", async () => {
    expect(
      await ruleIds(
        'export const A = ({ t }: { t: (k: string) => string }) => <p className="x" aria-label={t("a")}>{t("b")}</p>;\n',
      ),
    ).toEqual([]);
  });

  it("does not apply to tests", async () => {
    expect(
      await ruleIds(
        "export const A = () => <p>ログイン</p>;\n",
        "src/app/[locale]/sample.test.tsx",
      ),
    ).toEqual([]);
  });
});
