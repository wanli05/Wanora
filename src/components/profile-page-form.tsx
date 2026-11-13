"use client";

import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState, type ReactNode } from "react";
import { JapaneseTextField } from "@/components/japanese-text-field";
import { PhotoUpload } from "@/components/photo-upload";
import { PostalAddressFields } from "@/components/postal-address-fields";
import { YearMonthField } from "@/app/[locale]/profile/form-fields";
import type { EducationEventCode } from "@/lib/domain/resume-events";
import { EDUCATION_EVENT_CODES } from "@/lib/domain/resume-events";
import { formatYearMonthJa } from "@/lib/domain/profile-display";
import {
  formatYearMonthInputValue,
  parseYearMonthInputValue,
  sortByYearMonthInput,
} from "@/lib/domain/dates";
import type { LocalizedText } from "@/lib/domain/localized-text";
import {
  saveFullProfileAction,
  type ProfileSaveState,
} from "@/lib/profile-actions";

type EducationRow = {
  clientKey: string;
  id?: string;
  yearMonth: string;
  schoolJa: string;
  eventCode: EducationEventCode;
};

type LicenseRow = {
  clientKey: string;
  id?: string;
  yearMonth: string;
  nameJa: string;
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
    photo: string;
    photoAlt: string;
    postalLookupHint: string;
    postalLookingUp: string;
    postalNotFound: string;
    postalLookupFailed: string;
    postalLineRemainderHint: string;
  };
  japaneseHint: string;
  education: {
    empty: string;
    school: string;
    event: string;
    yearMonth: string;
  };
  licenses: {
    empty: string;
    name: string;
    yearMonth: string;
  };
  events: {
    education: Record<EducationEventCode, string>;
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
  licenses: Omit<LicenseRow, "clientKey">[];
  storageReady: boolean;
  hasPhoto: boolean;
  /** Dev fallback when S3_* is unset. */
  photoLocalBackend?: boolean;
};

