ALTER TABLE "interview_feedbacks" DROP CONSTRAINT "interview_feedbacks_interview_uidx";--> statement-breakpoint
ALTER TABLE "interview_feedbacks" DROP CONSTRAINT "interview_feedbacks_rating_check";--> statement-breakpoint
ALTER TABLE "interview_feedbacks" DROP CONSTRAINT "interview_feedbacks_body_or_rating_check";--> statement-breakpoint
DELETE FROM "interview_feedbacks" WHERE "body" IS NULL OR length(btrim("body")) = 0;--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ALTER COLUMN "body" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "interview_feedbacks_interview_idx" ON "interview_feedbacks" USING btree ("interview_id");--> statement-breakpoint
ALTER TABLE "interview_feedbacks" DROP COLUMN "rating";--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ADD CONSTRAINT "interview_feedbacks_body_not_empty_check" CHECK (length(btrim("interview_feedbacks"."body")) > 0);
