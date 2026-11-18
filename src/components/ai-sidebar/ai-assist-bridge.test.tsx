import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiAssistProvider,
  useAiAssist,
} from "@/components/ai-sidebar/ai-assist-context";
import { AiSidebar } from "@/components/ai-sidebar/ai-sidebar";
import {
  REFINE_BODY_START,
  REFINE_RESULT_END,
  REFINE_RESULT_START,
} from "@/components/ai-sidebar/refine-prompts";

const pathnameRef = { current: "/ja/profile" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => {
    if (key === "targetCurrent") return `現在の焦点：${values?.label ?? ""}`;
    if (key === "referencePage") return `参照：${values?.page ?? ""}`;
    if (key === "referencePageTarget")
      return `参照：${values?.page ?? ""} · ${values?.target ?? ""}`;
    const map: Record<string, string> = {
      toggle: "AI",
      title: "AI アシスタント",
      readonlyNote: "提案のみ",
      close: "閉じる",
      adjustLead: "任意",
      adjustFocus: "焦点",
      targetNone: "指定なし",
      targetSelfPr: "自己PR",
      targetJobSummary: "職務要約",
      targetHeadline: "見出し",
      targetOverview: "概要",
      targetCareerEmployer: "職歴（就業先）",
      targetCareerProject: "プロジェクト",
      limitedContextNote: "未保存限定",
      applyToDraft: "この内容を使用",
      applyDraftOnly: "未保存です",
      applyOverwriteConfirm: "上書きしますか？",
      applyExtractFailed: "抽出不可",
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
      aiUnavailableShort: "AIオフ",
    };
    return map[key] ?? key;
  },
}));

