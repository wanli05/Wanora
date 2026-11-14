CREATE TABLE "career_employers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_name" jsonb NOT NULL,
	"title" text,
	"start_ym" date NOT NULL,
	"end_ym" date,
	"capital_text" text,
	"revenue_text" text,
	"employees_text" text,
	"narrative" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_employers_company_name_json_check" CHECK (jsonb_typeof("career_employers"."company_name") = 'object'),
	CONSTRAINT "career_employers_narrative_json_check" CHECK ("career_employers"."narrative" is null or jsonb_typeof("career_employers"."narrative") = 'object'),
	CONSTRAINT "career_employers_start_ym_day_check" CHECK (extract(day from "career_employers"."start_ym") = 1),
	CONSTRAINT "career_employers_end_ym_day_check" CHECK ("career_employers"."end_ym" is null or extract(day from "career_employers"."end_ym") = 1)
);
--> statement-breakpoint
CREATE TABLE "career_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"content" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_goals_kind_check" CHECK (kind in ('short', 'long')),
	CONSTRAINT "career_goals_content_json_check" CHECK (jsonb_typeof("career_goals"."content") = 'object')
);
--> statement-breakpoint
CREATE TABLE "career_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" jsonb NOT NULL,
	"title_url" text,
	"start_ym" date NOT NULL,
	"end_ym" date,
	"overview" jsonb,
	"phases" jsonb,
	"responsibilities" jsonb,
	"results" jsonb,
	"environment" text,
	"role_text" text,
	"scale_text" text,
	"team_size_text" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_projects_status_check" CHECK (status in ('confirmed', 'pending_confirm')),
	CONSTRAINT "career_projects_title_json_check" CHECK (jsonb_typeof("career_projects"."title") = 'object'),
	CONSTRAINT "career_projects_overview_json_check" CHECK ("career_projects"."overview" is null or jsonb_typeof("career_projects"."overview") = 'object'),
	CONSTRAINT "career_projects_phases_json_check" CHECK ("career_projects"."phases" is null or jsonb_typeof("career_projects"."phases") = 'object'),
	CONSTRAINT "career_projects_responsibilities_json_check" CHECK ("career_projects"."responsibilities" is null or jsonb_typeof("career_projects"."responsibilities") = 'object'),
	CONSTRAINT "career_projects_results_json_check" CHECK ("career_projects"."results" is null or jsonb_typeof("career_projects"."results") = 'object'),
	CONSTRAINT "career_projects_start_ym_day_check" CHECK (extract(day from "career_projects"."start_ym") = 1),
	CONSTRAINT "career_projects_end_ym_day_check" CHECK ("career_projects"."end_ym" is null or extract(day from "career_projects"."end_ym") = 1)
);
--> statement-breakpoint
CREATE TABLE "career_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"years_text" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "direction_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "self_pr" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "job_summary" jsonb;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "strengths" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "languages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "residence_status" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "residence_period" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "residence_until" date;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "salary_annual_man" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "salary_bonus_man" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "salary_monthly_man" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "salary_overtime_man" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "salary_hope" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "personal_hope" jsonb;--> statement-breakpoint
ALTER TABLE "career_employers" ADD CONSTRAINT "career_employers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_goals" ADD CONSTRAINT "career_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_projects" ADD CONSTRAINT "career_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_skills" ADD CONSTRAINT "career_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_employers_user_idx" ON "career_employers" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "career_goals_user_idx" ON "career_goals" USING btree ("user_id","kind","sort_order");--> statement-breakpoint
CREATE INDEX "career_projects_user_idx" ON "career_projects" USING btree ("user_id","status","sort_order");--> statement-breakpoint
CREATE INDEX "career_skills_user_idx" ON "career_skills" USING btree ("user_id","sort_order");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_self_pr_json_check" CHECK ("profiles"."self_pr" is null or jsonb_typeof("profiles"."self_pr") = 'object');--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_job_summary_json_check" CHECK ("profiles"."job_summary" is null or jsonb_typeof("profiles"."job_summary") = 'object');--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_personal_hope_json_check" CHECK ("profiles"."personal_hope" is null or jsonb_typeof("profiles"."personal_hope") = 'object');--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_direction_tags_array_check" CHECK (jsonb_typeof("profiles"."direction_tags") = 'array');--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_strengths_array_check" CHECK (jsonb_typeof("profiles"."strengths") = 'array');--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_languages_array_check" CHECK (jsonb_typeof("profiles"."languages") = 'array');