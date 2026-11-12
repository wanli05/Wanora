export type JobPostingFields = {
  jobUrl: string | null;
  salaryBandText: string | null;
  benefitsText: string | null;
  jdText: string | null;
  processNotes: string | null;
  workLocationText: string | null;
  jobNotes: string | null;
};

export function hasJobPostingContent(fields: JobPostingFields): boolean {
  return Object.values(fields).some((value) => Boolean(value?.trim()));
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
