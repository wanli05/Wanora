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
  useLocale: () => "ja",
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
              viewChat: "チャット",
        viewHistory: "会話履歴",
        newChat: "＋ 新しいチャット",
        historyEmpty: "会話はまだありません",
        historySourceProfile: "プロフィール",
        historySourceProject: "プロジェクト",
        historySourceEmployer: "職歴",
        historySourceGeneral: "一般",
        conversationMenu: "会話メニュー",
        selectConversation: "会話を選択",
      untitled: "無題の会話",
      archivedPrefix: "［アーカイブ］",
      new: "新規",
      showAllConversations: "すべての会話",
      filterSlotOnly: "この対象のみ",
      assistOpening: "準備中",
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
      errGlobalBudget: "global-budget",
      errDailyLimit: "daily-limit",
      errJobInProgress: "in-progress",
      errRate: "rate",
      errUnavailable: "off",
      errSend: "send fail",
      errJobTimeout: "timeout",
      deleteConfirm: "confirm?",
      aiUnavailableShort: "AIオフ",
      assistRefProfile: "参照：My Career · プロフィール",
      assistScopeProfile: "対象：自己PR・職務要約・活かせる経験",
      assistRefProject: "参照：My Career · プロジェクト",
      assistScopeProject: "対象：概要・担当フェーズ・業務内容・実績",
      assistRefEmployer: "参照：My Career · 職歴",
      assistScopeEmployer: "対象：叙述",
      assistRefLegacyProfile: "参照：My Career · プロフィール",
      assistScopeLegacySelfPr: "対象：自己PR",
      assistScopeLegacyJobSummary: "対象：職務要約",
      assistScopeLegacyOverview: "対象：概要",
      composerExpand: "拡大",
      composerCollapse: "縮小",
      composerExpandAria: "入力欄を拡大",
      composerCollapseAria: "入力欄を縮小",
      composerResizeAria: "入力欄の高さをドラッグで調整",
    };
    return map[key] ?? key;
  },
}));

const api = vi.hoisted(() => ({
  fetchAiStatus: vi.fn(async () => ({ enabled: true, provider: "mock" })),
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  ensureAssistConversation: vi.fn(),
  rebindAssistConversation: vi.fn(),
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
  onApply: (text: string) => boolean;
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
            recordId: "11111111-1111-4111-8111-111111111111",
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
            recordId: null,
            clientDraftKey: "22222222-2222-4222-8222-222222222222",
            draftSnapshot: "新規概要",
            limitedContext: true,
            getCurrentDraft: () => "新規概要",
            onApplyToDraft: onApply,
          })
        }
      >
        open new project
      </button>
      <button
        type="button"
        data-testid="open-profile-module"
        onClick={() =>
          void openWithAssist({
            target: { type: "profile", section: "module" },
            draftText: "【添削対象:self_pr】\nPR\n",
            feature: "profile_module_refine",
            fieldKey: "profile_module",
            draftSnapshot: "self_pr\0PR",
            applyMode: "multi",
            allowedFieldIds: ["self_pr", "job_summary", "strengths"],
            getCurrentDraft: () => "self_pr\0PR",
            getCurrentDrafts: () => ({
              self_pr: "PR",
              job_summary: "",
              strengths: "",
            }),
            onApplyFields: () => true,
            onApplyToDraft: onApply,
          })
        }
      >
        open profile module
      </button>
      <button
        type="button"
        data-testid="open-project-module"
        onClick={() =>
          void openWithAssist({
            target: {
              type: "career_project",
              id: "33333333-3333-4333-8333-333333333333",
            },
            draftText: "【添削対象:overview】\n概要\n",
            feature: "career_project_refine",
            fieldKey: "project_module",
            recordId: "33333333-3333-4333-8333-333333333333",
            draftSnapshot: "overview\0概要",
            applyMode: "multi",
            allowedFieldIds: [
              "overview",
              "phases",
              "responsibilities",
              "results",
            ],
            getCurrentDraft: () => "overview\0概要",
            getCurrentDrafts: () => ({
              overview: "概要",
              phases: "",
              responsibilities: "",
              results: "",
            }),
            onApplyFields: () => true,
            onApplyToDraft: onApply,
          })
        }
      >
        open project module
      </button>
      <AiSidebar />
    </>
  );
}