const api = vi.hoisted(() => ({
  fetchAiStatus: vi.fn(async () => ({ enabled: true, provider: "mock" })),
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
  return { ...actual, ...api };
});

function Harness({
  onApply,
  draftRef,
}: {
  onApply: (text: string) => void;
  draftRef: { current: string };
}) {
  const { openWithAssist } = useAiAssist();
  return (
    <>
      <button
        type="button"
        data-testid="open-self-pr"
        onClick={() =>
          void openWithAssist({
            target: { type: "profile", section: "self_pr" },
            draftText: draftRef.current,
            feature: "self_pr_refine",
            fieldKey: "selfPr_ja",
            draftSnapshot: draftRef.current,
            getCurrentDraft: () => draftRef.current,
            onApplyToDraft: onApply,
          })
        }
      >
        open self pr
      </button>
      <button
        type="button"
        data-testid="open-employer"
        onClick={() =>
          void openWithAssist({
            target: {
              type: "career_employer",
              id: "11111111-1111-4111-8111-111111111111",
            },
            draftText: "就業先叙述草稿",
            feature: "career_employer_narrative_refine",
            fieldKey: "narrative_ja",
            draftSnapshot: "就業先叙述草稿",
            getCurrentDraft: () => "就業先叙述草稿",
            onApplyToDraft: onApply,
          })
        }
      >
        open employer
      </button>
      <button
        type="button"
        data-testid="open-new-project"
        onClick={() =>
          void openWithAssist({
            target: null,
            draftText: "新規概要",
            feature: "career_project_refine",
            fieldKey: "overview_ja",
            draftSnapshot: "新規概要",
            limitedContext: true,
            getCurrentDraft: () => "新規概要",
            onApplyToDraft: onApply,
          })
        }
      >
        open new project
      </button>
      <AiSidebar />
    </>
  );
}

describe("AI assist bridge + apply-to-draft", () => {
  const draftRef = { current: "未保存の自己PR" };
  const onApply = vi.fn();

  beforeEach(() => {
    pathnameRef.current = "/ja/profile";
    draftRef.current = "未保存の自己PR";
    onApply.mockReset();
    api.fetchAiStatus.mockResolvedValue({ enabled: true, provider: "mock" });
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
    api.enqueueJob.mockImplementation(async (body: { clientRequestId: string }) => ({
      job: {
        id: "job-1",
        conversationId: "conv-1",
        status: "succeeded",
        feature: "self_pr_refine",
      },
      userMessageId: "um-1",
      replayed: false,
      _clientRequestId: body.clientRequestId,
    }));
    api.listMessages.mockImplementation(async () => {
      const last = api.enqueueJob.mock.calls.at(-1)?.[0] as
        | { clientRequestId?: string; content?: string }
        | undefined;
      const clientRequestId = last?.clientRequestId ?? "missing";
      const refined = `${REFINE_RESULT_START}\n改善済みPR\n${REFINE_RESULT_END}\n【補足】数字があれば追記を`;
      return {
        messages: [
          {
            id: "u1",
            conversationId: "conv-1",
            role: "user",
            content: last?.content ?? "x",
            clientMessageId: clientRequestId,
            createdAt: new Date().toISOString(),
          },
          {
            id: "a1",
            conversationId: "conv-1",
            role: "assistant",
            content: refined,
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: { limit: 100, offset: 0, total: 2 },
      };
    });
    api.getJob.mockResolvedValue({
      job: {
        id: "job-1",
        conversationId: "conv-1",
        status: "succeeded",
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  function renderHarness() {
    return render(
      <AiAssistProvider>
        <Harness onApply={onApply} draftRef={draftRef} />
      </AiAssistProvider>,
    );
  }

  it("opens sidebar, binds target, prefills draft, does not enqueue", async () => {
    renderHarness();
    fireEvent.click(screen.getByTestId("open-self-pr"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-sidebar-panel")).toHaveAttribute(
        "data-open",
        "true",
      ),
    );
    const composer = screen.getByTestId(
      "ai-composer-input",
    ) as HTMLTextAreaElement;
    expect(composer.value).toContain(REFINE_BODY_START);
    expect(composer.value).toContain("未保存の自己PR");
    expect(composer.value).toContain("自己PRの文章を添削");
    fireEvent.click(screen.getByTestId("ai-context-ref"));
    expect(screen.getByTestId("ai-target-context")).toHaveTextContent("自己PR");
    expect(api.enqueueJob).not.toHaveBeenCalled();
    expect(api.createConversation).not.toHaveBeenCalled();
  });

  it("binds career_employer target for work narrative", async () => {
    renderHarness();
    fireEvent.click(screen.getByTestId("open-employer"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-sidebar-panel")).toHaveAttribute(
        "data-open",
        "true",
      ),
    );
    fireEvent.click(screen.getByTestId("ai-context-ref"));
    expect(screen.getByTestId("ai-target-context")).toHaveTextContent(
      "職歴（就業先）",
    );
    expect(
      (screen.getByTestId("ai-composer-input") as HTMLTextAreaElement).value,
    ).toContain("就業先叙述草稿");
  });

  it("degrades safely for unsaved project without fabricating target id", async () => {
    renderHarness();
    fireEvent.click(screen.getByTestId("open-new-project"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-assist-limited-context")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("ai-context-ref"));
    expect(screen.getByTestId("ai-target-context")).toHaveTextContent("指定なし");
  });

  it("does not open when AI is disabled", async () => {
    api.fetchAiStatus.mockResolvedValue({ enabled: false, provider: "mock" });
    renderHarness();
    fireEvent.click(screen.getByTestId("open-self-pr"));
    await waitFor(() => expect(api.fetchAiStatus).toHaveBeenCalled());
    expect(screen.getByTestId("ai-sidebar-panel")).toHaveAttribute(
      "data-open",
      "false",
    );
    expect(api.enqueueJob).not.toHaveBeenCalled();
  });

  it("applies refined text to draft only after confirm and never enqueues save", async () => {
    renderHarness();
    fireEvent.click(screen.getByTestId("open-self-pr"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-composer-input")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId("ai-composer-send"));
    await waitFor(() => expect(api.enqueueJob).toHaveBeenCalledTimes(1));
    const body = api.enqueueJob.mock.calls[0][0];
    expect(body.feature).toBe("self_pr_refine");
    expect(body.targetContext).toEqual({
      type: "profile",
      section: "self_pr",
    });
    expect(body.content).toContain("未保存の自己PR");

    await waitFor(() =>
      expect(screen.getByTestId("ai-apply-to-draft")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("ai-apply-to-draft"));
    expect(onApply).toHaveBeenCalledWith("改善済みPR");
    expect(screen.getByTestId("ai-apply-notice")).toHaveTextContent("未保存です");
  });

  it("confirms before overwriting a changed draft", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderHarness();
    fireEvent.click(screen.getByTestId("open-self-pr"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-composer-input")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("ai-composer-send"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-apply-to-draft")).toBeInTheDocument(),
    );
    draftRef.current = "ユーザーが後から編集した文";
    fireEvent.click(screen.getByTestId("ai-apply-to-draft"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
