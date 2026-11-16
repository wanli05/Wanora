import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pathnameRef = { current: "/ja" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

vi.mock("next-intl", () => ({
  useTranslations: () =>
    (key: string, values?: { label?: string; page?: string; target?: string }) => {
      if (key === "targetCurrent") return `現在の焦点：${values?.label ?? ""}`;
      if (key === "referencePage") return `参照：${values?.page ?? ""}`;
      if (key === "referencePageTarget")
        return `参照：${values?.page ?? ""} · ${values?.target ?? ""}`;
      const map: Record<string, string> = {
        toggle: "AI",
        title: "AI アシスタント",
        readonlyNote: "読み取り専用",
        close: "閉じる",
        adjustLead: "任意",
        adjustFocus: "焦点",
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
        emptyMessages: "まずは入力",
        suggestLead: "よくある相談",
        suggestImproveSelfPr: "自己PRを改善",
        suggestAnalyzeCareer: "職務経歴を分析",
        suggestCareerChat: "キャリアについて相談",
        suggestBoardOrganize: "選考状況を整理",
        suggestInterviewPrep: "面接準備の相談",
        suggestApplyStrategy: "応募戦略を考える",
        suggestResumeTips: "履歴書の書き方",
        suggestPromptImproveSelfPr: "自己PRの改善について相談したいです。",
        suggestPromptAnalyzeCareer: "職務経歴について相談したいです。",
        suggestPromptCareerChat: "キャリアについて相談したいです。",
        suggestPromptBoardOrganize: "選考整理について相談したいです。",
        suggestPromptInterviewPrep: "面接準備について相談したいです。",
        suggestPromptApplyStrategy: "応募戦略について相談したいです。",
        suggestPromptResumeTips: "履歴書について相談したいです。",
        roleYou: "あなた",
        roleAi: "AI",
        cancelJob: "キャンセル",
        placeholder: "入力",
        send: "送信",
        sending: "送信中…",
        statusQueued: "待機中…",
        pageBoard: "応募進捗",
        pageCareer: "My Career",
        pageOther: "このページ",
        errCreateConversation: "err",
        errBudget: "budget",
        errRate: "rate",
        errUnavailable: "off",
        errSend: "send fail",
        errJobTimeout: "timeout",
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
  readPendingJob: vi.fn((): null => null),
  writePendingJob: vi.fn(),
  readActiveConversationId: vi.fn((): string | null => null),
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
        status: "running",
        attempt: 1,
        maxAttempts: 3,
        executionPhase: "calling_provider",
        providerOutcome: "not_started",
        errorCode: null,
        errorMessage: null,
        userMessageId: "m1",
        resultMessageId: null,
        usageEventId: "u1",
        provider: "mock",
        model: "mock-v1",
        fencingToken: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: null,
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

  it("sends without requiring a Target selection", async () => {
    render(<AiSidebar />);
    fireEvent.click(screen.getByTestId("ai-sidebar-toggle"));
    await waitFor(() => expect(api.listConversations).toHaveBeenCalled());

    expect(screen.queryByTestId("ai-target-select")).not.toBeInTheDocument();
    expect(screen.getByTestId("ai-context-ref")).toHaveTextContent("参照：応募進捗");

    fireEvent.change(screen.getByTestId("ai-composer-input"), {
      target: { value: "キャリアについて相談したいです" },
    });
    fireEvent.click(screen.getByTestId("ai-composer-send"));

    await waitFor(() => expect(api.enqueueJob).toHaveBeenCalled());
    const body = api.enqueueJob.mock.calls[0][0];
    expect(body.clientRequestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.targetContext).toBeNull();
    expect(body.pageContext?.area).toBe("board");

    await waitFor(() =>
      expect(screen.getByTestId("ai-job-status")).toBeInTheDocument(),
    );
  });

  it("fills composer from a suggestion without auto-sending", async () => {
    pathnameRef.current = "/ja/profile";
    render(<AiSidebar />);
    fireEvent.click(screen.getByTestId("ai-sidebar-toggle"));
    await waitFor(() => expect(screen.getByTestId("ai-suggestions")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("ai-suggest-self_pr"));
    expect(screen.getByTestId("ai-composer-input")).toHaveValue(
      "自己PRの改善について相談したいです。",
    );
    expect(api.enqueueJob).not.toHaveBeenCalled();
  });

  it("lets the user optionally adjust focus near the composer", async () => {
    render(<AiSidebar />);
    fireEvent.click(screen.getByTestId("ai-sidebar-toggle"));
    fireEvent.click(screen.getByTestId("ai-context-ref"));
    expect(screen.getByTestId("ai-context-adjuster")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("ai-target-select"), {
      target: { value: "profile:self_pr" },
    });
    expect(screen.getByTestId("ai-target-context")).toHaveTextContent("自己PR");
    expect(screen.getByTestId("ai-context-ref")).toHaveTextContent("自己PR");
  });

  it("hides suggestions once messages exist", async () => {
    api.listConversations.mockResolvedValue({
      conversations: [
        {
          id: "conv-1",
          title: "既存",
          status: "active",
          pinnedTarget: { type: "profile", section: "overview" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
        },
      ],
      pagination: { limit: 50, offset: 0, total: 1 },
    });
    api.readActiveConversationId.mockReturnValue("conv-1");
    api.listMessages.mockResolvedValue({
      messages: [
        {
          id: "m1",
          conversationId: "conv-1",
          role: "user",
          content: "hello",
          pageContext: null,
          targetContext: { type: "profile", section: "overview" },
          clientMessageId: null,
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { limit: 100, offset: 0, total: 1 },
    });

    render(<AiSidebar />);
    fireEvent.click(screen.getByTestId("ai-sidebar-toggle"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-msg-user")).toHaveTextContent("hello"),
    );
    expect(screen.queryByTestId("ai-suggestions")).not.toBeInTheDocument();
  });
});
