import { z } from "zod";
import type { AiTargetContext } from "@/lib/ai/context/types";

/**
 * Assist slot keys for My Career refine conversations.
 * Legacy / general chat rows keep `assist_slot_key = null`.
 */
export const ASSIST_SLOT_KEY_MAX = 120;

const uuidRe =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export const assistSlotKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(ASSIST_SLOT_KEY_MAX)
  .regex(
    new RegExp(
      `^refine:(profile:(self_pr|job_summary)|career_employer:(${uuidRe}|draft:${uuidRe})|career_project:(${uuidRe}|draft:${uuidRe}))$`,
      "i",
    ),
    "invalid_assist_slot_key",
  );

export type AssistSlotKey = z.infer<typeof assistSlotKeySchema>;

export type ParsedAssistSlot =
  | { kind: "profile"; section: "self_pr" | "job_summary" }
  | { kind: "career_employer"; mode: "record"; recordId: string }
  | { kind: "career_employer"; mode: "draft"; clientDraftKey: string }
  | { kind: "career_project"; mode: "record"; recordId: string }
  | { kind: "career_project"; mode: "draft"; clientDraftKey: string };

export function normalizeAssistSlotKey(raw: string): string {
  return raw.trim().toLowerCase();
}

export function parseAssistSlotKey(raw: string): ParsedAssistSlot | null {
  const parsed = assistSlotKeySchema.safeParse(normalizeAssistSlotKey(raw));
  if (!parsed.success) return null;
  const key = parsed.data;

  const profile = /^refine:profile:(self_pr|job_summary)$/i.exec(key);
  if (profile) {
    return {
      kind: "profile",
      section: profile[1]!.toLowerCase() as "self_pr" | "job_summary",
    };
  }

  const employerRecord = new RegExp(
    `^refine:career_employer:(${uuidRe})$`,
    "i",
  ).exec(key);
  if (employerRecord) {
    return {
      kind: "career_employer",
      mode: "record",
      recordId: employerRecord[1]!.toLowerCase(),
    };
  }

  const employerDraft = new RegExp(
    `^refine:career_employer:draft:(${uuidRe})$`,
    "i",
  ).exec(key);
  if (employerDraft) {
    return {
      kind: "career_employer",
      mode: "draft",
      clientDraftKey: employerDraft[1]!.toLowerCase(),
    };
  }

  const projectRecord = new RegExp(
    `^refine:career_project:(${uuidRe})$`,
    "i",
  ).exec(key);
  if (projectRecord) {
    return {
      kind: "career_project",
      mode: "record",
      recordId: projectRecord[1]!.toLowerCase(),
    };
  }

  const projectDraft = new RegExp(
    `^refine:career_project:draft:(${uuidRe})$`,
    "i",
  ).exec(key);
  if (projectDraft) {
    return {
      kind: "career_project",
      mode: "draft",
      clientDraftKey: projectDraft[1]!.toLowerCase(),
    };
  }

  return null;
}

export function assistSlotKeyForProfile(
  section: "self_pr" | "job_summary",
): AssistSlotKey {
  return `refine:profile:${section}`;
}

export function assistSlotKeyForCareerEmployer(recordId: string): AssistSlotKey {
  return `refine:career_employer:${recordId.toLowerCase()}`;
}

export function assistSlotKeyForCareerEmployerDraft(
  clientDraftKey: string,
): AssistSlotKey {
  return `refine:career_employer:draft:${clientDraftKey.toLowerCase()}`;
}

export function assistSlotKeyForCareerProject(recordId: string): AssistSlotKey {
  return `refine:career_project:${recordId.toLowerCase()}`;
}

export function assistSlotKeyForCareerProjectDraft(
  clientDraftKey: string,
): AssistSlotKey {
  return `refine:career_project:draft:${clientDraftKey.toLowerCase()}`;
}

export type AssistBindingValidation =
  | { ok: true; slot: ParsedAssistSlot; pinnedTarget: AiTargetContext | null }
  | { ok: false; code: "invalid_assist_slot_key" | "invalid_assist_binding" };

function asPinnedTarget(value: unknown): AiTargetContext | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (v.type === "profile") {
    const section = v.section;
    if (
      section === undefined ||
      section === "self_pr" ||
      section === "job_summary" ||
      section === "headline" ||
      section === "overview"
    ) {
      return {
        type: "profile",
        ...(section
          ? {
              section: section as
                | "self_pr"
                | "job_summary"
                | "headline"
                | "overview",
            }
          : {}),
      };
    }
    return undefined;
  }
  if (
    (v.type === "career_employer" ||
      v.type === "career_project" ||
      v.type === "education" ||
      v.type === "work_history" ||
      v.type === "license") &&
    typeof v.id === "string" &&
    z.uuid().safeParse(v.id).success
  ) {
    return { type: v.type, id: v.id };
  }
  return undefined;
}

/**
 * Hard check: assistSlotKey must be compatible with pinnedTarget.
 * Draft slots require pinnedTarget === null; record slots require matching id.
 */
export function validateAssistSlotBinding(
  assistSlotKey: string,
  pinnedTarget: unknown,
): AssistBindingValidation {
  const slot = parseAssistSlotKey(assistSlotKey);
  if (!slot) return { ok: false, code: "invalid_assist_slot_key" };

  const pin = asPinnedTarget(pinnedTarget);
  if (pin === undefined) {
    return { ok: false, code: "invalid_assist_binding" };
  }

  if (slot.kind === "profile") {
    if (
      pin &&
      pin.type === "profile" &&
      pin.section === slot.section
    ) {
      return { ok: true, slot, pinnedTarget: pin };
    }
    return { ok: false, code: "invalid_assist_binding" };
  }

  if (slot.mode === "draft") {
    if (pin === null) {
      return { ok: true, slot, pinnedTarget: null };
    }
    return { ok: false, code: "invalid_assist_binding" };
  }

  if (slot.kind === "career_employer") {
    if (
      pin &&
      pin.type === "career_employer" &&
      pin.id.toLowerCase() === slot.recordId
    ) {
      return {
        ok: true,
        slot,
        pinnedTarget: { type: "career_employer", id: pin.id },
      };
    }
    return { ok: false, code: "invalid_assist_binding" };
  }

  if (
    pin &&
    pin.type === "career_project" &&
    pin.id.toLowerCase() === slot.recordId
  ) {
    return {
      ok: true,
      slot,
      pinnedTarget: { type: "career_project", id: pin.id },
    };
  }
  return { ok: false, code: "invalid_assist_binding" };
}

/** Draft → record rebind: same entity kind, from draft uuid to record uuid. */
export function validateAssistRebindKeys(
  fromKey: string,
  toKey: string,
):
  | {
      ok: true;
      kind: "career_employer" | "career_project";
      clientDraftKey: string;
      recordId: string;
    }
  | { ok: false; code: "invalid_assist_slot_key" | "invalid_assist_binding" } {
  const from = parseAssistSlotKey(fromKey);
  const to = parseAssistSlotKey(toKey);
  if (!from || !to) return { ok: false, code: "invalid_assist_slot_key" };
  if (from.kind === "profile" || to.kind === "profile") {
    return { ok: false, code: "invalid_assist_binding" };
  }
  if (from.kind !== to.kind) {
    return { ok: false, code: "invalid_assist_binding" };
  }
  if (from.mode !== "draft" || to.mode !== "record") {
    return { ok: false, code: "invalid_assist_binding" };
  }
  return {
    ok: true,
    kind: from.kind,
    clientDraftKey: from.clientDraftKey,
    recordId: to.recordId,
  };
}
