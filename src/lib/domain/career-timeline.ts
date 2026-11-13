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
  /** Prefer Work History module when present; else fall back to legacy workHistory. */
  employers?: {
    id: string;
    companyName: LocalizedText;
    title: string | null;
    startYm: Date;
    endYm: Date | null;
  }[];
  licenses: { id: string; acquiredYm: Date; name: LocalizedText }[];
  projects: {
    id: string;
    startYm: Date;
    title: LocalizedText;
    status: string;
  }[];
  skills: { id: string; name: string; yearsText: string; updatedAt?: Date }[];
  /** Goals stay in Career Goals only — no dated timestamp, so excluded from timeline. */
  goals?: { id: string; kind: string; content: LocalizedText }[];
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
  if (input.employers && input.employers.length > 0) {
    for (const row of input.employers) {
      const company = jaOf(row.companyName);
      const title = row.title?.trim() ?? "";
      items.push({
        id: `emp-${row.id}-join`,
        kind: "work",
        at: ymLabel(row.startYm),
        title: title ? `${company}　${title}` : company,
        summary: "joined",
        module: "work",
      });
      if (row.endYm) {
        items.push({
          id: `emp-${row.id}-leave`,
          kind: "work",
          at: ymLabel(row.endYm),
          title: company,
          summary: "left",
          module: "work",
        });
      }
    }
  } else {
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

  return items.sort((a, b) => b.at.localeCompare(a.at, "ja"));
}
