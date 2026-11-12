import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  EDUCATION_EVENT_CODES,
  WORK_HISTORY_EVENT_CODES,
} from "@/lib/domain/resume-events";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/locale";
import {
  FEEDBACK_SOURCES,
  INTERVIEW_MODES,
  INTERVIEW_STATUSES,
  OFFER_DECISIONS,
  OUTCOMES,
  PRESET_PLATFORM_CODES,
  PROPOSAL_STATUSES,
  SLOT_STATUSES,
  STAGE_KINDS,
  STAGE_STATUSES,
} from "@/lib/progress/enums";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

function inList(column: string, values: readonly string[]) {
  return sql.raw(`${column} in (${values.map((value) => `'${value}'`).join(", ")})`);
}

const jsonObjectCheck = (column: AnyPgColumn) =>
  sql`jsonb_typeof(${column}) = 'object'`;

const yearMonthDayOneCheck = (column: AnyPgColumn) =>
  sql`extract(day from ${column}) = 1`;

function inListCheck(columnName: string, values: readonly string[]) {
  return sql.raw(
    `${columnName} in (${values.map((v) => `'${v}'`).join(", ")})`,
  );
}

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
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check("licenses_name_json_check", jsonObjectCheck(t.name)),
    check("licenses_acquired_ym_day_check", yearMonthDayOneCheck(t.acquiredYm)),
    index("licenses_user_acquired_idx").on(t.userId, t.acquiredYm),
  ],
);

const userId = () =>
  text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const platforms = pgTable(
  "platforms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    code: text("code"),
    name: text("name"),
    ...timestamps,
  },
  (t) => [
    check(
      "platforms_preset_or_custom",
      sql`(${t.userId} is null) = (${t.code} is not null)`,
    ),
    check(
      "platforms_code_check",
      sql`${t.code} is null or ${inList("code", PRESET_PLATFORM_CODES)}`,
    ),
    uniqueIndex("platforms_preset_code_uidx")
      .on(t.code)
      .where(sql`${t.userId} is null`),
    uniqueIndex("platforms_user_name_uidx")
      .on(t.userId, t.name)
      .where(sql`${t.userId} is not null`),
    unique("platforms_id_user_uidx").on(t.id, t.userId),
  ],
);

export const recruiters = pgTable(
  "recruiters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    platformId: uuid("platform_id").notNull(),
    name: text("name").notNull(),
    agency: text("agency"),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    unique("recruiters_id_user_uidx").on(t.id, t.userId),
    index("recruiters_user_active_idx").on(t.userId, t.isActive),
    foreignKey({
      columns: [t.platformId],
      foreignColumns: [platforms.id],
      name: "recruiters_platform_id_fk",
    }).onDelete("restrict"),
  ],
);

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    name: text("name").notNull(),
    url: text("url"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    unique("companies_user_name_uidx").on(t.userId, t.name),
    unique("companies_id_user_uidx").on(t.id, t.userId),
  ],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    companyId: uuid("company_id").notNull(),
    platformId: uuid("platform_id").notNull(),
    recruiterId: uuid("recruiter_id"),
    jobTitle: text("job_title"),
    jobUrl: text("job_url"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryBandText: text("salary_band_text"),
    benefitsText: text("benefits_text"),
    jdText: text("jd_text"),
    processNotes: text("process_notes"),
    location: text("location"),
    jobNotes: text("job_notes"),
    appliedOn: date("applied_on").notNull(),
    outcome: text("outcome").notNull().default("in_progress"),
    offerDecision: text("offer_decision"),
    nextPrepNote: text("next_prep_note"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    check("applications_outcome_check", inList("outcome", OUTCOMES)),
    check(
      "applications_offer_decision_check",
      sql`${t.offerDecision} is null or ${inList("offer_decision", OFFER_DECISIONS)}`,
    ),
    check(
      "applications_offer_decision_outcome_check",
      sql`${t.offerDecision} is null or ${t.outcome} = 'offer'`,
    ),
    unique("applications_id_user_uidx").on(t.id, t.userId),
    index("applications_user_outcome_idx").on(t.userId, t.outcome),
    foreignKey({
      columns: [t.companyId, t.userId],
      foreignColumns: [companies.id, companies.userId],
      name: "applications_company_user_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.platformId],
      foreignColumns: [platforms.id],
      name: "applications_platform_id_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [t.recruiterId, t.userId],
      foreignColumns: [recruiters.id, recruiters.userId],
      name: "applications_recruiter_user_fk",
    }).onDelete("set null"),
  ],
);

export const applicationStages = pgTable(
  "application_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    applicationId: uuid("application_id").notNull(),
    kind: text("kind").notNull(),
    customLabel: text("custom_label"),
    position: integer("position").notNull(),
    status: text("status").notNull(),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    check("application_stages_kind_check", inList("kind", STAGE_KINDS)),
    check("application_stages_status_check", inList("status", STAGE_STATUSES)),
    check(
      "application_stages_custom_label_check",
      sql`${t.kind} <> 'custom' or ${t.customLabel} is not null`,
    ),
    unique("application_stages_id_user_uidx").on(t.id, t.userId),
    unique("application_stages_app_position_uidx").on(t.applicationId, t.position),
    foreignKey({
      columns: [t.applicationId, t.userId],
      foreignColumns: [applications.id, applications.userId],
      name: "application_stages_app_user_fk",
    }).onDelete("cascade"),
  ],
);

