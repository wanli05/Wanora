ALTER TABLE "licenses" DROP CONSTRAINT "licenses_status_check";--> statement-breakpoint
ALTER TABLE "licenses" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "licenses" DROP COLUMN "score";