ALTER TABLE "ai_usage_events" DROP CONSTRAINT "ai_usage_events_tokens_nonneg_check";--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "cached_input_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "reasoning_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "pricing_version" text;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD COLUMN "provider_response_id" text;--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_tokens_nonneg_check" CHECK ("ai_usage_events"."input_tokens" >= 0 and "ai_usage_events"."output_tokens" >= 0 and "ai_usage_events"."cached_input_tokens" >= 0 and "ai_usage_events"."reasoning_tokens" >= 0);