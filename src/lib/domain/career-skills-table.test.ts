import { describe, expect, it } from "vitest";
import {
  groupSkillsByCategoryFirstSeen,
  planSkillTableRows,
} from "./career-skills-table";

type Skill = { id: string; category: string; name: string };

describe("groupSkillsByCategoryFirstSeen", () => {
  it("groups by first-seen category order and keeps intra-group order", () => {
    const skills: Skill[] = [
      { id: "1", category: "OS", name: "Linux" },
      { id: "2", category: "言語", name: "TypeScript" },
      { id: "3", category: "OS", name: "Windows" },
      { id: "4", category: "言語", name: "JavaScript" },
      { id: "5", category: "FW", name: "React" },
      { id: "6", category: "言語", name: "Python" },
    ];
    const groups = groupSkillsByCategoryFirstSeen(skills);
    expect(groups.map((g) => g.category)).toEqual(["OS", "言語", "FW"]);
    expect(groups[0]!.skills.map((s) => s.name)).toEqual(["Linux", "Windows"]);
    expect(groups[1]!.skills.map((s) => s.name)).toEqual([
      "TypeScript",
      "JavaScript",
      "Python",
    ]);
    expect(groups[2]!.skills.map((s) => s.name)).toEqual(["React"]);
  });

  it("returns empty for empty input", () => {
    expect(groupSkillsByCategoryFirstSeen([])).toEqual([]);
  });
});

describe("planSkillTableRows", () => {
  it("sets rowspan for multi-skill categories and 1 for singles", () => {
    const skills: Skill[] = [
      { id: "1", category: "OS", name: "Linux" },
      { id: "2", category: "言語", name: "TypeScript" },
      { id: "3", category: "OS", name: "Windows" },
      { id: "4", category: "言語", name: "JavaScript" },
      { id: "5", category: "FW", name: "React" },
      { id: "6", category: "言語", name: "Python" },
    ];
    const rows = planSkillTableRows(skills);
    expect(rows.map((r) => [r.skill.name, r.categoryRowSpan])).toEqual([
      ["Linux", 2],
      ["Windows", null],
      ["TypeScript", 3],
      ["JavaScript", null],
      ["Python", null],
      ["React", 1],
    ]);
  });
});
