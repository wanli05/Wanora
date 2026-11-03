"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState, type ReactNode } from "react";
import { JapaneseTextField } from "@/components/japanese-text-field";
import { PhotoUpload } from "@/components/photo-upload";
import type { EducationEventCode } from "@/lib/domain/resume-events";
import type { LicenseStatus } from "@/lib/domain/resume-events";
import type { WorkHistoryEventCode } from "@/lib/domain/resume-events";
import {
  EDUCATION_EVENT_CODES,
  LICENSE_STATUSES,
  WORK_HISTORY_EVENT_CODES,
} from "@/lib/domain/resume-events";
import {
  formatEducationLine,
  formatLicenseLine,
  formatWorkHistoryLine,
} from "@/lib/domain/profile-display";
import type { LocalizedText } from "@/lib/domain/localized-text";
import {
  saveFullProfileAction,
  type ProfileSaveState,
} from "@/lib/profile-actions";

type EducationRow = {
  clientKey: string;
  id?: string;
  year: number;
  month: number;
  schoolJa: string;
  eventCode: EducationEventCode;
};

type WorkHistoryRow = {
  clientKey: string;
  id?: string;
  year: number;
  month: number;
  workContentJa: string;
  eventCode: WorkHistoryEventCode;
};

type LicenseRow = {
  clientKey: string;
  id?: string;
  year: number;
  month: number;
  nameJa: string;
  status: LicenseStatus;
  score: string;
};

export type ProfilePageFormLabels = {
  edit: string;
  save: string;
  addRow: string;
  removeRow: string;
  savedMessage: string;
  errorMessages: Record<NonNullable<ProfileSaveState["error"]>, string>;
  sections: {
    basic: string;
    education: string;
    workHistory: string;
    licenses: string;
  };
  basic: {
    fullName: string;
    fullNameKana: string;
    birthDate: string;
    ageSuffix: string;
    gender: string;
    postalCode: string;
    dateFormat: string;
    dateFormatWareki: string;
    dateFormatSeireki: string;
    address: string;
    addressKana: string;
    phone: string;
    email: string;
    altContact: string;
  };
  japaneseHint: string;
  education: {
    empty: string;
    school: string;
    event: string;
    year: string;
    month: string;
  };
  workHistory: {
    empty: string;
    workContent: string;
    event: string;
    year: string;
    month: string;
  };
  licenses: {
    empty: string;
    name: string;
    status: string;
    score: string;
    year: string;
    month: string;
  };
  events: {
    education: Record<EducationEventCode, string>;
    workHistory: Record<WorkHistoryEventCode, string>;
    licenseStatus: Record<LicenseStatus, string>;
  };
};

export type ProfilePageInitial = {
  fullName: LocalizedText;
  fullNameKana: string;
  birthDate: string;
  age: number | null;
  gender: LocalizedText;
  postalCode: string;
  dateFormat: "wareki" | "seireki";
  address: LocalizedText;
  addressKana: string;
  phone: string;
  email: string;
  altContact: LocalizedText;
  education: Omit<EducationRow, "clientKey">[];
  workHistory: Omit<WorkHistoryRow, "clientKey">[];
  licenses: Omit<LicenseRow, "clientKey">[];
  storageReady: boolean;
};

function withClientKeys<T extends { id?: string }>(
  rows: T[],
): (T & { clientKey: string })[] {
  return rows.map((row, index) => ({
    ...row,
    clientKey: row.id ?? `new-${index}`,
  }));
}

function ViewRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr className="border-b border-zinc-200 dark:border-zinc-800">
      <th className="w-36 py-2.5 pr-4 text-left align-top text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </th>
      <td className="py-2.5 text-sm text-zinc-900 dark:text-zinc-100">
        {value || "—"}
      </td>
    </tr>
  );
}

function RirekishoTable({ children }: { children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>{children}</tbody>
    </table>
  );
}

function TimelineTable({ children }: { children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {children}
      </tbody>
    </table>
  );
}

