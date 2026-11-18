import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiAssistProvider,
  useAiAssist,
} from "@/components/ai-sidebar/ai-assist-context";
import {
  canApplyToProfileDraft,
  canApplyToRecordDraft,
} from "@/components/ai-sidebar/assist-apply-guard";
import { AiRefineButton } from "@/components/ai-sidebar/ai-refine-button";
import { AiSidebar } from "@/components/ai-sidebar/ai-sidebar";
import {
  REFINE_RESULT_END,
  REFINE_RESULT_START,
} from "@/components/ai-sidebar/refine-prompts";
import { useLiveRef } from "@/components/ai-sidebar/use-live-ref";

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
      applyRejectedStale: "対象が変わったため反映できません",
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

const EMP_A = "11111111-1111-4111-8111-111111111111";
const EMP_B = "22222222-2222-4222-8222-222222222222";
const PROJ_A = "33333333-3333-4333-8333-333333333333";
const PROJ_B = "44444444-4444-4444-8444-444444444444";

/** Production-isomorphic profile draft: synced refs + mount/editor guards. */
function ProfileDraftForm({
  onSave,
}: {
  onSave?: (fd: FormData) => void;
}) {
  const [editing, setEditing] = useState(true);
  const [selfPrJa, setSelfPrJa] = useState("草稿A");
  const editingRef = useLiveRef(editing);
  const selfPrJaRef = useLiveRef(selfPrJa);
  const mountedRef = useRef(true);
  const assist = useAiAssist();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      assist.invalidateAssistApply();
    };
  }, [assist]);

  if (!editing) {
    return (
      <button
        type="button"
        data-testid="reopen-profile"
        onClick={() => setEditing(true)}
      >
        reopen
      </button>
    );
  }

  return (
    <form
      data-testid="profile-draft-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave?.(new FormData(e.currentTarget));
      }}
    >
      <AiRefineButton
        fieldKey="selfPr_ja"
        draftText={selfPrJa}
        getCurrentDraft={() => selfPrJaRef.current}
        onApplyToDraft={(text) => {
          if (
            !canApplyToProfileDraft({
              mounted: mountedRef.current,
              editorOpen: editingRef.current,
            })
          ) {
            return false;
          }
          setSelfPrJa(text);
          return true;
        }}
      />
      <textarea
        name="selfPr_ja"
        data-testid="live-self-pr"
        value={selfPrJa}
        onChange={(e) => setSelfPrJa(e.target.value)}
      />
      <button type="button" data-testid="close-profile" onClick={() => {
        assist.invalidateAssistApply();
        setEditing(false);
      }}>
        close
      </button>
      <button type="submit" data-testid="save-profile">
        save
      </button>
    </form>
  );
}

type Row = { id: string; text: string };

function RecordDraftForm({
  kind,
  rows,
  fieldKey,
  onSave,
}: {
  kind: "employer" | "project";
  rows: [Row, Row];
  fieldKey: "narrative_ja" | "overview_ja";
  onSave?: (fd: FormData) => void;
}) {
  const [editing, setEditing] = useState<Row | null>(rows[0]);
  const editingRef = useLiveRef(editing);
  const mountedRef = useRef(true);
  const assist = useAiAssist();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      assist.invalidateAssistApply();
    };
  }, [assist]);

  function openRow(row: Row) {
    if (editingRef.current?.id !== row.id) {
      assist.invalidateAssistApply();
    }
    setEditing(row);
  }

  return (
    <div>
      <button type="button" data-testid="open-row-a" onClick={() => openRow(rows[0])}>
        open A
      </button>
      <button type="button" data-testid="open-row-b" onClick={() => openRow(rows[1])}>
        open B
      </button>
      <button
        type="button"
        data-testid="close-editor"
        onClick={() => {
          assist.invalidateAssistApply();
          setEditing(null);
        }}
      >
        close
      </button>
      {editing ? (
        <form
          key={editing.id}
          data-testid={`${kind}-form`}
          onSubmit={(e) => {
            e.preventDefault();
            onSave?.(new FormData(e.currentTarget));
          }}
        >
          <input type="hidden" name="id" value={editing.id} />
          <AiRefineButton
            fieldKey={fieldKey}
            draftText={editing.text}
            recordId={editing.id}
            testId={`ai-refine-${fieldKey}`}
            getCurrentDraft={() => editingRef.current?.text ?? ""}
            onApplyToDraft={(text) => {
              const expectedRecordId = editing.id;
              if (
                !canApplyToRecordDraft({
                  mounted: mountedRef.current,
                  editorOpen: editingRef.current != null,
                  currentRecordId: editingRef.current?.id,
                  expectedRecordId,
                })
              ) {
                return false;
              }
              setEditing((prev) => {
                if (
                  !prev ||
                  !canApplyToRecordDraft({
                    mounted: true,
                    editorOpen: true,
                    currentRecordId: prev.id,
                    expectedRecordId,
                  })
                ) {
                  return prev;
                }
                return { ...prev, text };
              });
              return true;
            }}
          />
          <textarea
            name={fieldKey}
            data-testid={`live-${fieldKey}`}
            value={editing.text}
            onChange={(e) =>
              setEditing((prev) =>
                prev ? { ...prev, text: e.target.value } : prev,
              )
            }
          />
          <span data-testid="current-record-id">{editing.id}</span>
          <button type="submit" data-testid="save-record">
            save
          </button>
        </form>
      ) : (
        <p data-testid="editor-closed">closed</p>
      )}
    </div>
  );
}

