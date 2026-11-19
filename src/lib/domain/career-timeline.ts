import {
  jaOf,
  type CareerTimelineItem,
} from "@/lib/domain/career";
import { formatYearMonthJa } from "@/lib/domain/dates";
import type { LocalizedText } from "@/lib/domain/localized-text";
import {
  EDUCATION_EVENT_CODES,
  WORK_HISTORY_EVENT_CODES,
  type EducationEventCode,
  type WorkHistoryEventCode,
} from "@/lib/domain/resume-events";

/** Timeline secondary copy is always Japanese business labels (matches messages/ja.json). */
const EDUCATION_EVENT_SUMMARY_JA: Record<EducationEventCode, string> = {
  enrolled: "入学",
  graduated: "卒業",
  withdrawn: "中退",
  completed: "修了",
};

const WORK_EVENT_SUMMARY_JA: Record<WorkHistoryEventCode, string> = {
  joined: "入社",
  left: "退社",
  transferred: "異動",
};

/** Map eventCode → JA label; never return raw English codes. */
export function timelineEventSummaryJa(eventCode: string): string | undefined {
  if ((EDUCATION_EVENT_CODES as readonly string[]).includes(eventCode)) {
    return EDUCATION_EVENT_SUMMARY_JA[eventCode as EducationEventCode];
  }
  if ((WORK_HISTORY_EVENT_CODES as readonly string[]).includes(eventCode)) {
    return WORK_EVENT_SUMMARY_JA[eventCode as WorkHistoryEventCode];
  }
  return undefined;
}

function ymLabel(d: Date): string {
  return formatYearMonthJa(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

function entryMs(createdAt?: Date | null): number {
  return createdAt?.getTime() ?? 0;
}

/** Parse display labels like `2025年9月` into numeric year/month. */
function parseAtYearMonth(at: string): { year: number; month: number } | null {
  const match = /^(\d{4})年(\d{1,2})月$/.exec(at.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }
  return { year, month };
}

/** Newest year/month first; unparseable labels sort after parseable ones. */
function compareAtDescending(a: string, b: string): number {
  const pa = parseAtYearMonth(a);
  const pb = parseAtYearMonth(b);
  if (pa && pb) {
    if (pa.year !== pb.year) return pb.year - pa.year;
    return pb.month - pa.month;
  }
  if (pa) return -1;
  if (pb) return 1;
  return b.localeCompare(a, "ja");
}

export function buildCareerTimeline(input: {
  education: {
    id: string;
    yearMonth: Date;
    school: LocalizedText;
    eventCode: string;
    createdAt?: Date | null;
  }[];
  workHistory: {
    id: string;
    yearMonth: Date;
    company: LocalizedText;
    eventCode: string;
    createdAt?: Date | null;
  }[];
  /** Prefer Work History module when present; else fall back to legacy workHistory. */
  employers?: {
    id: string;
    companyName: LocalizedText;
    title: string | null;
    startYm: Date;
    endYm: Date | null;
    createdAt?: Date | null;
  }[];
  licenses: {
    id: string;
    acquiredYm: Date;
    name: LocalizedText;
    createdAt?: Date | null;
  }[];
  projects: {
    id: string;
    startYm: Date;
    title: LocalizedText;
    status: string;
    createdAt?: Date | null;
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
      summary: timelineEventSummaryJa(row.eventCode),
      module: "profile",
      entryOrder: entryMs(row.createdAt),
    });
  }
  if (input.employers && input.employers.length > 0) {
    for (const row of input.employers) {
      const company = jaOf(row.companyName);
      const title = row.title?.trim() ?? "";
      const base = entryMs(row.createdAt);
      items.push({
        id: `emp-${row.id}-join`,
        kind: "work",
        at: ymLabel(row.startYm),
        title: title ? `${company}　${title}` : company,
        summary: timelineEventSummaryJa("joined"),
        module: "work",
        entryOrder: base,
      });
      if (row.endYm) {
        items.push({
          id: `emp-${row.id}-leave`,
          kind: "work",
          at: ymLabel(row.endYm),
          title: company,
          summary: timelineEventSummaryJa("left"),
          module: "work",
          // Same-month join/leave: leave stays to the right of join.
          entryOrder: base + 1,
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
        summary: timelineEventSummaryJa(row.eventCode),
        module: "work",
        entryOrder: entryMs(row.createdAt),
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
      entryOrder: entryMs(row.createdAt),
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
      entryOrder: entryMs(row.createdAt),
    });
  }

  return items.sort((a, b) => {
    const byAt = compareAtDescending(a.at, b.at);
    if (byAt !== 0) return byAt;
    if (a.entryOrder !== b.entryOrder) return a.entryOrder - b.entryOrder;
    return a.id.localeCompare(b.id);
  });
}

/** Group already-sorted timeline items: newest `at` first; within a month, L→R by entryOrder. */
export function groupCareerTimelineByAt(
  items: CareerTimelineItem[],
): { at: string; items: CareerTimelineItem[] }[] {
  const groups: { at: string; items: CareerTimelineItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.at === item.at) {
      last.items.push(item);
    } else {
      groups.push({ at: item.at, items: [item] });
    }
  }
  return groups;
}
