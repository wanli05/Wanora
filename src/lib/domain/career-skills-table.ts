/**
 * Group skills by category for the マイキャリア skills table / 職務経歴書 export.
 * Categories follow first-seen order; within a category, original order is kept.
 */

export type SkillCategoryGroup<T extends { category: string }> = {
  category: string;
  skills: T[];
};

export type SkillTablePlanRow<T extends { category: string }> = {
  skill: T;
  category: string;
  /**
   * When non-null, emit a 分類 cell.
   * - `1`: ordinary cell (single skill in the category)
   * - `>=2`: rowspan / vertical merge spanning that many rows
   * When null, omit the 分類 cell (HTML) or emit a vertical-merge continuation (docx).
   */
  categoryRowSpan: number | null;
};

export function groupSkillsByCategoryFirstSeen<T extends { category: string }>(
  skills: readonly T[],
): SkillCategoryGroup<T>[] {
  const order: string[] = [];
  const map = new Map<string, T[]>();
  for (const skill of skills) {
    const key = skill.category;
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(skill);
    } else {
      order.push(key);
      map.set(key, [skill]);
    }
  }
  return order.map((category) => ({
    category,
    skills: map.get(category)!,
  }));
}

export function planSkillTableRows<T extends { category: string }>(
  skills: readonly T[],
): SkillTablePlanRow<T>[] {
  const groups = groupSkillsByCategoryFirstSeen(skills);
  const rows: SkillTablePlanRow<T>[] = [];
  for (const group of groups) {
    const n = group.skills.length;
    group.skills.forEach((skill, index) => {
      rows.push({
        skill,
        category: group.category,
        categoryRowSpan: index === 0 ? n : null,
      });
    });
  }
  return rows;
}