function withClientKeys<T extends { id?: string; yearMonth: string }>(
  rows: T[],
): (T & { clientKey: string })[] {
  return sortByYearMonthInput(rows).map((row, index) => ({
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

function TimelineTableWithHead({
  head,
  children,
}: {
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-zinc-300 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
          {head}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {children}
      </tbody>
    </table>
  );
}

function yearMonthParts(yearMonth: string): { year: number; month: number } {
  return parseYearMonthInputValue(yearMonth);
}

function defaultYearMonth(month = 4): string {
  return formatYearMonthInputValue(new Date().getFullYear(), month);
}

const PROFILE_SAVED_FLASH_KEY = "wanora.profile.justSaved";

function writeProfileSavedFlash() {
  try {
    sessionStorage.setItem(PROFILE_SAVED_FLASH_KEY, "1");
  } catch {
    // Private mode / blocked storage — banner may only last until remount.
  }
}

function consumeProfileSavedFlash(): boolean {
  try {
    if (sessionStorage.getItem(PROFILE_SAVED_FLASH_KEY) !== "1") return false;
    sessionStorage.removeItem(PROFILE_SAVED_FLASH_KEY);
    return true;
  } catch {
    return false;
  }
}

export function ProfilePageForm({
  initial,
  labels,
}: {
  initial: ProfilePageInitial;
  labels: ProfilePageFormLabels;
}) {
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(() => consumeProfileSavedFlash());
  const [educationRows, setEducationRows] = useState(() =>
    withClientKeys(initial.education),
  );
  const [licenseRows, setLicenseRows] = useState(() =>
    withClientKeys(initial.licenses),
  );

  const router = useRouter();
  const boundSave = useCallback(
    async (prev: ProfileSaveState, formData: FormData) => {
      const result = await saveFullProfileAction(prev, formData);
      if (result.ok) {
        // Survive router.refresh() remount wiping useActionState.
        writeProfileSavedFlash();
        setJustSaved(true);
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

  const saveButton = (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {pending ? "…" : labels.save}
    </button>
  );

  const sections = (
    <>
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
            <PostalAddressFields
              labels={{
                postalCode: labels.basic.postalCode,
                address: labels.basic.address,
                addressKana: labels.basic.addressKana,
                japaneseHint: labels.japaneseHint,
                lookupHint: labels.basic.postalLookupHint,
                lookingUp: labels.basic.postalLookingUp,
                notFound: labels.basic.postalNotFound,
                lookupFailed: labels.basic.postalLookupFailed,
                lineRemainderHint: labels.basic.postalLineRemainderHint,
              }}
              initialPostalCode={initial.postalCode}
              initialAddressJa={initial.address.ja ?? ""}
              initialAddressKana={initial.addressKana}
              inputClass={inputClass}
            />
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
            <PhotoUpload
              disabled={!initial.storageReady}
              hasPhoto={initial.hasPhoto}
              localBackend={Boolean(initial.photoLocalBackend)}
              initialUrl={
                initial.hasPhoto ? "/api/profile/photo" : null
              }
            />
          </div>
        ) : (
          <RirekishoTable>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="w-36 py-2.5 pr-4 text-left align-top text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {labels.basic.photo}
              </th>
              <td className="py-2.5 text-sm text-zinc-900 dark:text-zinc-100">
                {initial.hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element -- authenticated photo API
                  <img
                    src="/api/profile/photo"
                    alt={labels.basic.photoAlt}
                    className="h-[113px] w-[85px] rounded border border-zinc-200 object-cover dark:border-zinc-700"
                  />
                ) : (
                  <div
                    className="flex h-[113px] w-[85px] items-center justify-center rounded border border-dashed border-zinc-300 text-xs text-zinc-400 dark:border-zinc-600"
                    aria-label={labels.basic.photo}
                  >
                    {labels.basic.photo}
                  </div>
                )}
              </td>
            </tr>
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <YearMonthField
                    name={`education.${index}.yearMonth`}
                    label={labels.education.yearMonth}
                    value={row.yearMonth}
                    onChange={(yearMonth) =>
                      setEducationRows((rows) =>
                        sortByYearMonthInput(
                          rows.map((r) =>
                            r.clientKey === row.clientKey
                              ? { ...r, yearMonth }
                              : r,
                          ),
                        ),
                      )
                    }
                  />
                  <label className="block space-y-1 text-sm">
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
                      className={inputClass}
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
                setEducationRows((rows) =>
                  sortByYearMonthInput([
                    ...rows,
                    {
                      clientKey: `new-${crypto.randomUUID()}`,
                      yearMonth: defaultYearMonth(),
                      schoolJa: "",
                      eventCode: "enrolled",
                    },
                  ]),
                )
              }
            >
              {labels.addRow}
            </button>
          </div>
        ) : educationRows.length === 0 ? (
          <p className="text-sm text-zinc-500">{labels.education.empty}</p>
        ) : (
          <TimelineTableWithHead
            head={
              <>
                <th className="py-2 pr-4 font-medium normal-case">
                  {labels.education.school}
                </th>
                <th className="py-2 pr-4 font-medium normal-case">
                  {labels.education.yearMonth}
                </th>
                <th className="py-2 font-medium normal-case">
                  {labels.education.event}
                </th>
              </>
            }
          >
            {educationRows.map((row) => {
              const { year, month } = yearMonthParts(row.yearMonth);
              return (
                <tr key={row.clientKey}>
                  <td className="py-2.5 pr-4">{row.schoolJa || "—"}</td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {formatYearMonthJa(year, month)}
                  </td>
                  <td className="py-2.5">
                    {labels.events.education[row.eventCode]}
                  </td>
                </tr>
              );
            })}
          </TimelineTableWithHead>
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
                <YearMonthField
                  name={`licenses.${index}.yearMonth`}
                  label={labels.licenses.yearMonth}
                  value={row.yearMonth}
                  onChange={(yearMonth) =>
                    setLicenseRows((rows) =>
                      sortByYearMonthInput(
                        rows.map((r) =>
                          r.clientKey === row.clientKey ? { ...r, yearMonth } : r,
                        ),
                      ),
                    )
                  }
                />
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
                setLicenseRows((rows) =>
                  sortByYearMonthInput([
                    ...rows,
                    {
                      clientKey: `new-${crypto.randomUUID()}`,
                      yearMonth: defaultYearMonth(12),
                      nameJa: "",
                    },
                  ]),
                )
              }
            >
              {labels.addRow}
            </button>
          </div>
        ) : licenseRows.length === 0 ? (
          <p className="text-sm text-zinc-500">{labels.licenses.empty}</p>
        ) : (
          <TimelineTableWithHead
            head={
              <>
                <th className="py-2 pr-4 font-medium normal-case">
                  {labels.licenses.name}
                </th>
                <th className="py-2 font-medium normal-case">
                  {labels.licenses.yearMonth}
                </th>
              </>
            }
          >
            {licenseRows.map((row) => {
              const { year, month } = yearMonthParts(row.yearMonth);
              return (
                <tr key={row.clientKey}>
                  <td className="py-2.5 pr-4">{row.nameJa || "—"}</td>
                  <td className="py-2.5 whitespace-nowrap">
                    {formatYearMonthJa(year, month)}
                  </td>
                </tr>
              );
            })}
          </TimelineTableWithHead>
        )}
      </section>
    </>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!editing ? (
          <button
            type="button"
            onClick={() => {
              setJustSaved(false);
              setEducationRows(withClientKeys(initial.education));
              setLicenseRows(withClientKeys(initial.licenses));
              setEditing(true);
            }}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
          >
            {labels.edit}
          </button>
        ) : null}
      </div>

      {(state.ok || justSaved) && !editing ? (
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

      {editing ? (
        <form action={formAction} className="space-y-8">
          {sections}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            {saveButton}
          </div>
        </form>
      ) : (
        <div className="space-y-8">{sections}</div>
      )}
    </div>
  );
}
