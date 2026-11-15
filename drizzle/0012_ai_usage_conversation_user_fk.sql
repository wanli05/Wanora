-- Follow-up to 0011: composite ownership FK for ai_usage_events.
-- PostgreSQL 15+ column-list SET NULL keeps user_id when a conversation is deleted.
-- Drizzle cannot emit "ON DELETE SET NULL (conversation_id)"; do not regenerate this
-- file as bare SET NULL (that would null user_id and conflict with NOT NULL).
--
-- Abort if any existing row links a conversation owned by a different user.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ai_usage_events u
    INNER JOIN ai_conversations c ON c.id = u.conversation_id
    WHERE u.conversation_id IS NOT NULL
      AND u.user_id IS DISTINCT FROM c.user_id
  ) THEN
    RAISE EXCEPTION
      'ai_usage_events has cross-user conversation_id associations; fix data before applying 0012_ai_usage_conversation_user_fk';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "ai_usage_events" DROP CONSTRAINT "ai_usage_events_conversation_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_conversation_user_fk" FOREIGN KEY ("conversation_id","user_id") REFERENCES "public"."ai_conversations"("id","user_id") ON DELETE SET NULL ("conversation_id") ON UPDATE NO ACTION;
