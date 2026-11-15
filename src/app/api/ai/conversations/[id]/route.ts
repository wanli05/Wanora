import { getDb } from "@/db";
import {
  aiError,
  conversationIdParamSchema,
  notFound,
  patchConversationBodySchema,
  requireAiUser,
  serializeConversation,
  unauthorized,
} from "@/lib/ai/conversation";
import { softDeleteConversationAndCancelJobs } from "@/lib/ai/jobs/cancel";
import {
  getUsableAiConversation,
  updateAiConversation,
} from "@/lib/data/ai-conversations";

async function parseId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return conversationIdParamSchema.safeParse(id);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const idParsed = await parseId(context.params);
  if (!idParsed.success) {
    return aiError("invalid_params", 400, "invalid conversation id");
  }

  const row = await getUsableAiConversation(getDb(), user.id, idParsed.data);
  if (!row) return notFound();

  return Response.json({ conversation: serializeConversation(row) });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const idParsed = await parseId(context.params);
  if (!idParsed.success) {
    return aiError("invalid_params", 400, "invalid conversation id");
  }

  const parsed = patchConversationBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return aiError("invalid_body", 400, "invalid body", parsed.error.flatten());
  }

  const row = await updateAiConversation(getDb(), user.id, idParsed.data, {
    title: parsed.data.title,
    status: parsed.data.status,
    pinnedTarget: parsed.data.pinnedTarget,
  });
  if (!row) return notFound();

  return Response.json({ conversation: serializeConversation(row) });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireAiUser(request);
  if (!user) return unauthorized();

  const idParsed = await parseId(context.params);
  if (!idParsed.success) {
    return aiError("invalid_params", 400, "invalid conversation id");
  }

  const row = await softDeleteConversationAndCancelJobs(
    getDb(),
    user.id,
    idParsed.data,
  );
  if (!row) return notFound();

  return Response.json({ conversation: serializeConversation(row) });
}
