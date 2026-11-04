import { midCareerStages } from "./logic";
import type { Application, Stage } from "./types";

function withCurrent(list: Stage[], currentKind: string): Stage[] {
  let reached = false;
  return list.map((stage) => {
    if (stage.status === "skipped") return stage;
    if (stage.kind === currentKind) {
      reached = true;
      return stage;
    }
    if (!reached) return { ...stage, status: "passed" as const };
    return stage;
  });
}

export const SAMPLE_APPLICATIONS: Application[] = [
  {
    id: "fujitsu",
    company: "富士通株式会社",
    role: "新卒総合職",
    platform: "マイナビ",
    recruiter: "山田花子",
    appliedAt: "2026-10-20T00:00:00+09:00",
    outcome: "in_progress",
    stages: withCurrent(
      midCareerStages("fujitsu", {
        info_session: {
          id: "fujitsu-info_session",
          kind: "info_session",
          status: "scheduled",
          interviews: [
            {
              id: "fujitsu-info",
              start: "2026-11-08T10:00:00+09:00",
              end: "2026-11-08T11:00:00+09:00",
              mode: "google_meet",
              meetingUrl: "https://meet.google.com/demo-fujitsu",
              status: "scheduled",
            },
          ],
        },
      }),
      "info_session",
    ),
  },
  {
    id: "hitachi",
    company: "株式会社日立製作所",
    role: "デジタルエンジニア",
    platform: "マイナビ",
    recruiter: "田中美咲",
    appliedAt: "2026-10-28T00:00:00+09:00",
    outcome: "in_progress",
    stages: withCurrent(midCareerStages("hitachi"), "document_screening"),
  },
  {
    id: "rakuten",
    company: "楽天グループ株式会社",
    role: "バックエンドエンジニア",
    platform: "Doda",
    recruiter: "佐藤健",
    appliedAt: "2026-10-25T00:00:00+09:00",
    outcome: "in_progress",
    stages: withCurrent(
      midCareerStages("rakuten", {
        aptitude_test: {
          id: "rakuten-aptitude_test",
          kind: "aptitude_test",
          status: "scheduled",
          deadline: "2026-11-10T23:59:00+09:00",
          interviews: [],
        },
      }),
      "aptitude_test",
    ),
  },
  {
    id: "mercari",
    company: "株式会社メルカリ",
    role: "ソフトウェアエンジニア",
    platform: "えん転職",
    recruiter: "鈴木一郎",
    appliedAt: "2026-10-22T00:00:00+09:00",
    outcome: "in_progress",
    nextPrepNote: "一次面接の逆質問を3つ用意する",
    stages: withCurrent(
      midCareerStages("mercari", {
        interview_1: {
          id: "mercari-interview_1",
          kind: "interview_1",
          status: "scheduled",
          interviews: [
            {
              id: "mercari-i1",
              start: "2026-11-12T14:00:00+09:00",
              end: "2026-11-12T15:00:00+09:00",
              mode: "google_meet",
              meetingUrl: "https://meet.google.com/abc-defg-hij",
              status: "scheduled",
            },
          ],
        },
      }),
      "interview_1",
    ),
  },
  {
    id: "cyberagent",
    company: "株式会社サイバーエージェント",
    role: "機械学習エンジニア",
    platform: "LinkedIn",
    recruiter: "高橋結衣",
    appliedAt: "2026-10-21T00:00:00+09:00",
    outcome: "in_progress",
    stages: withCurrent(
      midCareerStages("cyberagent", {
        interview_1: {
          id: "cyberagent-interview_1",
          kind: "interview_1",
          status: "scheduled",
          interviews: [
            {
              id: "cyberagent-i1",
              start: "2026-11-12T14:30:00+09:00",
              end: "2026-11-12T15:30:00+09:00",
              mode: "teams",
              meetingUrl: "https://teams.microsoft.com/l/meetup-join/demo-ca",
              status: "scheduled",
            },
          ],
        },
      }),
      "interview_1",
    ),
  },
  {
    id: "panasonic",
    company: "パナソニックホールディングス株式会社",
    role: "組込みエンジニア",
    platform: "Doda",
    recruiter: "中村翔",
    appliedAt: "2026-09-30T00:00:00+09:00",
    outcome: "in_progress",
    stages: withCurrent(
      midCareerStages("panasonic", {
        interview_2: {
          id: "panasonic-interview_2",
          kind: "interview_2",
          status: "pending",
          interviews: [],
          proposedSlots: [
            {
              id: "panasonic-s1",
              start: "2026-11-14T10:00:00+09:00",
              end: "2026-11-14T11:00:00+09:00",
            },
            {
              id: "panasonic-s2",
              start: "2026-11-15T14:00:00+09:00",
              end: "2026-11-15T15:00:00+09:00",
            },
            {
              id: "panasonic-s3",
              start: "2026-11-19T11:00:00+09:00",
              end: "2026-11-19T12:00:00+09:00",
            },
          ],
        },
      }),
      "interview_2",
    ),
  },
  {
    id: "nttdata",
    company: "株式会社NTTデータ",
    role: "クラウドエンジニア",
    platform: "えん転職",
    recruiter: "渡辺誠",
    appliedAt: "2026-10-15T00:00:00+09:00",
    outcome: "in_progress",
    stages: withCurrent(
      midCareerStages("nttdata", {
        interview_1: {
          id: "nttdata-interview_1",
          kind: "interview_1",
          status: "pending",
          interviews: [],
          proposedSlots: [
            {
              id: "nttdata-s1",
              start: "2026-11-14T15:00:00+09:00",
              end: "2026-11-14T16:00:00+09:00",
            },
            {
              id: "nttdata-s2",
              start: "2026-11-17T13:00:00+09:00",
              end: "2026-11-17T14:00:00+09:00",
            },
          ],
        },
      }),
      "interview_1",
    ),
  },
  {
    id: "recruit",
    company: "株式会社リクルート",
    role: "プロダクトマネージャー",
    platform: "企業直接応募",
    recruiter: null,
    appliedAt: "2026-09-18T00:00:00+09:00",
    outcome: "in_progress",
    stages: withCurrent(
      midCareerStages("recruit", {
        interview_final: {
          id: "recruit-interview_final",
          kind: "interview_final",
          status: "scheduled",
          interviews: [
            {
              id: "recruit-final",
              start: "2026-11-18T16:00:00+09:00",
              end: "2026-11-18T17:00:00+09:00",
              mode: "teams",
              meetingUrl: "https://teams.live.com/meet/demo-recruit",
              status: "scheduled",
            },
          ],
        },
      }),
      "interview_final",
    ),
  },
  {
    id: "toyota",
    company: "トヨタ自動車株式会社",
    role: "データサイエンティスト",
    platform: "Doda",
    recruiter: "伊藤大輔",
    appliedAt: "2026-08-12T00:00:00+09:00",
    outcome: "offer",
    offerDecision: "pending",
    stages: withCurrent(
      midCareerStages("toyota", {
        offer: {
          id: "toyota-offer",
          kind: "offer",
          status: "pending",
          deadline: "2026-11-20T23:59:00+09:00",
          interviews: [],
        },
      }),
      "offer",
    ),
  },
  {
    id: "sony-closed",
    company: "ソニーグループ株式会社",
    role: "Webエンジニア",
    platform: "マイナビ",
    recruiter: "小林愛",
    appliedAt: "2026-07-01T00:00:00+09:00",
    outcome: "rejected",
    stages: withCurrent(midCareerStages("sony"), "interview_1").map((stage) =>
      stage.kind === "interview_1" ? { ...stage, status: "failed" as const } : stage,
    ),
  },
];
