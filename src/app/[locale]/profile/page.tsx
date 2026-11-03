import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  ProfilePageForm,
  type ProfilePageFormLabels,
  type ProfilePageInitial,
} from "@/components/profile-page-form";
import { fullYearsOld } from "@/lib/domain/dates";
import { localizedJa } from "@/lib/domain/profile-display";
import type { LocalizedText } from "@/lib/domain/localized-text";
import type { EducationEventCode } from "@/lib/domain/resume-events";
import type { WorkHistoryEventCode } from "@/lib/domain/resume-events";
import { formatYearMonthInputValue } from "@/lib/domain/dates";
import { getDb } from "@/db";
import { listEducationEntries } from "@/lib/data/education-entries";
import { listLicenses } from "@/lib/data/licenses";
import { getProfileByUserId } from "@/lib/data/profiles";
import { listWorkHistoryEntries } from "@/lib/data/work-history-entries";
import { isObjectStorageConfigured } from "@/lib/env";
import { requireProfileAccess } from "@/lib/profile-actions";
import { formatYearMonthDate, formatDateInputValue } from "./form-fields";

export default async function ProfilePage() {
  await connection();
  const userId = await requireProfileAccess();
  const db = getDb();
  const profile = await getProfileByUserId(db, userId);
  const educationEntries = await listEducationEntries(db, userId);
  const workEntries = await listWorkHistoryEntries(db, userId);
  const licenseEntries = await listLicenses(db, userId);

  const tPage = await getTranslations("Profile.page");
  const tBasic = await getTranslations("Profile.basic");
  const tField = await getTranslations("Profile.japaneseField");
  const tSave = await getTranslations("Profile.saveFeedback");
  const tEducation = await getTranslations("Profile.education");
  const tWork = await getTranslations("Profile.workHistory");
  const tLicenses = await getTranslations("Profile.licenses");
  const te = await getTranslations("Profile.events.education");
  const tw = await getTranslations("Profile.events.workHistory");

  const age =
    profile?.birthDate != null ? fullYearsOld(profile.birthDate) : null;

  const initial: ProfilePageInitial = {
    fullName: (profile?.fullName ?? {}) as LocalizedText,
    fullNameKana: profile?.fullNameKana ?? "",
    birthDate: profile?.birthDate
      ? formatDateInputValue(profile.birthDate)
      : "",
    age,
    gender: (profile?.gender ?? {}) as LocalizedText,
    postalCode: profile?.postalCode ?? "",
    dateFormat: (profile?.dateFormat ?? "wareki") as "wareki" | "seireki",
    address: (profile?.address ?? {}) as LocalizedText,
    addressKana: profile?.addressKana ?? "",
    phone: profile?.phone ?? "",
    email: profile?.email ?? "",
    altContact: (profile?.altContact ?? {}) as LocalizedText,
    education: educationEntries.map((entry) => {
      const ym = formatYearMonthDate(entry.yearMonth);
      return {
        id: entry.id,
        yearMonth: formatYearMonthInputValue(ym.year, ym.month),
        schoolJa: localizedJa(entry.school as LocalizedText),
        eventCode: entry.eventCode as EducationEventCode,
      };
    }),
    workHistory: workEntries.map((entry) => {
      const ym = formatYearMonthDate(entry.yearMonth);
      return {
        id: entry.id,
        yearMonth: formatYearMonthInputValue(ym.year, ym.month),
        workContentJa: localizedJa(entry.company as LocalizedText),
        eventCode: entry.eventCode as WorkHistoryEventCode,
      };
    }),
    licenses: licenseEntries.map((entry) => {
      const ym = formatYearMonthDate(entry.acquiredYm);
      return {
        id: entry.id,
        yearMonth: formatYearMonthInputValue(ym.year, ym.month),
        nameJa: localizedJa(entry.name as LocalizedText),
      };
    }),
    storageReady: isObjectStorageConfigured(),
  };

  const labels: ProfilePageFormLabels = {
    edit: tPage("edit"),
    save: tPage("save"),
    addRow: tPage("addRow"),
    removeRow: tPage("removeRow"),
    savedMessage: tSave("savedAll"),
    errorMessages: {
      unauthenticated: tSave("unauthenticated"),
      fullNameRequired: tSave("fullNameRequired"),
      invalidEmail: tSave("invalidEmail"),
      invalidDateFormat: tSave("invalidDateFormat"),
      saveFailed: tSave("saveFailed"),
    },
    sections: {
      basic: tPage("sections.basic"),
      education: tPage("sections.education"),
      workHistory: tPage("sections.workHistory"),
      licenses: tPage("sections.licenses"),
    },
    basic: {
      fullName: tBasic("fullName"),
      fullNameKana: tBasic("fullNameKana"),
      birthDate: tBasic("birthDate"),
      ageSuffix: age != null ? tBasic("age", { age }) : "",
      gender: tBasic("gender"),
      postalCode: tBasic("postalCode"),
      dateFormat: tBasic("dateFormat"),
      dateFormatWareki: tBasic("dateFormatWareki"),
      dateFormatSeireki: tBasic("dateFormatSeireki"),
      address: tBasic("address"),
      addressKana: tBasic("addressKana"),
      phone: tBasic("phone"),
      email: tBasic("email"),
      altContact: tBasic("altContact"),
    },
    japaneseHint: tField("hint"),
    education: {
      empty: tEducation("empty"),
      school: tEducation("school"),
      event: tEducation("event"),
      yearMonth: tEducation("yearMonth"),
    },
    workHistory: {
      empty: tWork("empty"),
      workContent: tWork("workContent"),
      event: tWork("event"),
      yearMonth: tWork("yearMonth"),
    },
    licenses: {
      empty: tLicenses("empty"),
      name: tLicenses("name"),
      yearMonth: tLicenses("yearMonth"),
    },
    events: {
      education: {
        enrolled: te("enrolled"),
        graduated: te("graduated"),
        withdrawn: te("withdrawn"),
        completed: te("completed"),
      },
      workHistory: {
        joined: tw("joined"),
        left: tw("left"),
        transferred: tw("transferred"),
      },
    },
  };

  return <ProfilePageForm initial={initial} labels={labels} />;
}
