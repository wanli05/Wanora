import { describe, expect, it } from "vitest";
import {
  applyPageNavigation,
  targetsEqual,
} from "@/lib/ai/context/navigation";

describe("applyPageNavigation", () => {
  it("updates page without clearing an explicit target", () => {
    const previous = {
      pageContext: { path: "/career", area: "my_career" as const },
      targetContext: {
        type: "profile" as const,
        section: "self_pr" as const,
      },
    };

    const next = applyPageNavigation(previous, {
      page: { path: "/board", area: "board" },
    });

    expect(next.pageContext).toEqual({ path: "/board", area: "board" });
    expect(next.targetContext).toEqual(previous.targetContext);
  });

  it("only changes target when explicitly provided or cleared", () => {
    const previous = {
      pageContext: { path: "/career", area: "my_career" as const },
      targetContext: {
        type: "career_project" as const,
        id: "proj-1",
      },
    };

    const switched = applyPageNavigation(previous, {
      page: { path: "/career/projects", area: "my_career" },
      target: { type: "profile", section: "job_summary" },
    });
    expect(switched.targetContext).toEqual({
      type: "profile",
      section: "job_summary",
    });

    const cleared = applyPageNavigation(switched, { clearTarget: true });
    expect(cleared.targetContext).toBeNull();
    expect(cleared.pageContext).toEqual(switched.pageContext);
  });
});

describe("targetsEqual", () => {
  it("compares profile sections and entity ids", () => {
    expect(
      targetsEqual(
        { type: "profile", section: "self_pr" },
        { type: "profile", section: "self_pr" },
      ),
    ).toBe(true);
    expect(
      targetsEqual(
        { type: "profile", section: "self_pr" },
        { type: "profile", section: "headline" },
      ),
    ).toBe(false);
    expect(
      targetsEqual(
        { type: "career_project", id: "a" },
        { type: "career_project", id: "a" },
      ),
    ).toBe(true);
  });
});
