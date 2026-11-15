import { z } from "zod";

export const AI_TITLE_MAX = 200;
export const AI_CONVERSATIONS_DEFAULT_LIMIT = 20;
export const AI_CONVERSATIONS_MAX_LIMIT = 100;
export const AI_MESSAGES_DEFAULT_LIMIT = 50;
export const AI_MESSAGES_MAX_LIMIT = 200;

const profileSectionSchema = z.enum([
  "self_pr",
  "job_summary",
  "headline",
  "overview",
]);

/** Optional pinned TargetContext snapshot on a conversation. */
export const pinnedTargetSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        type: z.literal("profile"),
        section: profileSectionSchema.optional(),
      })
      .strict(),
    z
      .object({
        type: z.literal("career_project"),
        id: z.uuid(),
      })
      .strict(),
    z
      .object({
        type: z.literal("education"),
        id: z.uuid(),
      })
      .strict(),
    z
      .object({
        type: z.literal("work_history"),
        id: z.uuid(),
      })
      .strict(),
    z
      .object({
        type: z.literal("license"),
        id: z.uuid(),
      })
      .strict(),
    z
      .object({
        type: z.literal("career_employer"),
        id: z.uuid(),
      })
      .strict(),
  ])
  .nullable();

export const createConversationBodySchema = z
  .object({
    title: z.string().trim().min(1).max(AI_TITLE_MAX).nullable().optional(),
    pinnedTarget: pinnedTargetSchema.optional(),
  })
  .strict();

export const patchConversationBodySchema = z
  .object({
    title: z.string().trim().min(1).max(AI_TITLE_MAX).nullable().optional(),
    status: z.enum(["active", "archived"]).optional(),
    pinnedTarget: pinnedTargetSchema.optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.title !== undefined ||
      body.status !== undefined ||
      body.pinnedTarget !== undefined,
    { message: "empty_patch" },
  );

function paginationSchema(defaultLimit: number, maxLimit: number) {
  return z
    .object({
      limit: z.coerce
        .number()
        .int()
        .positive()
        .max(maxLimit)
        .default(defaultLimit),
      offset: z.coerce.number().int().nonnegative().default(0),
    })
    .strict();
}

export const listConversationsQuerySchema = paginationSchema(
  AI_CONVERSATIONS_DEFAULT_LIMIT,
  AI_CONVERSATIONS_MAX_LIMIT,
)
  .extend({
    includeArchived: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
    status: z.enum(["active", "archived"]).optional(),
  })
  .strict();

export const listMessagesQuerySchema = paginationSchema(
  AI_MESSAGES_DEFAULT_LIMIT,
  AI_MESSAGES_MAX_LIMIT,
);

export const conversationIdParamSchema = z.uuid();