export function ProfilePageForm({
  initial,
  labels,
}: {
  initial: ProfilePageInitial;
  labels: ProfilePageFormLabels;
}) {
  const [editing, setEditing] = useState(false);
  const [educationRows, setEducationRows] = useState(() =>
    withClientKeys(initial.education),
  );
  const [workRows, setWorkRows] = useState(() =>
    withClientKeys(initial.workHistory),
  );
  const [licenseRows, setLicenseRows] = useState(() =>
    withClientKeys(initial.licenses),
  );

  const router = useRouter();
  const boundSave = useCallback(
    async (prev: ProfileSaveState, formData: FormData) => {
      const result = await saveFullProfileAction(prev, formData);
      if (result.ok) {
        setEditing(false);
        router.refresh();
      }
      return result;
    },
    [router],
  );

  const [state, formAction, pending] = useActionState<
    ProfileSaveState,
    FormData
  >(boundSave, {});

  const inputClass =
    "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <form action={formAction} className="space-y-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {editing ? (
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "…" : labels.save}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            {labels.edit}
          </button>
        )}
      </div>

      {state.ok ? (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          role="status"
        >
          {labels.savedMessage}
        </p>
      ) : null}
      {state.error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {labels.errorMessages[state.error]}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{labels.sections.basic}</h2>
        {editing ? (
          <div className="space-y-4">
            <JapaneseTextField
              fieldPrefix="fullName"
              label={labels.basic.fullName}
              value={initial.fullName}
              required
              hint={labels.japaneseHint}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{labels.basic.fullNameKana}</span>
                <input
                  name="fullNameKana"
                  defaultValue={initial.fullNameKana}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{labels.basic.birthDate}</span>
                <input
                  type="date"
                  name="birthDate"
                  defaultValue={initial.birthDate}
                  className={inputClass}
                />
                {initial.age != null && labels.basic.ageSuffix ? (
                  <span className="text-xs text-zinc-500">
                    {labels.basic.ageSuffix}
                  </span>
                ) : null}
              </label>
            </div>
            <JapaneseTextField
              fieldPrefix="gender"
              label={labels.basic.gender}
              value={initial.gender}
              hint={labels.japaneseHint}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{labels.basic.postalCode}</span>
                <input
                  name="postalCode"
                  defaultValue={initial.postalCode}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{labels.basic.dateFormat}</span>
                <select
                  name="dateFormat"
                  defaultValue={initial.dateFormat}
                  className={inputClass}
                >
                  <option value="wareki">{labels.basic.dateFormatWareki}</option>
                  <option value="seireki">
                    {labels.basic.dateFormatSeireki}
                  </option>
                </select>
              </label>
            </div>
            <JapaneseTextField
              fieldPrefix="address"
              label={labels.basic.address}
              value={initial.address}
              hint={labels.japaneseHint}
            />
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{labels.basic.addressKana}</span>
              <input
                name="addressKana"
                defaultValue={initial.addressKana}
                className={inputClass}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{labels.basic.phone}</span>
                <input
                  name="phone"
                  defaultValue={initial.phone}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">{labels.basic.email}</span>
                <input
                  name="email"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  defaultValue={initial.email}
                  className={inputClass}
                />
              </label>
            </div>
            <JapaneseTextField
              fieldPrefix="altContact"
              label={labels.basic.altContact}
              value={initial.altContact}
              multiline
              hint={labels.japaneseHint}
            />
            <PhotoUpload disabled={!initial.storageReady} />
          </div>
        ) : (
          <RirekishoTable>
            <ViewRow
              label={labels.basic.fullName}
              value={initial.fullName.ja}
            />
            <ViewRow
              label={labels.basic.fullNameKana}
              value={initial.fullNameKana}
            />
            <ViewRow
              label={labels.basic.birthDate}
              value={
                initial.birthDate
                  ? `${initial.birthDate}${labels.basic.ageSuffix ? `（${labels.basic.ageSuffix}）` : ""}`
                  : null
              }
            />
            <ViewRow label={labels.basic.gender} value={initial.gender.ja} />
            <ViewRow
              label={labels.basic.postalCode}
              value={initial.postalCode}
            />
            <ViewRow
              label={labels.basic.dateFormat}
              value={
                initial.dateFormat === "wareki"
                  ? labels.basic.dateFormatWareki
                  : labels.basic.dateFormatSeireki
              }
            />
            <ViewRow label={labels.basic.address} value={initial.address.ja} />
            <ViewRow
              label={labels.basic.addressKana}
              value={initial.addressKana}
            />
            <ViewRow label={labels.basic.phone} value={initial.phone} />
            <ViewRow label={labels.basic.email} value={initial.email} />
            <ViewRow
              label={labels.basic.altContact}
              value={initial.altContact.ja}
            />
          </RirekishoTable>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{labels.sections.education}</h2>
        {editing ? (
          <div className="space-y-4">
            {educationRows.map((row, index) => (
              <div
                key={row.clientKey}
                className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <input
                  type="hidden"
                  name={`education.${index}.id`}
                  value={row.id ?? ""}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="text-sm">
                    <span className="font-medium">{labels.education.year}</span>
                    <input
                      name={`education.${index}.year`}
                      type="number"
                      required
                      min={1900}
                      max={2100}
                      value={row.year || ""}
                      onChange={(e) =>
                        setEducationRows((rows) =>
                          rows.map((r) =>
                            r.clientKey === row.clientKey
                              ? { ...r, year: Number(e.target.value) }
                              : r,
                          ),
                        )
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium">
                      {labels.education.month}
                    </span>
                    <input
                      name={`education.${index}.month`}
                      type="number"
                      required
                      min={1}
                      max={12}
                      value={row.month || ""}
                      onChange={(e) =>
                        setEducationRows((rows) =>
                          rows.map((r) =>
                            r.clientKey === row.clientKey
                              ? { ...r, month: Number(e.target.value) }
                              : r,
                          ),
                        )
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="font-medium">
                      {labels.education.event}
                    </span>
                    <select
                      name={`education.${index}.eventCode`}
                      value={row.eventCode}
                      onChange={(e) =>
                        setEducationRows((rows) =>
                          rows.map((r) =>
                            r.clientKey === row.clientKey
                              ? {
                                  ...r,
                                  eventCode: e.target
                                    .value as EducationEventCode,
                                }
                              : r,
                          ),
                        )
                      }
                      className={`mt-1 ${inputClass}`}
                    >
                      {EDUCATION_EVENT_CODES.map((code) => (
                        <option key={code} value={code}>
                          {labels.events.education[code]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">{labels.education.school}</span>
                  <input
                    name={`education.${index}.school_ja`}
                    required
                    value={row.schoolJa}
                    onChange={(e) =>
                      setEducationRows((rows) =>
                        rows.map((r) =>
                          r.clientKey === row.clientKey
                            ? { ...r, schoolJa: e.target.value }
                            : r,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() =>
                    setEducationRows((rows) =>
                      rows.filter((r) => r.clientKey !== row.clientKey),
                    )
                  }
                >
                  {labels.removeRow}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
              onClick={() =>
                setEducationRows((rows) => [
                  ...rows,
                  {
                    clientKey: `new-${crypto.randomUUID()}`,
                    year: new Date().getFullYear(),
                    month: 4,
                    schoolJa: "",
                    eventCode: "enrolled",
                  },
                ])
              }
            >
              {labels.addRow}
            </button>
          </div>
        ) : educationRows.length === 0 ? (
          <p className="text-sm text-zinc-500">{labels.education.empty}</p>
        ) : (
          <TimelineTable>
            {educationRows.map((row) => (
              <tr key={row.clientKey}>
                <td className="py-2.5">
                  {formatEducationLine(
                    row.year,
                    row.month,
                    row.schoolJa,
                    labels.events.education[row.eventCode],
                  )}
                </td>
              </tr>
            ))}
          </TimelineTable>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{labels.sections.workHistory}</h2>
        {editing ? (
          <div className="space-y-4">
            {workRows.map((row, index) => (
              <div
                key={row.clientKey}
                className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <input
                  type="hidden"
                  name={`workHistory.${index}.id`}
                  value={row.id ?? ""}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="text-sm">
                    <span className="font-medium">
                      {labels.workHistory.year}
                    </span>
                    <input
                      name={`workHistory.${index}.year`}
                      type="number"
                      required
                      min={1900}
                      max={2100}
                      value={row.year || ""}
                      onChange={(e) =>
                        setWorkRows((rows) =>
                          rows.map((r) =>
                            r.clientKey === row.clientKey
                              ? { ...r, year: Number(e.target.value) }
                              : r,
                          ),
                        )
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium">
                      {labels.workHistory.month}
                    </span>
                    <input
                      name={`workHistory.${index}.month`}
                      type="number"
                      required
                      min={1}
                      max={12}
                      value={row.month || ""}
                      onChange={(e) =>
                        setWorkRows((rows) =>
                          rows.map((r) =>
                            r.clientKey === row.clientKey
                              ? { ...r, month: Number(e.target.value) }
                              : r,
                          ),
                        )
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="font-medium">
                      {labels.workHistory.event}
                    </span>
                    <select
                      name={`workHistory.${index}.eventCode`}
                      value={row.eventCode}
                      onChange={(e) =>
                        setWorkRows((rows) =>
                          rows.map((r) =>
                            r.clientKey === row.clientKey
                              ? {
                                  ...r,
                                  eventCode: e.target
                                    .value as WorkHistoryEventCode,
                                }
                              : r,
                          ),
                        )
                      }
                      className={`mt-1 ${inputClass}`}
                    >
                      {WORK_HISTORY_EVENT_CODES.map((code) => (
                        <option key={code} value={code}>
                          {labels.events.workHistory[code]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">
                    {labels.workHistory.workContent}
                  </span>
                  <input
                    name={`workHistory.${index}.company_ja`}
                    required
                    value={row.workContentJa}
                    onChange={(e) =>
                      setWorkRows((rows) =>
                        rows.map((r) =>
                          r.clientKey === row.clientKey
                            ? { ...r, workContentJa: e.target.value }
                            : r,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() =>
                    setWorkRows((rows) =>
                      rows.filter((r) => r.clientKey !== row.clientKey),
                    )
                  }
                >
                  {labels.removeRow}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
              onClick={() =>
                setWorkRows((rows) => [
                  ...rows,
                  {
                    clientKey: `new-${crypto.randomUUID()}`,
                    year: new Date().getFullYear(),
                    month: 4,
                    workContentJa: "",
                    eventCode: "joined",
                  },
                ])
              }
            >
              {labels.addRow}
            </button>
          </div>
        ) : workRows.length === 0 ? (
          <p className="text-sm text-zinc-500">{labels.workHistory.empty}</p>
        ) : (
          <TimelineTable>
            {workRows.map((row) => (
              <tr key={row.clientKey}>
                <td className="whitespace-nowrap py-2.5 pr-4 align-top">
                  {formatWorkHistoryLine(
                    row.year,
                    row.month,
                    labels.events.workHistory[row.eventCode],
                  )}
                </td>
                <td className="py-2.5">{row.workContentJa || "—"}</td>
              </tr>
            ))}
          </TimelineTable>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{labels.sections.licenses}</h2>
        {editing ? (
          <div className="space-y-4">
            {licenseRows.map((row, index) => (
              <div
                key={row.clientKey}
                className="space-y-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <input
                  type="hidden"
                  name={`licenses.${index}.id`}
                  value={row.id ?? ""}
                />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="text-sm">
                    <span className="font-medium">{labels.licenses.year}</span>
                    <input
                      name={`licenses.${index}.year`}
                      type="number"
                      required
                      min={1900}
                      max={2100}
                      value={row.year || ""}
                      onChange={(e) =>
                        setLicenseRows((rows) =>
                          rows.map((r) =>
                            r.clientKey === row.clientKey
                              ? { ...r, year: Number(e.target.value) }
                              : r,
                          ),
                        )
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="font-medium">{labels.licenses.month}</span>
                    <input
                      name={`licenses.${index}.month`}
                      type="number"
                      required
                      min={1}
                      max={12}
                      value={row.month || ""}
                      onChange={(e) =>
                        setLicenseRows((rows) =>
                          rows.map((r) =>
                            r.clientKey === row.clientKey
                              ? { ...r, month: Number(e.target.value) }
                              : r,
                          ),
                        )
                      }
                      className={`mt-1 ${inputClass}`}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    <span className="font-medium">{labels.licenses.status}</span>
                    <select
                      name={`licenses.${index}.status`}
                      value={row.status}
                      onChange={(e) =>
                        setLicenseRows((rows) =>
                          rows.map((r) =>
                            r.clientKey === row.clientKey
                              ? {
                                  ...r,
                                  status: e.target.value as LicenseStatus,
                                }
                              : r,
                          ),
                        )
                      }
                      className={`mt-1 ${inputClass}`}
                    >
                      {LICENSE_STATUSES.map((code) => (
                        <option key={code} value={code}>
                          {labels.events.licenseStatus[code]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">{labels.licenses.name}</span>
                  <input
                    name={`licenses.${index}.name_ja`}
                    required
                    value={row.nameJa}
                    onChange={(e) =>
                      setLicenseRows((rows) =>
                        rows.map((r) =>
                          r.clientKey === row.clientKey
                            ? { ...r, nameJa: e.target.value }
                            : r,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">{labels.licenses.score}</span>
                  <input
                    name={`licenses.${index}.score`}
                    value={row.score}
                    onChange={(e) =>
                      setLicenseRows((rows) =>
                        rows.map((r) =>
                          r.clientKey === row.clientKey
                            ? { ...r, score: e.target.value }
                            : r,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </label>
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() =>
                    setLicenseRows((rows) =>
                      rows.filter((r) => r.clientKey !== row.clientKey),
                    )
                  }
                >
                  {labels.removeRow}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
              onClick={() =>
                setLicenseRows((rows) => [
                  ...rows,
                  {
                    clientKey: `new-${crypto.randomUUID()}`,
                    year: new Date().getFullYear(),
                    month: 12,
                    nameJa: "",
                    status: "acquired",
                    score: "",
                  },
                ])
              }
            >
              {labels.addRow}
            </button>
          </div>
        ) : licenseRows.length === 0 ? (
          <p className="text-sm text-zinc-500">{labels.licenses.empty}</p>
        ) : (
          <TimelineTable>
            {licenseRows.map((row) => (
              <tr key={row.clientKey}>
                <td className="py-2.5">
                  {formatLicenseLine(
                    row.year,
                    row.month,
                    row.nameJa,
                    labels.events.licenseStatus[row.status],
                  )}
                  {row.score ? `（${row.score}）` : ""}
                </td>
              </tr>
            ))}
          </TimelineTable>
        )}
      </section>
    </form>
  );
}
