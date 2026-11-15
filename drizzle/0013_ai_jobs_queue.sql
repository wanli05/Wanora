-- A5.5: ai_jobs queue + fencing foundation.
-- Additive only: does not alter 0011/0012 AI table semantics
-- (including ON DELETE SET NULL (conversation_id) on usage).
--
-- Prerequisite uniques for composite FKs (message↔conversation+user, usage id+user).
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_id_conversation_user_uidx" UNIQUE("id","conversation_id","user_id");
--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_id_user_uidx" UNIQUE("id","user_id");
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_message_id" uuid,
	"result_message_id" uuid,
	"usage_event_id" uuid,
	"client_request_id" text NOT NULL,
	"feature" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"locked_by" text,
	"lease_expires_at" timestamp with time zone,
	"fencing_token" bigint DEFAULT 0 NOT NULL,
	"execution_phase" text DEFAULT 'queued' NOT NULL,
	"cancel_requested_at" timestamp with time zone,
	"provider_outcome" text DEFAULT 'not_started' NOT NULL,
	"error_code" text,
	"error_message" text,
	"page_context" jsonb,
	"target_context" jsonb,
	"result_payload" jsonb,
	"provider" text,
	"model" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_jobs_user_client_request_uidx" UNIQUE("user_id","client_request_id"),
	CONSTRAINT "ai_jobs_status_check" CHECK (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
	CONSTRAINT "ai_jobs_execution_phase_check" CHECK (execution_phase in ('queued', 'before_provider', 'calling_provider', 'after_provider')),
	CONSTRAINT "ai_jobs_provider_outcome_check" CHECK (provider_outcome in ('not_started', 'succeeded', 'failed', 'uncertain')),
	CONSTRAINT "ai_jobs_attempt_nonneg_check" CHECK ("ai_jobs"."attempt" >= 0 and "ai_jobs"."max_attempts" >= 1),
	CONSTRAINT "ai_jobs_fencing_nonneg_check" CHECK ("ai_jobs"."fencing_token" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_conversation_user_fk" FOREIGN KEY ("conversation_id","user_id") REFERENCES "public"."ai_conversations"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_user_message_conversation_user_fk" FOREIGN KEY ("user_message_id","conversation_id","user_id") REFERENCES "public"."ai_messages"("id","conversation_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_result_message_conversation_user_fk" FOREIGN KEY ("result_message_id","conversation_id","user_id") REFERENCES "public"."ai_messages"("id","conversation_id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_usage_event_user_fk" FOREIGN KEY ("usage_event_id","user_id") REFERENCES "public"."ai_usage_events"("id","user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_jobs_status_created_idx" ON "ai_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ai_jobs_status_lease_idx" ON "ai_jobs" USING btree ("status","lease_expires_at");--> statement-breakpoint
CREATE INDEX "ai_jobs_user_created_idx" ON "ai_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_jobs_conversation_created_idx" ON "ai_jobs" USING btree ("conversation_id","created_at");
