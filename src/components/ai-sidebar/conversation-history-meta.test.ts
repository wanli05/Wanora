import { describe, expect, it } from "vitest";
import { historySourceKeyFromSlot } from "./conversation-history-meta";

describe("historySourceKeyFromSlot", () => {
  it("maps null to general", () => {
    expect(historySourceKeyFromSlot(null)).toBe("historySourceGeneral");
  });

  it("maps profile / project / employer slots", () => {
    expect(historySourceKeyFromSlot("refine:profile:module")).toBe(
      "historySourceProfile",
    );
    expect(
      historySourceKeyFromSlot(
        "refine:career_project:11111111-1111-4111-8111-111111111111",
      ),
    ).toBe("historySourceProject");
    expect(
      historySourceKeyFromSlot(
        "refine:career_employer:11111111-1111-4111-8111-111111111111",
      ),
    ).toBe("historySourceEmployer");
  });
});
