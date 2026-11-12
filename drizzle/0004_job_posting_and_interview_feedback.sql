CREATE TABLE "interview_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"interview_id" uuid NOT NULL,
	"source" text NOT NULL,
	"body" text,
	"rating" integer,
	"recorded_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_feedbacks_interview_uidx" UNIQUE("interview_id"),
	CONSTRAINT "interview_feedbacks_id_user_uidx" UNIQUE("id","user_id"),
	CONSTRAINT "interview_feedbacks_source_check" CHECK (source in ('company', 'recruiter', 'self')),
	CONSTRAINT "interview_feedbacks_rating_check" CHECK ("interview_feedbacks"."rating" is null or ("interview_feedbacks"."rating" >= 1 and "interview_feedbacks"."rating" <= 5)),
	CONSTRAINT "interview_feedbacks_body_or_rating_check" CHECK ("interview_feedbacks"."body" is not null or "interview_feedbacks"."rating" is not null)
);
--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "salary_band_text" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "benefits_text" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "jd_text" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "process_notes" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "job_notes" text;--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ADD CONSTRAINT "interview_feedbacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ADD CONSTRAINT "interview_feedbacks_interview_user_fk" FOREIGN KEY ("interview_id","user_id") REFERENCES "public"."interviews"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_feedbacks_user_idx" ON "interview_feedbacks" USING btree ("user_id");