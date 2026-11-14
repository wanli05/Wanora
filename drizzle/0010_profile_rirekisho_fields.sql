ALTER TABLE "profiles" ADD COLUMN "nearest_station" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "commute_hours" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "commute_minutes" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "dependents_count" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "has_spouse" boolean;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "spouse_dependent" boolean;