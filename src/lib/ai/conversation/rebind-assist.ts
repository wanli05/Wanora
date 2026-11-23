import type { Db } from "@/db";
import {
  normalizeAssistSlotKey,
  validateAssistRebindKeys,
  validateAssistSlotBinding,
} from "@/lib/ai/conversation/assist-slot";
import {
  findLatestActiveAiConversationByAssistSlot,
  rebindAiConversationsAssistSlot,
  withAssistSlotLock,
  type AiConversationRow,
} from "@/lib/data/ai-conversations";
import { getCareerEmployer } from "@/lib/data/career-employers";
import { getCareerProject } from "@/lib/data/career-projects";

export type RebindAssistInput = {
  userId: string;
  fromAssistSlotKey: string;
  toAssistSlotKey: string;
  pinnedTarget: unknown;
};

export type RebindAssistResult =
  | {
      ok: true;
      conversations: AiConversationRow[];
      reboundCount: number;
      /** True when from-slot had nothing but to-slot already exists (idempotent). */
      alreadyBound: boolean;
    }
  | {
      ok: false;
      code: "invalid_assist_slot_key" | "invalid_assist_binding" | "not_found";
      message: string;
    };

/**
 * Move draft-slot conversations onto a saved record slot.
 * Idempotent: repeating after success returns alreadyBound without error.
 * Does not mutate career profile rows — Save must already have succeeded.
 */
export async function rebindAssistConversations(
  db: Db,
  input: RebindAssistInput,
): Promise<RebindAssistResult> {
  const fromKey = normalizeAssistSlotKey(input.fromAssistSlotKey);
  const toKey = normalizeAssistSlotKey(input.toAssistSlotKey);
  const keys = validateAssistRebindKeys(fromKey, toKey);
  if (!keys.ok) {
    return {
      ok: false,
      code: keys.code,
      message: "invalid draft→record rebind keys",
    };
  }

  const binding = validateAssistSlotBinding(toKey, input.pinnedTarget);
  if (!binding.ok) {
    return {
      ok: false,
      code: binding.code,
      message: "to-slot / pinnedTarget mismatch",
    };
  }

  if (keys.kind === "career_employer") {
    const row = await getCareerEmployer(db, input.userId, keys.recordId);
    if (!row) {
      return {
        ok: false,
        code: "not_found",
        message: "career employer not found for user",
      };
    }
  } else {
    const row = await getCareerProject(db, input.userId, keys.recordId);
    if (!row) {
      return {
        ok: false,
        code: "not_found",
        message: "career project not found for user",
      };
    }
  }

  // Lock both slots (order by string to avoid deadlock).
  const lockA = fromKey < toKey ? fromKey : toKey;
  const lockB = fromKey < toKey ? toKey : fromKey;

  return db.transaction(async (tx) => {
    return withAssistSlotLock(tx, input.userId, lockA, async () => {
      return withAssistSlotLock(tx, input.userId, lockB, async () => {
        const updated = await rebindAiConversationsAssistSlot(tx, input.userId, {
          fromAssistSlotKey: fromKey,
          toAssistSlotKey: toKey,
          pinnedTarget: binding.pinnedTarget,
        });

        if (updated.length > 0) {
          return {
            ok: true as const,
            conversations: updated,
            reboundCount: updated.length,
            alreadyBound: false,
          };
        }

        const existing = await findLatestActiveAiConversationByAssistSlot(
          tx,
          input.userId,
          toKey,
        );
        if (existing) {
          return {
            ok: true as const,
            conversations: [existing],
            reboundCount: 0,
            alreadyBound: true,
          };
        }

        // Nothing on from or to — idempotent no-op (never opened AI before Save).
        return {
          ok: true as const,
          conversations: [],
          reboundCount: 0,
          alreadyBound: true,
        };
      });
    });
  });
}
