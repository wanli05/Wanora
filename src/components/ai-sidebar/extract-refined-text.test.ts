import { describe, expect, it } from "vitest";
import {
  extractRefinedFields,
  extractRefinedText,
} from "./extract-refined-text";
import {
  REFINE_RESULT_END,
  REFINE_RESULT_START,
  refineLabeledResultStart,
} from "./refine-prompts";

const S = REFINE_RESULT_START;
const E = REFINE_RESULT_END;
const PROFILE_IDS = ["self_pr", "job_summary", "strengths"] as const;
const PROJECT_IDS = [
  "overview",
  "phases",
  "responsibilities",
  "results",
] as const;

function labeled(id: string, body: string): string {
  return `${refineLabeledResultStart(id)}\n${body}\n${E}`;
}

describe("extractRefinedText", () => {
  it("extracts body between a single marker pair", () => {
    const content = [
      "了解しました。",
      S,
      "改善された自己PR",
      E,
      "【補足】成果の数値があれば追記してください。",
    ].join("\n");
    expect(extractRefinedText(content)).toBe("改善された自己PR");
  });

  it("returns null when markers are missing or empty", () => {
    expect(extractRefinedText("ただの説明です")).toBeNull();
    expect(extractRefinedText(`${S}\n\n${E}`)).toBeNull();
    expect(extractRefinedText(`${S}\n   \n${E}`)).toBeNull();
    expect(extractRefinedText(`良い文\n${E}`)).toBeNull();
    expect(extractRefinedText(`${S}\n良い文\n`)).toBeNull();
  });

  it("returns null for duplicate marker pairs (fail-closed)", () => {
    expect(
      extractRefinedText(`${S}\nA\n${E}\n${S}\nB\n${E}`),
    ).toBeNull();
  });

  it("returns null when markers appear in quoted content plus a real pair", () => {
    expect(
      extractRefinedText(`引用:${S}旧${E}\n${S}\n新\n${E}`),
    ).toBeNull();
  });

  it("returns null for nested or ambiguous markers", () => {
    expect(
      extractRefinedText(`${S}\n${S}\n内\n${E}\n外\n${E}`),
    ).toBeNull();
    expect(extractRefinedText(`${E}\n${S}\n本文\n${E}`)).toBeNull();
  });

  it("returns null when any labeled start is present (U3 / fail-closed)", () => {
    expect(
      extractRefinedText(`${labeled("self_pr", "A")}\n${S}\nB\n${E}`),
    ).toBeNull();
    expect(extractRefinedText(labeled("self_pr", "のみ"))).toBeNull();
  });

  it("handles long single-pair replies", () => {
    const body = "あ".repeat(20_000);
    expect(extractRefinedText(`${S}\n${body}\n${E}`)).toBe(body);
  });
});

describe("extractRefinedFields (U1/U2)", () => {
  it("parses all three profile fields", () => {
    const content = [
      labeled("self_pr", "PR本文"),
      labeled("job_summary", "要約本文"),
      labeled("strengths", "経験A\n経験B"),
      "【補足】任意",
    ].join("\n");
    expect(extractRefinedFields(content, PROFILE_IDS)).toEqual({
      self_pr: "PR本文",
      job_summary: "要約本文",
      strengths: "経験A\n経験B",
    });
  });

  it("parses a single returned field (partial apply map)", () => {
    expect(
      extractRefinedFields(labeled("results", "実績のみ"), PROJECT_IDS),
    ).toEqual({ results: "実績のみ" });
  });

  it("omits missing fields from the map (no wipe)", () => {
    const map = extractRefinedFields(
      [
        labeled("self_pr", "だけ"),
        labeled("strengths", "行1\n行2"),
      ].join("\n"),
      PROFILE_IDS,
    );
    expect(map).toEqual({
      self_pr: "だけ",
      strengths: "行1\n行2",
    });
    expect(map).not.toHaveProperty("job_summary");
  });

  it("fail-closes on unknown fieldId", () => {
    expect(
      extractRefinedFields(labeled("unknown_field", "x"), PROFILE_IDS),
    ).toBeNull();
  });

  it("fail-closes on duplicate fieldId", () => {
    expect(
      extractRefinedFields(
        `${labeled("self_pr", "A")}\n${labeled("self_pr", "B")}`,
        PROFILE_IDS,
      ),
    ).toBeNull();
  });

  it("fail-closes when unlabeled and labeled are mixed", () => {
    expect(
      extractRefinedFields(
        `${S}\n単一\n${E}\n${labeled("self_pr", "A")}`,
        PROFILE_IDS,
      ),
    ).toBeNull();
  });

  it("fail-closes on nested or empty labeled bodies", () => {
    expect(
      extractRefinedFields(
        `${refineLabeledResultStart("self_pr")}\n${refineLabeledResultStart("job_summary")}\n内\n${E}\n外\n${E}`,
        PROFILE_IDS,
      ),
    ).toBeNull();
    expect(
      extractRefinedFields(
        `${refineLabeledResultStart("self_pr")}\n\n${E}`,
        PROFILE_IDS,
      ),
    ).toBeNull();
  });

  it("fail-closes when end count mismatches starts", () => {
    expect(
      extractRefinedFields(
        `${refineLabeledResultStart("self_pr")}\n本文のみ`,
        PROFILE_IDS,
      ),
    ).toBeNull();
  });

  it("returns null for empty allow-list or no pairs", () => {
    expect(extractRefinedFields(labeled("self_pr", "A"), [])).toBeNull();
    expect(extractRefinedFields("説明だけ", PROFILE_IDS)).toBeNull();
  });
});
