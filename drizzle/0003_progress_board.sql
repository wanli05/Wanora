CREATE TABLE "application_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"application_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"custom_label" text,
	"position" integer NOT NULL,
	"status" text NOT NULL,
	"deadline_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_stages_id_user_uidx" UNIQUE("id","user_id"),
	CONSTRAINT "application_stages_app_position_uidx" UNIQUE("application_id","position"),
	CONSTRAINT "application_stages_kind_check" CHECK (kind in ('info_session', 'document_screening', 'aptitude_test', 'skill_test', 'interview_1', 'interview_2', 'interview_final', 'casual_meeting', 'custom', 'offer')),
	CONSTRAINT "application_stages_status_check" CHECK (status in ('pending', 'scheduled', 'passed', 'skipped', 'failed')),
	CONSTRAINT "application_stages_custom_label_check" CHECK ("application_stages"."kind" <> 'custom' or "application_stages"."custom_label" is not null)
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"platform_id" uuid NOT NULL,
	"recruiter_id" uuid,
	"job_title" text,
	"job_url" text,
	"salary_min" integer,
	"salary_max" integer,
	"location" text,
	"applied_on" date NOT NULL,
	"outcome" text DEFAULT 'in_progress' NOT NULL,
	"offer_decision" text,
	"next_prep_note" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "applications_id_user_uidx" UNIQUE("id","user_id"),
	CONSTRAINT "applications_outcome_check" CHECK (outcome in ('in_progress', 'rejected', 'withdrawn', 'offer')),
	CONSTRAINT "applications_offer_decision_check" CHECK ("applications"."offer_decision" is null or offer_decision in ('pending', 'accepted', 'declined')),
	CONSTRAINT "applications_offer_decision_outcome_check" CHECK ("applications"."offer_decision" is null or "applications"."outcome" = 'offer')
);
--> statement-breakpoint
CREATE TABLE "busy_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "busy_blocks_range_check" CHECK ("busy_blocks"."starts_at" < "busy_blocks"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_user_name_uidx" UNIQUE("user_id","name"),
	CONSTRAINT "companies_id_user_uidx" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"stage_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"mode" text NOT NULL,
	"meeting_url" text,
	"location_text" text,
	"interviewers" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"proposed_slot_id" uuid,
	"private_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interviews_id_user_uidx" UNIQUE("id","user_id"),
	CONSTRAINT "interviews_mode_check" CHECK (mode in ('google_meet', 'teams', 'other_online', 'onsite', 'phone')),
	CONSTRAINT "interviews_status_check" CHECK (status in ('scheduled', 'cancelled')),
	CONSTRAINT "interviews_range_check" CHECK ("interviews"."starts_at" < "interviews"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"code" text,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platforms_id_user_uidx" UNIQUE("id","user_id"),
	CONSTRAINT "platforms_preset_or_custom" CHECK (("platforms"."user_id" is null) = ("platforms"."code" is not null)),
	CONSTRAINT "platforms_code_check" CHECK ("platforms"."code" is null or code in ('mynavi_tenshoku', 'mynavi_shinsotsu', 'doda', 'en_tenshoku', 'linkedin', 'rikunabi', 'rikunabi_next', 'recruit_agent', 'bizreach', 'company_direct', 'referral', 'other'))
);
--> statement-breakpoint
CREATE TABLE "proposed_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"proposal_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposed_slots_id_user_uidx" UNIQUE("id","user_id"),
	CONSTRAINT "proposed_slots_status_check" CHECK (status in ('proposed', 'confirmed', 'released')),
	CONSTRAINT "proposed_slots_range_check" CHECK ("proposed_slots"."starts_at" < "proposed_slots"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "recruiters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"platform_id" uuid NOT NULL,
	"name" text NOT NULL,
	"agency" text,
	"email" text,
	"phone" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recruiters_id_user_uidx" UNIQUE("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "slot_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"stage_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"reply_deadline_at" timestamp with time zone,
	"default_mode" text DEFAULT 'google_meet' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slot_proposals_id_user_uidx" UNIQUE("id","user_id"),
	CONSTRAINT "slot_proposals_status_check" CHECK (status in ('draft', 'sent', 'confirmed', 'expired', 'cancelled')),
	CONSTRAINT "slot_proposals_mode_check" CHECK (default_mode in ('google_meet', 'teams', 'other_online', 'onsite', 'phone'))
);
--> statement-breakpoint
ALTER TABLE "application_stages" ADD CONSTRAINT "application_stages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_stages" ADD CONSTRAINT "application_stages_app_user_fk" FOREIGN KEY ("application_id","user_id") REFERENCES "public"."applications"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_company_user_fk" FOREIGN KEY ("company_id","user_id") REFERENCES "public"."companies"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_platform_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_recruiter_user_fk" FOREIGN KEY ("recruiter_id","user_id") REFERENCES "public"."recruiters"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "busy_blocks" ADD CONSTRAINT "busy_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_stage_user_fk" FOREIGN KEY ("stage_id","user_id") REFERENCES "public"."application_stages"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_slot_user_fk" FOREIGN KEY ("proposed_slot_id","user_id") REFERENCES "public"."proposed_slots"("id","user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_slots" ADD CONSTRAINT "proposed_slots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposed_slots" ADD CONSTRAINT "proposed_slots_proposal_user_fk" FOREIGN KEY ("proposal_id","user_id") REFERENCES "public"."slot_proposals"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiters" ADD CONSTRAINT "recruiters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recruiters" ADD CONSTRAINT "recruiters_platform_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_proposals" ADD CONSTRAINT "slot_proposals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_proposals" ADD CONSTRAINT "slot_proposals_stage_user_fk" FOREIGN KEY ("stage_id","user_id") REFERENCES "public"."application_stages"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_user_outcome_idx" ON "applications" USING btree ("user_id","outcome");--> statement-breakpoint
CREATE INDEX "busy_blocks_user_idx" ON "busy_blocks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "interviews_proposed_slot_uidx" ON "interviews" USING btree ("proposed_slot_id") WHERE "interviews"."proposed_slot_id" is not null;--> statement-breakpoint
CREATE INDEX "interviews_stage_idx" ON "interviews" USING btree ("stage_id");--> statement-breakpoint
CREATE INDEX "interviews_user_status_idx" ON "interviews" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "platforms_preset_code_uidx" ON "platforms" USING btree ("code") WHERE "platforms"."user_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "platforms_user_name_uidx" ON "platforms" USING btree ("user_id","name") WHERE "platforms"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "proposed_slots_one_confirmed_uidx" ON "proposed_slots" USING btree ("proposal_id") WHERE "proposed_slots"."status" = 'confirmed';--> statement-breakpoint
CREATE INDEX "proposed_slots_proposal_idx" ON "proposed_slots" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "recruiters_user_active_idx" ON "recruiters" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "slot_proposals_one_open_uidx" ON "slot_proposals" USING btree ("stage_id") WHERE "slot_proposals"."status" in ('draft', 'sent');--> statement-breakpoint
CREATE INDEX "slot_proposals_user_status_idx" ON "slot_proposals" USING btree ("user_id","status");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_no_overlap" EXCLUDE USING gist ("user_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&) WHERE ("status" = 'scheduled');--> statement-breakpoint
CREATE INDEX "proposed_slots_occupancy_gix" ON "proposed_slots" USING gist ("user_id", tstzrange("starts_at", "ends_at", '[)')) WHERE "status" = 'proposed';--> statement-breakpoint
INSERT INTO "platforms" ("code") VALUES
  ('mynavi_tenshoku'),
  ('mynavi_shinsotsu'),
  ('doda'),
  ('en_tenshoku'),
  ('linkedin'),
  ('rikunabi'),
  ('rikunabi_next'),
  ('recruit_agent'),
  ('bizreach'),
  ('company_direct'),
  ('referral'),
  ('other');