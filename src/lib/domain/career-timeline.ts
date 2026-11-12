import {
  jaOf,
  type CareerTimelineItem,
} from "@/lib/domain/career";
import { formatYearMonthJa } from "@/lib/domain/dates";
import type { LocalizedText } from "@/lib/domain/localized-text";

function ymLabel(d: Date): string {
  return formatYearMonthJa(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

export function buildCareerTimeline(input: {
  education: { id: string; yearMonth: Date; school: LocalizedText; eventCode: string }[];
  workHistory: { id: string; yearMonth: Date; company: LocalizedText; eventCode: string }[];
  licenses: { id: string; acquiredYm: Date; name: LocalizedText }[];
  projects: {
    id: string;
    startYm: Date;
    title: LocalizedText;
    status: string;
  }[];
  skills: { id: string; name: string; yearsText: string; updatedAt?: Date }[];
  goals: { id: string; kind: string; content: LocalizedText }[];
}): CareerTimelineItem[] {
  const items: CareerTimelineItem[] = [];

  for (const row of input.education) {
    items.push({
      id: `edu-${row.id}`,
      kind: "education",
      at: ymLabel(row.yearMonth),
      title: jaOf(row.school),
      summary: row.eventCode,
      module: "profile",
    });
  }
  for (const row of input.workHistory) {
    items.push({
      id: `work-${row.id}`,
      kind: "work",
      at: ymLabel(row.yearMonth),
      title: jaOf(row.company),
      summary: row.eventCode,
      module: "work",
    });
  }
  for (const row of input.licenses) {
    items.push({
      id: `lic-${row.id}`,
      kind: "license",
      at: ymLabel(row.acquiredYm),
      title: jaOf(row.name),
      module: "skills",
    });
  }
  for (const row of input.projects) {
    if (row.status !== "confirmed") continue;
    items.push({
      id: `proj-${row.id}`,
      kind: "project",
      at: ymLabel(row.startYm),
      title: jaOf(row.title),
      module: "projects",
    });
  }
  for (const row of input.goals) {
    items.push({
      id: `goal-${row.id}`,
      kind: "goal",
      at: row.kind === "short" ? "短期" : "長期",
      title: jaOf(row.content),
      module: "goals",
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at, "ja"));
}
