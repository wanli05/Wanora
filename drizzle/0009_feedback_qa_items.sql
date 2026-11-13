ALTER TABLE "interview_feedbacks" DROP CONSTRAINT "interview_feedbacks_content_check";--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ADD COLUMN "qa_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
-- Backfill from legacy question/own_answer; do NOT drop those columns (reversible).
UPDATE "interview_feedbacks"
SET "qa_items" = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'question', nullif(btrim(coalesce("question", '')), ''),
      'answer', nullif(btrim(coalesce("own_answer", '')), '')
    )
  )
)
WHERE jsonb_array_length("qa_items") = 0
  AND (
    ("question" is not null and length(btrim("question")) > 0)
    OR ("own_answer" is not null and length(btrim("own_answer")) > 0)
  );--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ADD CONSTRAINT "interview_feedbacks_qa_items_array_check" CHECK (jsonb_typeof("interview_feedbacks"."qa_items") = 'array');--> statement-breakpoint
ALTER TABLE "interview_feedbacks" ADD CONSTRAINT "interview_feedbacks_content_check" CHECK ("interview_feedbacks"."body" is not null and length(btrim("interview_feedbacks"."body")) > 0
        or "interview_feedbacks"."question" is not null and length(btrim("interview_feedbacks"."question")) > 0
        or "interview_feedbacks"."own_answer" is not null and length(btrim("interview_feedbacks"."own_answer")) > 0
        or "interview_feedbacks"."result_text" is not null and length(btrim("interview_feedbacks"."result_text")) > 0
        or "interview_feedbacks"."reflection" is not null and length(btrim("interview_feedbacks"."reflection")) > 0
        or (
          jsonb_typeof("interview_feedbacks"."qa_items") = 'array'
          and jsonb_array_length("interview_feedbacks"."qa_items") > 0
        ));