ALTER TABLE "interview_feedbacks" DROP CONSTRAINT "interview_feedbacks_body_not_empty_check";--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ALTER COLUMN "body" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ADD COLUMN "question" text;--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ADD COLUMN "own_answer" text;--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ADD COLUMN "result_text" text;--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ADD COLUMN "reflection" text;--> statement-breakpoint
-- Merge applications.notes into job_notes before dropping the ambiguous memo column.
-- Prefer job_notes; append notes when both differ; copy notes when job_notes is empty.
UPDATE "applications"
SET "job_notes" = CASE
	WHEN "notes" IS NULL OR length(btrim("notes")) = 0 THEN "job_notes"
	WHEN "job_notes" IS NULL OR length(btrim("job_notes")) = 0 THEN btrim("notes")
	WHEN btrim("notes") = btrim("job_notes") THEN "job_notes"
	ELSE btrim("job_notes") || E'\n\n' || btrim("notes")
END
WHERE "notes" IS NOT NULL AND length(btrim("notes")) > 0;--> statement-breakpoint
ALTER TABLE "applications" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ADD CONSTRAINT "interview_feedbacks_content_check" CHECK ("interview_feedbacks"."body" is not null and length(btrim("interview_feedbacks"."body")) > 0
        or "interview_feedbacks"."question" is not null and length(btrim("interview_feedbacks"."question")) > 0
        or "interview_feedbacks"."own_answer" is not null and length(btrim("interview_feedbacks"."own_answer")) > 0
        or "interview_feedbacks"."result_text" is not null and length(btrim("interview_feedbacks"."result_text")) > 0
        or "interview_feedbacks"."reflection" is not null and length(btrim("interview_feedbacks"."reflection")) > 0);
