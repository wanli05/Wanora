import { z } from "zod";
import { pinnedTargetSchema } from "@/lib/ai/conversation/schemas";

const pageContextSchema = z
  .object({
    path: z.string().trim().min(1).max(500),
    area: z.enum(["my_career", "board", "other"]).optional(),
    label: z.string().trim().max(200).optional(),
  })
  .strict();

export const enqueueJobBodySchema = z
  .object({
    conversationId: z.uuid(),
    clientRequestId: z.string().trim().min(1).max(128),
    content: z.string().trim().min(1).max(20_000),
    feature: z.string().trim().min(1).max(64).default("chat"),
    pageContext: pageContextSchema.nullable().optional(),
    targetContext: pinnedTargetSchema.optional(),
    model: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export const jobIdParamSchema = z.uuid();