describe("AI assist apply safety (production-isomorphic)", () => {
  beforeEach(() => {
    pathnameRef.current = "/ja/profile";
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
      const refined = `${REFINE_RESULT_START}\n改善済みPR\n${REFINE_RESULT_END}`;
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
      job: { id: "job-1", conversationId: "conv-1", status: "succeeded" },
    });
    api.readPendingJob.mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  async function sendAndWaitApply() {
    fireEvent.click(screen.getByTestId("ai-composer-send"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-apply-to-draft")).toBeInTheDocument(),
    );
  }

  it("confirms overwrite when live controlled draft changed after open", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <AiAssistProvider>
        <ProfileDraftForm />
        <AiSidebar />
      </AiAssistProvider>,
    );

    fireEvent.click(screen.getByTestId("ai-refine-selfPr_ja"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-composer-input")).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByTestId("live-self-pr"), {
      target: { value: "草稿B" },
    });
    await sendAndWaitApply();
    fireEvent.click(screen.getByTestId("ai-apply-to-draft"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByTestId("live-self-pr")).toHaveValue("草稿B");

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByTestId("ai-apply-to-draft"));
    expect(screen.getByTestId("live-self-pr")).toHaveValue("改善済みPR");
  });

  it("rejects apply after switching employer A → B and keeps B", async () => {
    render(
      <AiAssistProvider>
        <RecordDraftForm
          kind="employer"
          fieldKey="narrative_ja"
          rows={[
            { id: EMP_A, text: "叙述A" },
            { id: EMP_B, text: "叙述B" },
          ]}
        />
        <AiSidebar />
      </AiAssistProvider>,
    );

    fireEvent.click(screen.getByTestId("ai-refine-narrative_ja"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-composer-input")).toBeInTheDocument(),
    );
    await sendAndWaitApply();

    fireEvent.click(screen.getByTestId("open-row-b"));
    expect(screen.getByTestId("current-record-id")).toHaveTextContent(EMP_B);
    expect(screen.getByTestId("live-narrative_ja")).toHaveValue("叙述B");

    // Apply permission revoked on switch — button gone.
    expect(screen.queryByTestId("ai-apply-to-draft")).not.toBeInTheDocument();
    expect(screen.getByTestId("current-record-id")).toHaveTextContent(EMP_B);
    expect(screen.getByTestId("live-narrative_ja")).toHaveValue("叙述B");
  });

  it("rejects apply after switching project A → B", async () => {
    render(
      <AiAssistProvider>
        <RecordDraftForm
          kind="project"
          fieldKey="overview_ja"
          rows={[
            { id: PROJ_A, text: "概要A" },
            { id: PROJ_B, text: "概要B" },
          ]}
        />
        <AiSidebar />
      </AiAssistProvider>,
    );

    fireEvent.click(screen.getByTestId("ai-refine-overview_ja"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-composer-input")).toBeInTheDocument(),
    );
    await sendAndWaitApply();
    fireEvent.click(screen.getByTestId("open-row-b"));
    expect(screen.queryByTestId("ai-apply-to-draft")).not.toBeInTheDocument();
    expect(screen.getByTestId("current-record-id")).toHaveTextContent(PROJ_B);
    expect(screen.getByTestId("live-overview_ja")).toHaveValue("概要B");
  });

  it("invalidates apply when editor closes before reply is used", async () => {
    render(
      <AiAssistProvider>
        <ProfileDraftForm />
        <AiSidebar />
      </AiAssistProvider>,
    );
    fireEvent.click(screen.getByTestId("ai-refine-selfPr_ja"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-composer-input")).toBeInTheDocument(),
    );
    await sendAndWaitApply();
    fireEvent.click(screen.getByTestId("close-profile"));
    expect(screen.queryByTestId("ai-apply-to-draft")).not.toBeInTheDocument();
    expect(screen.getByTestId("reopen-profile")).toBeInTheDocument();
  });

  it("save FormData includes applied AI draft for the same record only", async () => {
    const saved: FormData[] = [];
    render(
      <AiAssistProvider>
        <ProfileDraftForm onSave={(fd) => saved.push(fd)} />
        <AiSidebar />
      </AiAssistProvider>,
    );
    fireEvent.click(screen.getByTestId("ai-refine-selfPr_ja"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-composer-input")).toBeInTheDocument(),
    );
    await sendAndWaitApply();
    fireEvent.click(screen.getByTestId("ai-apply-to-draft"));
    expect(screen.getByTestId("live-self-pr")).toHaveValue("改善済みPR");
    expect(api.enqueueJob).toHaveBeenCalled();
    // Apply must not trigger a career save action — only enqueue for AI.
    fireEvent.click(screen.getByTestId("save-profile"));
    expect(saved).toHaveLength(1);
    expect(saved[0].get("selfPr_ja")).toBe("改善済みPR");
  });

  it("employer save after apply keeps matching id and narrative", async () => {
    const saved: FormData[] = [];
    render(
      <AiAssistProvider>
        <RecordDraftForm
          kind="employer"
          fieldKey="narrative_ja"
          rows={[
            { id: EMP_A, text: "叙述A" },
            { id: EMP_B, text: "叙述B" },
          ]}
          onSave={(fd) => saved.push(fd)}
        />
        <AiSidebar />
      </AiAssistProvider>,
    );
    fireEvent.click(screen.getByTestId("ai-refine-narrative_ja"));
    await waitFor(() =>
      expect(screen.getByTestId("ai-composer-input")).toBeInTheDocument(),
    );
    await sendAndWaitApply();
    fireEvent.click(screen.getByTestId("ai-apply-to-draft"));
    expect(screen.getByTestId("live-narrative_ja")).toHaveValue("改善済みPR");
    fireEvent.click(screen.getByTestId("save-record"));
    expect(saved[0].get("id")).toBe(EMP_A);
    expect(saved[0].get("narrative_ja")).toBe("改善済みPR");
  });
});
