import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pathnameRef = { current: "/ja" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { label?: string }) => {
    if (key === "targetCurrent") return `現在の対象：${values?.label ?? ""}`;
    const map: Record<string, string> = {
      toggle: "AI",
      title: "AI アシスタント",
      readonlyNote: "読み取り専用",
      close: "閉じる",
      page: "ページ",
      target: "対象",
      targetNone: "指定なし",
      targetSelfPr: "自己PR",
      targetJobSummary: "職務要約",
      targetHeadline: "見出し",
      targetOverview: "概要",
      selectConversation: "会話を選択",
      untitled: "無題の会話",
      archivedPrefix: "［アーカイブ］",
      new: "新規",
      archive: "保管",
      delete: "削除",
      emptyMessages: "空",
      roleYou: "あなた",
      roleAi: "AI",
      cancelJob: "キャンセル",
      placeholder: "入力",
      send: "送信",
      sending: "送信中…",
      statusQueued: "待機中…",
      pageBoard: "応募進捗",
      pageCareer: "My Career",
      errCreateConversation: "err",
      errBudget: "budget",
      errRate: "rate",
      errUnavailable: "off",
      errSend: "send fail",
      deleteConfirm: "confirm?",
    };
    return map[key] ?? key;
  },
}));

const api = vi.hoisted(() => ({
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  listMessages: vi.fn(),
  enqueueJob: vi.fn(),
  getJob: vi.fn(),
  cancelJob: vi.fn(),
  patchConversation: vi.fn(),
  deleteConversation: vi.fn(),
  readPendingJob: vi.fn(() => null),
  writePendingJob: vi.fn(),
  readActiveConversationId: vi.fn(() => null),
  writeActiveConversationId: vi.fn(),
}));

vi.mock("./ai-api", async () => {
  const actual = await vi.importActual<typeof import("./ai-api")>("./ai-api");
  return {
    ...actual,
    ...api,
  };
});

import { AiSidebar } from "./ai-sidebar";
import { applyPageNavigation } from "@/lib/ai/context/navigation";
import { pageContextFromPath } from "./page-context";

describe("AiSidebar", () => {
  beforeEach(() => {
    pathnameRef.current = "/ja";
    api.listConversations.mockResolvedValue({
      conversations: [],
      pagination: { limit: 50, offset: 0, total: 0 },
    });
    api.createConversation.mockResolvedValue({
      conversation: {
        id: "conv-1",
        title: null,
        status: "active",
        pinnedTarget: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      },
    });
    api.listMessages.mockResolvedValue({
      messages: [],
      pagination: { limit: 100, offset: 0, total: 0 },
    });
    api.enqueueJob.mockResolvedValue({
      job: {
        id: "job-1",
        conversationId: "conv-1",
        clientRequestId: "req-1",
        feature: "chat",
        status: "queued",
        attempt: 0,
        maxAttempts: 3,
        executionPhase: "queued",
        providerOutcome: "not_started",
        errorCode: null,
        errorMessage: null,
        userMessageId: "m1",
        resultMessageId: null,
        usageEventId: "u1",
        provider: "mock",
        model: "mock-v1",
        fencingToken: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        cancelRequestedAt: null,
      },
      userMessageId: "m1",
      replayed: false,
    });
    api.getJob.mockResolvedValue({
      job: {
        id: "job-1",
        conversationId: "conv-1",
        clientRequestId: "req-1",
        feature: "chat",
        status: "succeeded",
        attempt: 1,
        maxAttempts: 3,
        executionPhase: "after_provider",
        providerOutcome: "succeeded",
        errorCode: null,
        errorMessage: null,
        userMessageId: "m1",
        resultMessageId: "m2",
        usageEventId: "u1",
        provider: "mock",
        model: "mock-v1",
        fencingToken: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        cancelRequestedAt: null,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("opens and closes the panel", async () => {
    render(<AiSidebar />);
    expect(screen.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-open",
      "false",
    );
    fireEvent.click(screen.getByTestId("ai-sidebar-toggle"));
    expect(screen.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-open",
      "true",
    );
    fireEvent.click(screen.getByTestId("ai-sidebar-close"));
    expect(screen.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-open",
      "false",
    );
  });

  it("does not clear TargetContext when the path changes", () => {
    const prev = {
      pageContext: pageContextFromPath("/ja"),
      targetContext: {
        type: "profile" as const,
        section: "job_summary" as const,
      },
    };
    const next = applyPageNavigation(prev, {
      page: pageContextFromPath("/ja/profile"),
    });
    expect(next.pageContext?.area).toBe("my_career");
    expect(next.targetContext).toEqual(prev.targetContext);
  });

  it("enqueues with a stable clientRequestId and shows job status", async () => {
    render(<AiSidebar />);
    fireEvent.click(screen.getByTestId("ai-sidebar-toggle"));
    await waitFor(() => expect(api.listConversations).toHaveBeenCalled());

    fireEvent.change(screen.getByTestId("ai-composer-input"), {
      target: { value: "職務要約を改善して" },
    });
    fireEvent.click(screen.getByTestId("ai-composer-send"));

    await waitFor(() => expect(api.enqueueJob).toHaveBeenCalled());
    const body = api.enqueueJob.mock.calls[0][0];
    expect(body.clientRequestId).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
    expect(body.content).toBe("職務要約を改善して");
    expect(body.pageContext?.area).toBe("board");

    await waitFor(() =>
      expect(screen.getByTestId("ai-job-status")).toBeInTheDocument(),
    );
  });

  it("lets the user pick a target without losing it on navigation helper", () => {
    render(<AiSidebar />);
    fireEvent.click(screen.getByTestId("ai-sidebar-toggle"));
    fireEvent.change(screen.getByTestId("ai-target-select"), {
      target: { value: "profile:self_pr" },
    });
    expect(screen.getByTestId("ai-target-context")).toHaveTextContent("自己PR");
  });
});
