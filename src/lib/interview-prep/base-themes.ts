/**
 * System-level interview-prep base themes (Phase 2A).
 * Stable template ids — not user-visible Japanese titles.
 * Never calls LLM / Gateway.
 */

export type PrepAnswerKind = "text" | "dual_experience" | "reverse_qa_list";

export type PrepBaseTheme = {
  id: string;
  /** Japanese title shown in the list. */
  title: string;
  /** Short prep guidance (not a mock full answer). */
  guidance: string;
  answerKind: PrepAnswerKind;
};

/** Exactly seven fixed themes for every application / round. */
export const PREP_BASE_THEMES: readonly PrepBaseTheme[] = [
  {
    id: "base-self-intro",
    title: "自己紹介",
    guidance:
      "経歴の要約と、面接官が把握すべき役割・強みを1〜2分で話せるように整理します。",
    answerKind: "text",
  },
  {
    id: "base-self-pr",
    title: "自己PR",
    guidance:
      "再現できる強みを、具体的な行動と結果とセットで伝えられるように準備します。",
    answerKind: "text",
  },
  {
    id: "base-career-change",
    title: "転職理由",
    guidance:
      "転職の動機を前向きかつ事実ベースで整理し、応募先との接点につなげます。",
    answerKind: "text",
  },
  {
    id: "base-motivation",
    title: "志望動機",
    guidance:
      "企業・職種を選んだ理由と、自分の経験の接点、入社後に取り組みたいことを短くまとめます。",
    answerKind: "text",
  },
  {
    id: "base-career-design",
    title: "キャリアデザイン",
    guidance:
      "短期・中長期の方向性と、この応募がキャリア上で果たす役割を整理します。",
    answerKind: "text",
  },
  {
    id: "base-success-failure",
    title: "成功体験・失敗体験",
    guidance:
      "成功と失敗を分けて準備します。事実・自分の行動・学びを混同しないようにします。",
    answerKind: "dual_experience",
  },
  {
    id: "base-reverse-qa",
    title: "逆質問",
    guidance:
      "面接官に聞きたい質問を複数用意します。公開情報で分かることは避け、仕事理解を深める質問にします。",
    answerKind: "reverse_qa_list",
  },
] as const;

export function prepBaseThemes(): readonly PrepBaseTheme[] {
  return PREP_BASE_THEMES;
}

export function findPrepBaseTheme(id: string): PrepBaseTheme | null {
  return PREP_BASE_THEMES.find((theme) => theme.id === id) ?? null;
}
