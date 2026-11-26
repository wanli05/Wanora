CREATE TABLE "support_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"acceptance_number" text NOT NULL,
	"client_submission_id" text NOT NULL,
	"category" text NOT NULL,
	"message" text NOT NULL,
	"reply_email" text,
	"user_id" text,
	"diagnostic" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notify_status" text DEFAULT 'pending' NOT NULL,
	"notify_attempts" integer DEFAULT 0 NOT NULL,
	"notify_last_error" text,
	"notify_sent_at" timestamp with time zone,
	"rate_limit_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_reports_acceptance_number_uidx" UNIQUE("acceptance_number"),
	CONSTRAINT "support_reports_client_submission_uidx" UNIQUE("client_submission_id"),
	CONSTRAINT "support_reports_category_check" CHECK (category in ('bug_report', 'other_inquiry')),
	CONSTRAINT "support_reports_notify_status_check" CHECK (notify_status in ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "support_reports" ADD CONSTRAINT "support_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "support_reports_created_idx" ON "support_reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "support_reports_notify_status_idx" ON "support_reports" USING btree ("notify_status","created_at");--> statement-breakpoint
CREATE INDEX "support_reports_rate_limit_created_idx" ON "support_reports" USING btree ("rate_limit_key","created_at");--> statement-breakpoint
CREATE INDEX "support_reports_user_created_idx" ON "support_reports" USING btree ("user_id","created_at");