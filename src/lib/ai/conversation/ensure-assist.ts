import type { Db } from "@/db";
import {
  normalizeAssistSlotKey,
  validateAssistSlotBinding,
} from "@/lib/ai/conversation/assist-slot";
import {
  createAiConversation,
  findLatestActiveAiConversationByAssistSlot,
  touchAiConversationUpdatedAt,
  withAssistSlotLock,
  type AiConversationRow,
} from "@/lib/data/ai-conversations";
import { getCareerEmployer } from "@/lib/data/career-employers";
import { getCareerProject } from "@/lib/data/career-projects";

export type EnsureAssistInput = {
  userId: string;
  assistSlotKey: string;
  pinnedTarget: unknown;
  title?: string | null;
};

export type EnsureAssistResult =
  | { ok: true; conversation: AiConversationRow; created: boolean }
  | {
      ok: false;
      code: "invalid_assist_slot_key" | "invalid_assist_binding" | "not_found";
      message: string;
    };

async function assertRecordOwned(
  db: Db,
  userId: string,
  binding: ReturnType<typeof validateAssistSlotBinding>,
): Promise<EnsureAssistResult | null> {
  if (!binding.ok) return null;
  const { slot } = binding;
  if (slot.kind === "profile" || slot.mode === "draft") return null;

  if (slot.kind === "career_employer") {
    const row = await getCareerEmployer(db, userId, slot.recordId);
    if (!row) {
      return {
        ok: false,
        code: "not_found",
        message: "career employer not found for user",
      };
    }
    return null;
  }

  const row = await getCareerProject(db, userId, slot.recordId);
  if (!row) {
    return {
      ok: false,
      code: "not_found",
      message: "career project not found for user",
    };
  }
  return null;
}

/**
 * Find-or-create the latest active conversation for a refine slot.
 * Concurrent calls for the same user+slot are serialized via advisory lock.
 */
export async function ensureAssistConversation(
  db: Db,
  input: EnsureAssistInput,
): Promise<EnsureAssistResult> {
  const slotKey = normalizeAssistSlotKey(input.assistSlotKey);
  const binding = validateAssistSlotBinding(slotKey, input.pinnedTarget);
  if (!binding.ok) {
    return {
      ok: false,
      code: binding.code,
      message: "assist slot / pinnedTarget mismatch",
    };
  }

  const ownership = await assertRecordOwned(db, input.userId, binding);
  if (ownership) return ownership;

  return db.transaction(async (tx) => {
    return withAssistSlotLock(tx, input.userId, slotKey, async () => {
      const existing = await findLatestActiveAiConversationByAssistSlot(
        tx,
        input.userId,
        slotKey,
      );
      if (existing) {
        const touched =
          (await touchAiConversationUpdatedAt(tx, input.userId, existing.id)) ??
          existing;
        return { ok: true as const, conversation: touched, created: false };
      }

      const created = await createAiConversation(tx, input.userId, {
        title: input.title ?? null,
        pinnedTarget: binding.pinnedTarget,
        assistSlotKey: slotKey,
      });
      return { ok: true as const, conversation: created, created: true };
    });
  });
}
