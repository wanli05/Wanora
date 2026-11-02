import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { JapaneseTextField } from "@/components/japanese-text-field";
import { PhotoUpload } from "@/components/photo-upload";
import { ProfileBasicForm } from "@/components/profile-basic-form";
import { fullYearsOld } from "@/lib/domain/dates";
import type { LocalizedText } from "@/lib/domain/localized-text";
import { getDb } from "@/db";
import { getProfileByUserId } from "@/lib/data/profiles";
import { isObjectStorageConfigured } from "@/lib/env";
import { requireProfileAccess } from "@/lib/profile-actions";
import { formatDateInputValue } from "./form-fields";

export default async function ProfilePage() {
  await connection();
  const userId = await requireProfileAccess();
  const profile = await getProfileByUserId(getDb(), userId);
  const t = await getTranslations("Profile.basic");
  const tField = await getTranslations("Profile.japaneseField");
  const tSave = await getTranslations("Profile.saveFeedback");
  const storageReady = isObjectStorageConfigured();
  const fullName = (profile?.fullName ?? {}) as LocalizedText;
  const age =
    profile?.birthDate != null ? fullYearsOld(profile.birthDate) : null;

  const errorMessages = {
    unauthenticated: tSave("unauthenticated"),
    fullNameRequired: tSave("fullNameRequired"),
    invalidEmail: tSave("invalidEmail"),
    invalidDateFormat: tSave("invalidDateFormat"),
    saveFailed: tSave("saveFailed"),
  };

  return (
    <ProfileBasicForm
      saveLabel={t("save")}
      savedMessage={tSave("saved")}
      errorMessages={errorMessages}
    >
      <JapaneseTextField
        fieldPrefix="fullName"
        label={t("fullName")}
        value={fullName}
        required
        hint={tField("hint")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("fullNameKana")}</span>
          <input
            name="fullNameKana"
            defaultValue={profile?.fullNameKana ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("birthDate")}</span>
          <input
            type="date"
            name="birthDate"
            defaultValue={
              profile?.birthDate
                ? formatDateInputValue(profile.birthDate)
                : ""
            }
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          {age != null ? (
            <span className="text-xs text-zinc-500">{t("age", { age })}</span>
          ) : null}
        </label>
      </div>
      <JapaneseTextField
        fieldPrefix="gender"
        label={t("gender")}
        value={(profile?.gender ?? {}) as LocalizedText}
        hint={tField("hint")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("postalCode")}</span>
          <input
            name="postalCode"
            defaultValue={profile?.postalCode ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("dateFormat")}</span>
          <select
            name="dateFormat"
            defaultValue={profile?.dateFormat ?? "wareki"}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="wareki">{t("dateFormatWareki")}</option>
            <option value="seireki">{t("dateFormatSeireki")}</option>
          </select>
        </label>
      </div>
      <JapaneseTextField
        fieldPrefix="address"
        label={t("address")}
        value={(profile?.address ?? {}) as LocalizedText}
        hint={tField("hint")}
      />
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{t("addressKana")}</span>
        <input
          name="addressKana"
          defaultValue={profile?.addressKana ?? ""}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("phone")}</span>
          <input
            name="phone"
            defaultValue={profile?.phone ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">{t("email")}</span>
          <input
            name="email"
            type="text"
            inputMode="email"
            autoComplete="email"
            defaultValue={profile?.email ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>
      <JapaneseTextField
        fieldPrefix="altContact"
        label={t("altContact")}
        value={(profile?.altContact ?? {}) as LocalizedText}
        multiline
        hint={tField("hint")}
      />
      <PhotoUpload disabled={!storageReady} />
    </ProfileBasicForm>
  );
}
