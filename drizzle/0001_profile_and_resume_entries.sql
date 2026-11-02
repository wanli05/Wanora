CREATE TABLE "education_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"year_month" date NOT NULL,
	"school" jsonb NOT NULL,
	"event_code" text NOT NULL,
	"note" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "education_entries_event_code_check" CHECK (event_code in ('enrolled', 'graduated', 'withdrawn', 'completed')),
	CONSTRAINT "education_entries_school_json_check" CHECK (jsonb_typeof("education_entries"."school") = 'object'),
	CONSTRAINT "education_entries_note_json_check" CHECK ("education_entries"."note" is null or jsonb_typeof("education_entries"."note") = 'object'),
	CONSTRAINT "education_entries_year_month_day_check" CHECK (extract(day from "education_entries"."year_month") = 1)
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" jsonb NOT NULL,
	"acquired_ym" date NOT NULL,
	"status" text NOT NULL,
	"score" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "licenses_status_check" CHECK (status in ('acquired', 'expected')),
	CONSTRAINT "licenses_name_json_check" CHECK (jsonb_typeof("licenses"."name") = 'object'),
	CONSTRAINT "licenses_acquired_ym_day_check" CHECK (extract(day from "licenses"."acquired_ym") = 1)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"full_name" jsonb NOT NULL,
	"full_name_kana" text,
	"birth_date" date,
	"gender" jsonb,
	"postal_code" text,
	"address" jsonb,
	"address_kana" text,
	"phone" text,
	"email" text,
	"alt_contact" jsonb,
	"photo_key" text,
	"date_format" text DEFAULT 'wareki' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_date_format_check" CHECK (date_format in ('wareki', 'seireki')),
	CONSTRAINT "profiles_full_name_json_check" CHECK (jsonb_typeof("profiles"."full_name") = 'object'),
	CONSTRAINT "profiles_gender_json_check" CHECK ("profiles"."gender" is null or jsonb_typeof("profiles"."gender") = 'object'),
	CONSTRAINT "profiles_address_json_check" CHECK ("profiles"."address" is null or jsonb_typeof("profiles"."address") = 'object'),
	CONSTRAINT "profiles_alt_contact_json_check" CHECK ("profiles"."alt_contact" is null or jsonb_typeof("profiles"."alt_contact") = 'object')
);
--> statement-breakpoint
CREATE TABLE "work_history_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"year_month" date NOT NULL,
	"company" jsonb NOT NULL,
	"event_code" text NOT NULL,
	"note" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_history_entries_event_code_check" CHECK (event_code in ('joined', 'left', 'transferred')),
	CONSTRAINT "work_history_entries_company_json_check" CHECK (jsonb_typeof("work_history_entries"."company") = 'object'),
	CONSTRAINT "work_history_entries_note_json_check" CHECK ("work_history_entries"."note" is null or jsonb_typeof("work_history_entries"."note") = 'object'),
	CONSTRAINT "work_history_entries_year_month_day_check" CHECK (extract(day from "work_history_entries"."year_month") = 1)
);
--> statement-breakpoint
ALTER TABLE "education_entries" ADD CONSTRAINT "education_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_history_entries" ADD CONSTRAINT "work_history_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "education_entries_user_timeline_idx" ON "education_entries" USING btree ("user_id","year_month","sort_order");--> statement-breakpoint
CREATE INDEX "licenses_user_acquired_idx" ON "licenses" USING btree ("user_id","acquired_ym");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_id_unique" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "work_history_entries_user_timeline_idx" ON "work_history_entries" USING btree ("user_id","year_month","sort_order");