CREATE TABLE "ai_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"status" text DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"pinned_target" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_conversations_id_user_uidx" UNIQUE("id","user_id"),
	CONSTRAINT "ai_conversations_status_check" CHECK (status in ('active', 'archived', 'deleted')),
	CONSTRAINT "ai_conversations_deleted_at_check" CHECK (("ai_conversations"."status" = 'deleted' and "ai_conversations"."deleted_at" is not null)
        or ("ai_conversations"."status" <> 'deleted' and "ai_conversations"."deleted_at" is null))
);
--> statement-breakpoint
CREATE TABLE "ai_daily_budget_counters" (
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"budget_date" date NOT NULL,
	"spent_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"reserved_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_daily_budget_counters_pk" PRIMARY KEY("scope_type","scope_id","budget_date"),
	CONSTRAINT "ai_daily_budget_counters_scope_type_check" CHECK (scope_type in ('user', 'global')),
	CONSTRAINT "ai_daily_budget_counters_amounts_nonneg_check" CHECK ("ai_daily_budget_counters"."spent_usd" >= 0 and "ai_daily_budget_counters"."reserved_usd" >= 0),
	CONSTRAINT "ai_daily_budget_counters_global_scope_id_check" CHECK (("ai_daily_budget_counters"."scope_type" <> 'global') or ("ai_daily_budget_counters"."scope_id" = 'global'))
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"page_context" jsonb,
	"target_context" jsonb,
	"client_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_messages_id_user_uidx" UNIQUE("id","user_id"),
	CONSTRAINT "ai_messages_role_check" CHECK (role in ('user', 'assistant', 'system', 'tool'))
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"feature" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"prompt_version" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"latency_ms" integer,
	"status" text NOT NULL,
	"error_code" text,
	"request_id" text,
	"conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_events_status_check" CHECK (status in ('reserved', 'ok', 'error', 'rejected_budget', 'rejected_rate', 'invalid_output', 'ai_unavailable')),
	CONSTRAINT "ai_usage_events_tokens_nonneg_check" CHECK ("ai_usage_events"."input_tokens" >= 0 and "ai_usage_events"."output_tokens" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_user_fk" FOREIGN KEY ("conversation_id","user_id") REFERENCES "public"."ai_conversations"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_conversations_user_updated_idx" ON "ai_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "ai_conversations_user_status_idx" ON "ai_conversations" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ai_conversations_purge_idx" ON "ai_conversations" USING btree ("status","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_messages_user_client_message_uidx" ON "ai_messages" USING btree ("user_id","client_message_id") WHERE "ai_messages"."client_message_id" is not null;--> statement-breakpoint
CREATE INDEX "ai_messages_conversation_created_idx" ON "ai_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_messages_user_idx" ON "ai_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_events_user_created_idx" ON "ai_usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_created_idx" ON "ai_usage_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_status_created_idx" ON "ai_usage_events" USING btree ("status","created_at");