import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  EDUCATION_EVENT_CODES,
  LICENSE_STATUSES,
  WORK_HISTORY_EVENT_CODES,
} from "@/lib/domain/resume-events";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/locale";

// Better Auth core tables. Property names are what Better Auth reads/writes;
// column names are snake_case. Extra user fields must also be declared in
// `user.additionalFields` in src/lib/auth.ts.

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    uiLocale: text("ui_locale").notNull().default(DEFAULT_LOCALE),
    ...timestamps,
  },
  (t) => [
    check(
      "users_ui_locale_check",
      sql.raw(
        `${t.uiLocale.name} in (${LOCALES.map((l) => `'${l}'`).join(", ")})`,
      ),
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

const jsonObjectCheck = (column: AnyPgColumn) =>
  sql`jsonb_typeof(${column}) = 'object'`;

const yearMonthDayOneCheck = (column: AnyPgColumn) =>
  sql`extract(day from ${column}) = 1`;

function inListCheck(columnName: string, values: readonly string[]) {
  return sql.raw(
    `${columnName} in (${values.map((v) => `'${v}'`).join(", ")})`,
  );
}

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: jsonb("full_name").notNull(),
    fullNameKana: text("full_name_kana"),
    birthDate: date("birth_date", { mode: "date" }),
    gender: jsonb("gender"),
    postalCode: text("postal_code"),
    address: jsonb("address"),
    addressKana: text("address_kana"),
    phone: text("phone"),
    email: text("email"),
    altContact: jsonb("alt_contact"),
    photoKey: text("photo_key"),
    dateFormat: text("date_format").notNull().default("wareki"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("profiles_user_id_unique").on(t.userId),
    check("profiles_date_format_check", inListCheck(t.dateFormat.name, ["wareki", "seireki"])),
    check("profiles_full_name_json_check", jsonObjectCheck(t.fullName)),
    check(
      "profiles_gender_json_check",
      sql`${t.gender} is null or ${jsonObjectCheck(t.gender)}`,
    ),
    check(
      "profiles_address_json_check",
      sql`${t.address} is null or ${jsonObjectCheck(t.address)}`,
    ),
    check(
      "profiles_alt_contact_json_check",
      sql`${t.altContact} is null or ${jsonObjectCheck(t.altContact)}`,
    ),
  ],
);

export const educationEntries = pgTable(
  "education_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    yearMonth: date("year_month", { mode: "date" }).notNull(),
    school: jsonb("school").notNull(),
    eventCode: text("event_code").notNull(),
    note: jsonb("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check(
      "education_entries_event_code_check",
      inListCheck(t.eventCode.name, EDUCATION_EVENT_CODES),
    ),
    check("education_entries_school_json_check", jsonObjectCheck(t.school)),
    check(
      "education_entries_note_json_check",
      sql`${t.note} is null or ${jsonObjectCheck(t.note)}`,
    ),
    check("education_entries_year_month_day_check", yearMonthDayOneCheck(t.yearMonth)),
    index("education_entries_user_timeline_idx").on(
      t.userId,
      t.yearMonth,
      t.sortOrder,
    ),
  ],
);

export const workHistoryEntries = pgTable(
  "work_history_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    yearMonth: date("year_month", { mode: "date" }).notNull(),
    company: jsonb("company").notNull(),
    eventCode: text("event_code").notNull(),
    note: jsonb("note"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check(
      "work_history_entries_event_code_check",
      inListCheck(t.eventCode.name, WORK_HISTORY_EVENT_CODES),
    ),
    check("work_history_entries_company_json_check", jsonObjectCheck(t.company)),
    check(
      "work_history_entries_note_json_check",
      sql`${t.note} is null or ${jsonObjectCheck(t.note)}`,
    ),
    check(
      "work_history_entries_year_month_day_check",
      yearMonthDayOneCheck(t.yearMonth),
    ),
    index("work_history_entries_user_timeline_idx").on(
      t.userId,
      t.yearMonth,
      t.sortOrder,
    ),
  ],
);

export const licenses = pgTable(
  "licenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: jsonb("name").notNull(),
    acquiredYm: date("acquired_ym", { mode: "date" }).notNull(),
    status: text("status").notNull(),
    score: text("score"),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check(
      "licenses_status_check",
      inListCheck(t.status.name, LICENSE_STATUSES),
    ),
    check("licenses_name_json_check", jsonObjectCheck(t.name)),
    check("licenses_acquired_ym_day_check", yearMonthDayOneCheck(t.acquiredYm)),
    index("licenses_user_acquired_idx").on(t.userId, t.acquiredYm),
  ],
);
