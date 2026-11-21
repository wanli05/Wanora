import type { StageKind } from "@/lib/progress/enums";

export type MockPrepQuestion = {
  id: string;
  /** Japanese question shown to the user. */
  question: string;
  /** Why the interviewer asks this. */
  intent: string;
  /** Bullet-style answer tips (Japanese). */
  points: string[];
  /** Full sample answer revealed on demand (Japanese). */
  sampleAnswer: string;
};

const COMMON: MockPrepQuestion[] = [
  {
    id: "common-motivation",
    question: "志望動機を教えてください。",
    intent:
      "応募理由の具体性と、自社・職種への理解度を確認するためです。",
    points: [
      "会社・職種を選んだ理由を事実ベースで述べる",
      "自分の経験と募集要件の接点を一つ示す",
      "入社後に取り組みたいことを短く添える",
    ],
    sampleAnswer:
      "貴社のプロダクトが現場の業務課題に直結している点に共感し、応募しました。前職では業務フローの改善に関わり、要件整理から関係者調整まで担当してきました。募集要件にある課題解決と関係者との協働に活かせると考えています。入社後はまず既存フローを理解し、小さな改善から貢献したいです。",
  },
  {
    id: "common-self-pr",
    question: "自己紹介と強みを教えてください。",
    intent: "経歴の要約力と、役割で再現できる強みがあるかを見るためです。",
    points: [
      "職歴は年代順ではなく成果の軸で短くまとめる",
      "強みは具体的な行動・結果とセットで話す",
      "応募職種でどう活きるかに一言つなげる",
    ],
    sampleAnswer:
      "これまでバックエンド寄りの開発と、チーム内の要件整理を担当してきました。強みは曖昧な依頼を分解し、優先度を合意したうえで着実に進めることです。たとえば期限の厳しい改修では、影響範囲を先に洗い出し、関係者と範囲を確定してから実装し、予定どおりリリースできました。同様に貴社でも、要件の整理から実装まで一貫して貢献したいです。",
  },
  {
    id: "common-failure",
    question: "これまでの失敗や学びを教えてください。",
    intent: "振り返りの深さ、責任の取り方、再発防止の具体性を確認するためです。",
    points: [
      "失敗の事実を簡潔に述べ、言い訳にしない",
      "自分が取った行動と学びを分ける",
      "その後の仕組み・習慣の変化まで話す",
    ],
    sampleAnswer:
      "一度、仕様の前提を十分確認せずに実装を進め、結合テストで手戻りが発生しました。原因は認識合わせの不足でした。以降は着手前に前提と完了条件を文書化し、関係者に確認してから実装する運用に変え、同種の手戻りを減らせました。貴社でも早期の認識合わせを大切にしたいです。",
  },
];

const BY_KIND: Partial<Record<StageKind, MockPrepQuestion[]>> = {
  info_session: [
    {
      id: "info-company",
      question: "本日の説明会で特に知りたいことは何ですか。",
      intent: "能動的な関心と、情報収集の目的意識を見るためです。",
      points: [
        "仕事内容・チーム・成長機会のいずれかに焦点を当てる",
        "公開情報で分かったことと、まだ知りたいことを区別する",
      ],
      sampleAnswer:
        "公開情報からプロダクトの方向性は理解しました。本日は、配属後の最初の三か月で期待される役割と、チーム内でのキャッチアップの進め方を具体的に伺いたいです。",
    },
    ...COMMON.slice(0, 2),
  ],
  casual_meeting: [
    {
      id: "casual-interest",
      question: "カジュアル面談で聞きたいことを教えてください。",
      intent: "相互理解の姿勢と、関心の具体性を確認するためです。",
      points: [
        "キャリアの方向性と会社の接点を一つ挙げる",
        "一方的な自己 PR にせず、質問も用意する",
      ],
      sampleAnswer:
        "自分の経験が貴社の課題にどう合うかを率直に伺いたいです。あわせて、チームの働き方や意思決定の進め方も知り、双方の期待値を揃えられればと考えています。",
    },
    ...COMMON.slice(0, 2),
  ],
  interview_1: [
    ...COMMON,
    {
      id: "i1-role",
      question: "この職種で最初の半年間に取り組みたいことは何ですか。",
      intent: "現実的なオンボーディング意識と、貢献イメージの具体性を見るためです。",
      points: [
        "学習と貢献のバランスを示す",
        "大きな成果より再現可能な一歩を述べる",
      ],
      sampleAnswer:
        "最初の一か月は既存の仕組みと用語を優先して学び、小さなチケットから品質を安定させたいです。その後、担当領域で改善提案を一つ出し、チームの負荷を減らす形で貢献したいと考えています。",
    },
  ],
  interview_2: [
    ...COMMON,
    {
      id: "i2-conflict",
      question: "意見が分かれたとき、どう合意形成しましたか。",
      intent: "対立時のコミュニケーションと、意思決定の進め方を確認するためです。",
      points: [
        "対立の論点を事実で整理する",
        "相手の制約を理解したうえで案を出す",
        "合意後のフォローまで話す",
      ],
      sampleAnswer:
        "リリース範囲で意見が割れた際、まずリスクと期限の制約を共有し、必須・任意を表に分けました。合意後は進捗を短く共有し、認識ズレが再発しないよう確認点を残しました。",
    },
  ],
  interview_final: [
    ...COMMON,
    {
      id: "final-offer",
      question: "内定が出た場合、入社意思はどの程度ですか。",
      intent: "選考意欲と、比較検討の状況を正直に把握するためです。",
      points: [
        "現時点の温度感を正直に述べる",
        "判断軸（業務・成長・条件など）を短く示す",
        "虚偽の確約はしない",
      ],
      sampleAnswer:
        "現時点では前向きに検討しています。判断軸は業務内容との適合と、入社後の成長機会です。他社選考もありますが、本日の内容を踏まえて優先度を整理したいです。",
    },
  ],
};

const FALLBACK = COMMON;

/** Fixed demo questions for a stage kind. Never calls LLM / Gateway. */
export function mockQuestionsForStage(
  stageKind: StageKind | null | undefined,
): MockPrepQuestion[] {
  if (!stageKind) return FALLBACK;
  return BY_KIND[stageKind] ?? FALLBACK;
}

export function findMockQuestion(
  stageKind: StageKind | null | undefined,
  questionId: string,
): MockPrepQuestion | null {
  return (
    mockQuestionsForStage(stageKind).find((item) => item.id === questionId) ??
    null
  );
}

/** Artificial delay for loading UI — local only, no network. */
export const MOCK_ANSWER_DELAY_MS = 450;
