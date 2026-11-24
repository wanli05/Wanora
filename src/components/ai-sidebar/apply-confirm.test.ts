import { describe, expect, it } from "vitest";
import { formatMultiApplyFieldList } from "./apply-confirm";

describe("formatMultiApplyFieldList", () => {
  it("lists only the returned field labels as bullets", () => {
    expect(formatMultiApplyFieldList(["self_pr"])).toBe("自己PR");
    expect(formatMultiApplyFieldList(["self_pr", "job_summary"])).toBe(
      "自己PR\n・職務要約",
    );
    expect(formatMultiApplyFieldList(["results"])).toBe("実績");
  });

  it("keeps order of the apply map keys", () => {
    expect(
      formatMultiApplyFieldList([
        "overview",
        "phases",
        "responsibilities",
        "results",
      ]),
    ).toBe("概要\n・担当フェーズ\n・業務内容\n・実績");
  });
});