export const slotProposals = pgTable(
  "slot_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    stageId: uuid("stage_id").notNull(),
    status: text("status").notNull().default("draft"),
    replyDeadlineAt: timestamp("reply_deadline_at", { withTimezone: true }),
    defaultMode: text("default_mode").notNull().default("google_meet"),
    ...timestamps,
  },
  (t) => [
    check("slot_proposals_status_check", inList("status", PROPOSAL_STATUSES)),
    check(
      "slot_proposals_mode_check",
      inList("default_mode", INTERVIEW_MODES),
    ),
    unique("slot_proposals_id_user_uidx").on(t.id, t.userId),
    uniqueIndex("slot_proposals_one_open_uidx")
      .on(t.stageId)
      .where(sql`${t.status} in ('draft', 'sent')`),
    index("slot_proposals_user_status_idx").on(t.userId, t.status),
    foreignKey({
      columns: [t.stageId, t.userId],
      foreignColumns: [applicationStages.id, applicationStages.userId],
      name: "slot_proposals_stage_user_fk",
    }).onDelete("cascade"),
  ],
);

export const proposedSlots = pgTable(
  "proposed_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    proposalId: uuid("proposal_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("proposed"),
    ...timestamps,
  },
  (t) => [
    check("proposed_slots_status_check", inList("status", SLOT_STATUSES)),
    check("proposed_slots_range_check", sql`${t.startsAt} < ${t.endsAt}`),
    unique("proposed_slots_id_user_uidx").on(t.id, t.userId),
    uniqueIndex("proposed_slots_one_confirmed_uidx")
      .on(t.proposalId)
      .where(sql`${t.status} = 'confirmed'`),
    index("proposed_slots_proposal_idx").on(t.proposalId),
    foreignKey({
      columns: [t.proposalId, t.userId],
      foreignColumns: [slotProposals.id, slotProposals.userId],
      name: "proposed_slots_proposal_user_fk",
    }).onDelete("cascade"),
  ],
);

export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    stageId: uuid("stage_id").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    mode: text("mode").notNull(),
    meetingUrl: text("meeting_url"),
    locationText: text("location_text"),
    interviewers: text("interviewers"),
    status: text("status").notNull().default("scheduled"),
    proposedSlotId: uuid("proposed_slot_id"),
    privateNotes: text("private_notes"),
    ...timestamps,
  },
  (t) => [
    check("interviews_mode_check", inList("mode", INTERVIEW_MODES)),
    check("interviews_status_check", inList("status", INTERVIEW_STATUSES)),
    check("interviews_range_check", sql`${t.startsAt} < ${t.endsAt}`),
    unique("interviews_id_user_uidx").on(t.id, t.userId),
    uniqueIndex("interviews_proposed_slot_uidx")
      .on(t.proposedSlotId)
      .where(sql`${t.proposedSlotId} is not null`),
    index("interviews_stage_idx").on(t.stageId),
    index("interviews_user_status_idx").on(t.userId, t.status),
    foreignKey({
      columns: [t.stageId, t.userId],
      foreignColumns: [applicationStages.id, applicationStages.userId],
      name: "interviews_stage_user_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.proposedSlotId, t.userId],
      foreignColumns: [proposedSlots.id, proposedSlots.userId],
      name: "interviews_slot_user_fk",
    }).onDelete("set null"),
  ],
);

export const busyBlocks = pgTable(
  "busy_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    label: text("label"),
    ...timestamps,
  },
  (t) => [
    check("busy_blocks_range_check", sql`${t.startsAt} < ${t.endsAt}`),
    index("busy_blocks_user_idx").on(t.userId),
  ],
);

export const interviewFeedbacks = pgTable(
  "interview_feedbacks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: userId(),
    interviewId: uuid("interview_id").notNull(),
    source: text("source").notNull(),
    body: text("body").notNull(),
    recordedOn: date("recorded_on").notNull(),
    ...timestamps,
  },
  (t) => [
    check("interview_feedbacks_source_check", inList("source", FEEDBACK_SOURCES)),
    check(
      "interview_feedbacks_body_not_empty_check",
      sql`length(btrim(${t.body})) > 0`,
    ),
    unique("interview_feedbacks_id_user_uidx").on(t.id, t.userId),
    index("interview_feedbacks_user_idx").on(t.userId),
    index("interview_feedbacks_interview_idx").on(t.interviewId),
    foreignKey({
      columns: [t.interviewId, t.userId],
      foreignColumns: [interviews.id, interviews.userId],
      name: "interview_feedbacks_interview_user_fk",
    }).onDelete("cascade"),
  ],
);