describe("AI assist bridge + apply-to-draft", () => {
  const draftRef = { current: "未保存の自己PR" };
  const onApply = vi.fn(() => true);

  beforeEach(() => {
    pathnameRef.current = "/ja/profile";
    draftRef.current = "未保存の自己PR";
    onApply.mockReset();
    onApply.mockImplementation(() => true);
    api.fetchAiStatus.mockResolvedValue({ enabled: true, provider: "mock" });
    const convBySlot = new Map<
      string,
      {
        id: string;
        title: null;
        status: "active";
        pinnedTarget: unknown;
        assistSlotKey: string;
        createdAt: string;
        updatedAt: string;
        deletedAt: null;
      }
    >();
    api.listConversations.mockImplementation(
      async (opts?: { assistSlotKey?: string; unslotted?: boolean }) => {
        if (opts?.unslotted) {
          return {
            conversations: [],
            pagination: { limit: 50, offset: 0, total: 0 },
          };
        }
        if (opts?.assistSlotKey) {
          const row = convBySlot.get(opts.assistSlotKey);
          return {
            conversations: row ? [row] : [],
            pagination: { limit: 50, offset: 0, total: row ? 1 : 0 },
          };
        }
        return {
          conversations: [...convBySlot.values()],
          pagination: { limit: 50, offset: 0, total: convBySlot.size },
        };
      },
    );
    api.createConversation.mockResolvedValue({
      conversation: {
        id: "conv-1",
        title: null,
        status: "active",
        pinnedTarget: null,
        assistSlotKey: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      },
    });
    api.ensureAssistConversation.mockImplementation(
      async (body: { assistSlotKey: string; pinnedTarget: unknown }) => {
        const id =
          body.assistSlotKey.includes("job_summary")
            ? "conv-job"
            : body.assistSlotKey.includes("career_employer")
              ? "conv-emp"
              : body.assistSlotKey.includes("career_project")
                ? "conv-proj"
                : "conv-1";
        const row = {
          id,
          title: null as null,
          status: "active" as const,
          pinnedTarget: body.pinnedTarget,
          assistSlotKey: body.assistSlotKey,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null as null,
        };
        convBySlot.set(body.assistSlotKey, row);
        return { conversation: row, created: true };
      },
    );
    api.listMessages.mockResolvedValue({
      messages: [],
      pagination: { limit: 100, offset: 0, total: 0 },
    });
    api.enqueueJob.mockImplementation(async (body: { clientRequestId: string; conversationId?: string }) => ({
      job: {
        id: "job-1",
        conversationId: body.conversationId ?? "conv-1",
        status: "succeeded",
        feature: "self_pr_refine",
      },
      userMessageId: "um-1",
      replayed: false,
      _clientRequestId: body.clientRequestId,
    }));
    api.listMessages.mockImplementation(async (conversationId?: string) => {
      const last = api.enqueueJob.mock.calls.at(-1)?.[0] as
        | { clientRequestId?: string; content?: string; conversationId?: string }
        | undefined;
      const clientRequestId = last?.clientRequestId ?? "missing";
      const cid = conversationId ?? last?.conversationId ?? "conv-1";
      const refined = `${REFINE_RESULT_START}\n改善済みPR\n${REFINE_RESULT_END}\n【補足】数字があれば追記を`;
      return {
        messages: [
          {
            id: "u1",
            conversationId: cid,
            role: "user",
            content: last?.content ?? "x",
            clientMessageId: clientRequestId,
            createdAt: new Date().toISOString(),
          },
          {
            id: "a1",
            conversationId: cid,
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
    expect(screen.getByTestId("ai-assist-context")).toBeInTheDocument();
    expect(screen.getByTestId("ai-assist-ref")).toHaveTextContent(
      "参照：My Career · プロフィール",
    );
    expect(screen.getByTestId("ai-assist-scope")).toHaveTextContent(
      "対象：自己PR",
    );
    expect(screen.queryByTestId("ai-context-ref")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-context-adjuster")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-target-select")).not.toBeInTheDocument();
    expect(api.enqueueJob).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(api.ensureAssistConversation).toHaveBeenCalled(),
    );
    expect(api.ensureAssistConversation.mock.calls[0][0].assistSlotKey).toBe(
      "refine:profile:self_pr",
    );
    await waitFor(() =>
      expect(screen.getByTestId("ai-sidebar-panel")).toHaveAttribute(
        "data-active-conversation-id",
        "conv-1",
      ),
    );
  });

  it("hides focus adjuster and shows module scope for profile/project module", async () => {
    renderHarness();
    fireEvent.click(screen.getByTestId("open-profile-module"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-assist-scope")).toHaveTextContent(
        "対象：自己PR・職務要約・活かせる経験",
      ),
    );
    expect(screen.getByTestId("ai-assist-ref")).toHaveTextContent(
      "参照：My Career · プロフィール",
    );
    expect(screen.queryByTestId("ai-target-select")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-context-adjuster")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("open-project-module"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-assist-scope")).toHaveTextContent(
        "対象：概要・担当フェーズ・業務内容・実績",
      ),
    );
    expect(screen.getByTestId("ai-assist-ref")).toHaveTextContent(
      "参照：My Career · プロジェクト",
    );
    expect(screen.queryByTestId("ai-target-select")).not.toBeInTheDocument();
  });

  it("keeps draft when toggling composer expand/collapse", async () => {
    renderHarness();
    fireEvent.click(screen.getByTestId("open-profile-module"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-composer-input")).toBeInTheDocument(),
    );
    const longDraft = "長い下書き\n".repeat(20);
    fireEvent.change(screen.getByTestId("ai-composer-input"), {
      target: { value: longDraft },
    });
    const expand = screen.getByTestId("ai-composer-expand");
    expect(expand).toHaveAttribute("aria-pressed", "false");
    expect(expand).toHaveAttribute("aria-label", "入力欄を拡大");
    fireEvent.click(expand);
    expect(expand).toHaveAttribute("aria-pressed", "true");
    expect(expand).toHaveAttribute("aria-label", "入力欄を縮小");
    expect(screen.getByTestId("ai-composer-input")).toHaveAttribute(
      "data-expanded",
      "true",
    );
    expect(screen.getByTestId("ai-composer-input")).toHaveValue(longDraft);
    fireEvent.click(expand);
    expect(expand).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("ai-composer-input")).toHaveAttribute(
      "data-expanded",
      "false",
    );
    expect(screen.getByTestId("ai-composer-input")).toHaveValue(longDraft);
    expect(api.enqueueJob).not.toHaveBeenCalled();
  });

  it("uses independent conversation ids for different fields", async () => {
    renderHarness();
    fireEvent.click(screen.getByTestId("open-self-pr"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-sidebar-panel")).toHaveAttribute(
        "data-active-conversation-id",
        "conv-1",
      ),
    );
    fireEvent.click(screen.getByTestId("open-employer"));
    await waitFor(() =>
      expect(api.ensureAssistConversation.mock.calls.length).toBeGreaterThan(1),
    );
    const slots = api.ensureAssistConversation.mock.calls.map(
      (c) => c[0].assistSlotKey as string,
    );
    expect(slots).toContain("refine:profile:self_pr");
    expect(slots).toContain(
      "refine:career_employer:11111111-1111-4111-8111-111111111111",
    );
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
    expect(screen.getByTestId("ai-assist-ref")).toHaveTextContent(
      "参照：My Career · 職歴",
    );
    expect(screen.getByTestId("ai-assist-scope")).toHaveTextContent("対象：叙述");
    expect(screen.queryByTestId("ai-target-select")).not.toBeInTheDocument();
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
    expect(screen.getByTestId("ai-assist-scope")).toHaveTextContent("対象：概要");
    expect(screen.queryByTestId("ai-context-ref")).not.toBeInTheDocument();
  });

  it("module send uses AssistSession target, not stale suggestion target", async () => {
    renderHarness();
    // Open general chat and pick a suggestion that sets profile:self_pr, then open module assist.
    fireEvent.click(screen.getByTestId("ai-sidebar-toggle"));
    await waitFor(() => expect(api.listConversations).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId("ai-suggest-self_pr"));
    expect(screen.getByTestId("ai-context-ref")).toHaveTextContent("参照：My Career");
    expect(screen.queryByTestId("ai-assist-context")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ai-target-select")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("open-profile-module"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-assist-context")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("ai-assist-ref")).toHaveTextContent(
      "参照：My Career · プロフィール",
    );
    expect(screen.queryByTestId("ai-target-select")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("ai-composer-input"), {
      target: { value: "自己PRだけを添削してください" },
    });
    fireEvent.click(screen.getByTestId("ai-composer-send"));
    await waitFor(() => expect(api.enqueueJob).toHaveBeenCalled());
    const body = api.enqueueJob.mock.calls.at(-1)![0] as {
      targetContext: { type: string; section?: string };
      feature?: string;
    };
    expect(body.targetContext).toEqual({ type: "profile", section: "module" });
    expect(body.feature).toBe("profile_module_refine");
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
