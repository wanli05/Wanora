import { describe, expect, it } from "vitest";
import { extractRefinedText } from "@/components/ai-sidebar/extract-refined-text";
import {
  REFINE_BODY_END,
  REFINE_BODY_START,
  REFINE_RESULT_END,
  REFINE_RESULT_START,
  buildRefinePrompt,
} from "@/components/ai-sidebar/refine-prompts";
import {
  createMockAiProvider,
  extractMockRefineTarget,
  mockEstimatedCostUsd,
  MOCK_REFINE_TEXT_PREFIX,
} from "@/lib/ai/providers/mock";

const REFINE_FEATURES = [
  "self_pr_refine",
  "job_summary_refine",
  "career_employer_narrative_refine",
  "career_project_refine",
] as const;

function wrapBody(body: string): string {
  return `${REFINE_BODY_START}\n${body}\n${REFINE_BODY_END}`;
}

function countOccurrences(haystack: string, needle: string): number {
  let n = 0;
  let i = 0;
  while (true) {
    const at = haystack.indexOf(needle, i);
    if (at < 0) break;
    n += 1;
    i = at + needle.length;
  }
  return n;
}

describe("createMockAiProvider (baseline chat)", () => {
  it("returns deterministic Japanese mock text without network", async () => {
    const provider = createMockAiProvider();
    expect(provider.id).toBe("mock");

    const result = await provider.complete({
      feature: "chat",
      messages: [{ role: "user", content: "職務要約を改善して" }],
    });

    expect(result.provider).toBe("mock");
    expect(result.model).toBe("mock-v1");
    expect(result.text).toContain("【モック応答】");
    expect(result.text).toContain("職務要約を改善して");
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
    expect(result.latencyMs).toBeGreaterThan(0);
    expect(extractRefinedText(result.text)).toBeNull();
  });

  it("honors an explicit model override", async () => {
    const result = await createMockAiProvider().complete({
      feature: "chat",
      model: "mock-custom",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.model).toBe("mock-custom");
  });

  it("throws AbortError when signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(
      createMockAiProvider().complete({
        feature: "chat",
        messages: [{ role: "user", content: "x" }],
        signal: ac.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("createMockAiProvider (Step 4C Scheme A re-implementation)", () => {
  const provider = createMockAiProvider();

  describe.each(REFINE_FEATURES)("refine feature %s", (feature) => {
    it("returns exactly one 修正案 pair with deterministic （モック修正案） body", async () => {
      const target = `対象本文-${feature}-確定再現`;
      const result = await provider.complete({
        feature,
        messages: [
          {
            role: "system",
            content: `ルール例 ${REFINE_BODY_START} はプロンプト内にも出る`,
          },
          { role: "user", content: wrapBody(target) },
        ],
      });

      expect(countOccurrences(result.text, REFINE_RESULT_START)).toBe(1);
      expect(countOccurrences(result.text, REFINE_RESULT_END)).toBe(1);

      const extracted = extractRefinedText(result.text);
      expect(extracted).toBe(`${MOCK_REFINE_TEXT_PREFIX}${target}`);
    });

    it("works with buildRefinePrompt-shaped user content", async () => {
      const draft = `buildRefinePrompt-${feature}`;
      const prompt = buildRefinePrompt({ feature, draftText: draft });
      const result = await provider.complete({
        feature,
        messages: [{ role: "user", content: prompt }],
      });
      expect(extractRefinedText(result.text)).toBe(
        `${MOCK_REFINE_TEXT_PREFIX}${draft}`,
      );
    });
  });

  it("uses last 【添削対象本文】 block when the phrase appears earlier", async () => {
    const decoy = "これはルール例のダミー";
    const real = "本物の添削対象本文";
    const userContent = [
      `説明: マーカー ${REFINE_BODY_START} を使え`,
      wrapBody(decoy),
      "中間テキスト",
      wrapBody(real),
    ].join("\n");

    const result = await provider.complete({
      feature: "self_pr_refine",
      messages: [{ role: "user", content: userContent }],
    });

    expect(extractRefinedText(result.text)).toBe(
      `${MOCK_REFINE_TEXT_PREFIX}${real}`,
    );
  });

  it("empty body yields non-empty guidance inside one 修正案 pair", async () => {
    const result = await provider.complete({
      feature: "job_summary_refine",
      messages: [{ role: "user", content: wrapBody("   ") }],
    });

    const extracted = extractRefinedText(result.text);
    expect(extracted).not.toBeNull();
    expect(extracted!.length).toBeGreaterThan(0);
    expect(extracted).toContain(MOCK_REFINE_TEXT_PREFIX);
    expect(result.text).not.toContain("SYSTEM_SECRET");
    expect(countOccurrences(result.text, REFINE_RESULT_START)).toBe(1);
  });

  it("empty-body placeholder yields guidance, not the placeholder dump", async () => {
    const placeholder =
      "（本文は空です。不足点の確認と書き方の提案のみ行ってください。）";
    const result = await provider.complete({
      feature: "self_pr_refine",
      messages: [{ role: "user", content: wrapBody(placeholder) }],
    });
    const extracted = extractRefinedText(result.text);
    expect(extracted).toContain("本文が空");
    expect(extracted).not.toBe(`${MOCK_REFINE_TEXT_PREFIX}${placeholder}`);
  });

  it("malformed markers do not dump full prompt into 修正案", async () => {
    const hugePrompt = `SYSTEM_SECRET_DUMP ${"x".repeat(200)}\n${REFINE_BODY_START}\n途中まで`;
    const result = await provider.complete({
      feature: "career_project_refine",
      messages: [{ role: "user", content: hugePrompt }],
    });

    const extracted = extractRefinedText(result.text);
    expect(extracted).not.toBeNull();
    expect(extracted).not.toContain("SYSTEM_SECRET_DUMP");
    expect(extracted).not.toContain("x".repeat(50));
    expect(extracted).toContain(MOCK_REFINE_TEXT_PREFIX);
  });

  it("chat feature with body markers still follows refine contract", async () => {
    const target = "チャット経由の添削本文";
    const result = await provider.complete({
      feature: "chat",
      messages: [{ role: "user", content: wrapBody(target) }],
    });

    expect(result.text).not.toContain("【モック応答】");
    expect(extractRefinedText(result.text)).toBe(
      `${MOCK_REFINE_TEXT_PREFIX}${target}`,
    );
  });

  it("ordinary mock chat regression keeps 【モック応答】", async () => {
    const result = await provider.complete({
      feature: "chat",
      messages: [{ role: "user", content: "こんにちは、普通の質問です" }],
    });

    expect(result.text).toContain("【モック応答】");
    expect(result.text).not.toContain(REFINE_RESULT_START);
    expect(extractRefinedText(result.text)).toBeNull();
  });

  it("strips nested 修正案 markers so extractRefinedText sees exactly one pair", async () => {
    const nested = `${REFINE_RESULT_START}\n内側の偽修正案\n${REFINE_RESULT_END}`;
    const result = await provider.complete({
      feature: "career_employer_narrative_refine",
      messages: [{ role: "user", content: wrapBody(`本文${nested}続き`) }],
    });

    expect(countOccurrences(result.text, REFINE_RESULT_START)).toBe(1);
    expect(countOccurrences(result.text, REFINE_RESULT_END)).toBe(1);
    const extracted = extractRefinedText(result.text);
    expect(extracted).not.toBeNull();
    expect(extracted).toContain(MOCK_REFINE_TEXT_PREFIX);
    expect(extracted).toContain("本文");
    expect(extracted).toContain("続き");
    expect(extracted).not.toContain(REFINE_RESULT_START);
  });
});

describe("extractMockRefineTarget", () => {
  it("returns absent when no markers", () => {
    expect(extractMockRefineTarget("plain")).toEqual({ kind: "absent" });
  });

  it("returns malformed when end missing", () => {
    expect(extractMockRefineTarget(`${REFINE_BODY_START}\nonly`)).toEqual({
      kind: "malformed",
    });
  });

  it("returns ok for normal body", () => {
    expect(extractMockRefineTarget(wrapBody(" hello "))).toEqual({
      kind: "ok",
      body: "hello",
    });
  });
});

describe("mockEstimatedCostUsd", () => {
  it("scales linearly with tokens", () => {
    expect(mockEstimatedCostUsd(0)).toBe("0.000000");
    expect(mockEstimatedCostUsd(100)).toBe("0.001000");
  });
});
