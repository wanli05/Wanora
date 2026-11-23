import type { AiConversationDto, AiMessageDto } from "@/lib/ai/conversation";
import type { AiJobDto } from "@/lib/ai/jobs";
import type { AiPageContext, AiTargetContext } from "@/lib/ai/context/types";

export type AiApiError = {
  error: string;
  message?: string;
};

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function fetchAiStatus(): Promise<{
  enabled: boolean;
  provider: string;
}> {
  const res = await fetch("/api/ai/status", { credentials: "same-origin" });
  if (!res.ok) return { enabled: false, provider: "mock" };
  return parseJson(res);
}

export async function listConversations(opts?: {
  limit?: number;
  includeArchived?: boolean;
  assistSlotKey?: string;
  /** Only conversations with assist_slot_key IS NULL (general chat). */
  unslotted?: boolean;
}) {
  const q = new URLSearchParams();
  if (opts?.limit) q.set("limit", String(opts.limit));
  if (opts?.includeArchived) q.set("includeArchived", "true");
  if (opts?.assistSlotKey) q.set("assistSlotKey", opts.assistSlotKey);
  if (opts?.unslotted) q.set("unslotted", "true");
  const res = await fetch(`/api/ai/conversations?${q}`, {
    credentials: "same-origin",
  });
  if (res.status === 401) return { unauthorized: true as const };
  if (!res.ok) {
    return { error: await parseJson<AiApiError>(res) };
  }
  return parseJson<{
    conversations: AiConversationDto[];
    pagination: { limit: number; offset: number; total: number };
  }>(res);
}

export async function createConversation(body?: {
  title?: string | null;
  pinnedTarget?: AiTargetContext | null;
  assistSlotKey?: string | null;
}) {
  const res = await fetch("/api/ai/conversations", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) return { error: await parseJson<AiApiError>(res) };
  return parseJson<{ conversation: AiConversationDto }>(res);
}

export async function ensureAssistConversation(body: {
  assistSlotKey: string;
  pinnedTarget: AiTargetContext | null;
  title?: string | null;
}) {
  const res = await fetch("/api/ai/conversations/ensure-assist", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { error: await parseJson<AiApiError>(res), status: res.status };
  return parseJson<{ conversation: AiConversationDto; created: boolean }>(res);
}

export async function rebindAssistConversation(body: {
  fromAssistSlotKey: string;
  toAssistSlotKey: string;
  pinnedTarget: AiTargetContext | null;
}) {
  const res = await fetch("/api/ai/conversations/rebind-assist", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { error: await parseJson<AiApiError>(res), status: res.status };
  return parseJson<{
    conversations: AiConversationDto[];
    reboundCount: number;
    alreadyBound: boolean;
  }>(res);
}

export async function patchConversation(
  id: string,
  body: {
    title?: string | null;
    status?: "active" | "archived";
    pinnedTarget?: AiTargetContext | null;
  },
) {
  const res = await fetch(`/api/ai/conversations/${id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 404) return { notFound: true as const };
  if (!res.ok) return { error: await parseJson<AiApiError>(res) };
  return parseJson<{ conversation: AiConversationDto }>(res);
}

export async function deleteConversation(id: string) {
  const res = await fetch(`/api/ai/conversations/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (res.status === 404) return { notFound: true as const };
  if (!res.ok) return { error: await parseJson<AiApiError>(res) };
  return parseJson<{ conversation: AiConversationDto }>(res);
}

export async function listMessages(
  conversationId: string,
  opts?: { limit?: number; offset?: number },
) {
  const q = new URLSearchParams();
  if (opts?.limit) q.set("limit", String(opts.limit));
  if (opts?.offset) q.set("offset", String(opts.offset));
  const res = await fetch(
    `/api/ai/conversations/${conversationId}/messages?${q}`,
    { credentials: "same-origin" },
  );
  if (res.status === 404) return { notFound: true as const };
  if (!res.ok) return { error: await parseJson<AiApiError>(res) };
  return parseJson<{
    messages: AiMessageDto[];
    pagination: { limit: number; offset: number; total: number };
  }>(res);
}

export async function enqueueJob(body: {
  conversationId: string;
  clientRequestId: string;
  content: string;
  feature?: string;
  pageContext?: AiPageContext | null;
  targetContext?: AiTargetContext | null;
}) {
  const res = await fetch("/api/ai/jobs", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { error: await parseJson<AiApiError>(res), status: res.status };
  return parseJson<{
    job: AiJobDto;
    userMessageId: string;
    replayed: boolean;
  }>(res);
}

export async function getJob(id: string) {
  const res = await fetch(`/api/ai/jobs/${id}`, {
    credentials: "same-origin",
  });
  if (res.status === 404) return { notFound: true as const };
  if (!res.ok) return { error: await parseJson<AiApiError>(res) };
  return parseJson<{ job: AiJobDto }>(res);
}

export async function cancelJob(id: string) {
  const res = await fetch(`/api/ai/jobs/${id}/cancel`, {
    method: "POST",
    credentials: "same-origin",
  });
  if (res.status === 404) return { notFound: true as const };
  if (!res.ok) return { error: await parseJson<AiApiError>(res) };
  return parseJson<{ job: AiJobDto; alreadyTerminal: boolean }>(res);
}

export const PENDING_JOB_KEY = "wanora:ai:pendingJob";
export const ACTIVE_CONV_KEY = "wanora:ai:activeConversation";

export type PendingJobState = {
  jobId: string;
  conversationId: string;
  clientRequestId: string;
};

export function readPendingJob(): PendingJobState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_JOB_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingJobState;
  } catch {
    return null;
  }
}

export function writePendingJob(state: PendingJobState | null) {
  if (typeof window === "undefined") return;
  if (!state) sessionStorage.removeItem(PENDING_JOB_KEY);
  else sessionStorage.setItem(PENDING_JOB_KEY, JSON.stringify(state));
}

export function readActiveConversationId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACTIVE_CONV_KEY);
}

export function writeActiveConversationId(id: string | null) {
  if (typeof window === "undefined") return;
  if (!id) sessionStorage.removeItem(ACTIVE_CONV_KEY);
  else sessionStorage.setItem(ACTIVE_CONV_KEY, id);
}
