import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MyCareerCenter, type MyCareerLabels } from "./my-career-center";
import type { ExportSnapshot } from "@/lib/domain/export-snapshot";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/components/profile-page-form", () => ({
  ProfilePageForm: () => <div>profile-form</div>,
}));

vi.mock("@/lib/career-actions", () => ({
  saveCareerProfileExtrasAction: vi.fn(async () => ({ ok: true })),
  saveCareerEmployerAction: vi.fn(async () => ({ ok: true })),
  saveCareerProjectAction: vi.fn(async () => ({ ok: true })),
  saveCareerSkillAction: vi.fn(async () => ({ ok: true })),
  saveCareerGoalAction: vi.fn(async () => ({ ok: true })),
  deleteCareerEmployerAction: vi.fn(),
  deleteCareerProjectAction: vi.fn(),
  deleteCareerSkillAction: vi.fn(),
  deleteCareerGoalAction: vi.fn(),
  confirmPendingProjectAction: vi.fn(),
}));

const labels: MyCareerLabels = {
  modules: {
    profile: "プロフィール",
    work: "職歴",
    projects: "プロジェクト",
    skills: "スキル",
    goals: "目標",
    timeline: "タイムライン",
    export: "导出",
  },
  save: "保存",
  add: "追加",
  remove: "削除",
  edit: "編集",
  cancel: "キャンセル",
  saved: "saved",
  errors: {
    unauthenticated: "auth",
    invalid: "invalid",
    saveFailed: "fail",
  },
  profileBanner: "banner",
  workSub: "work",
  projectsSub: "projects",
  projectsPendingHint: "pending hint",
  confirmDraft: "confirm",
  skillsSub: "skills",
  goalsSub: "goals",
  goalShort: "short",
  goalLong: "long",
  timelineSub: "timeline",
  exportSub: "export",
  exportRireki: "履歴書",
  exportShokumu: "職務経歴書",
  exportPrint: "print",
  residence: "在留",
  salary: "給与",
  languages: "語学",
  titleUrl: "url",
  pendingBadge: "pending",
  snapshotTitle: "snapshot",
  snapProjects: "projects",
  snapSkills: "skills",
  snapHope: "hope",
  recentTitle: "recent",
  recentSub: "recent sub",
  resumeSectionTitle: "resume",
  resumeSectionSub: "resume sub",
  fields: {
    headline: "headline",
    directionTags: "tags",
    selfPr: "pr",
    jobSummary: "summary",
    strengths: "strengths",
    residenceStatus: "status",
    residencePeriod: "period",
    residenceUntil: "until",
    salaryAnnual: "annual",
    salaryBonus: "bonus",
    salaryMonthly: "monthly",
    salaryOvertime: "ot",
    salaryHope: "hope salary",
    personalHope: "personal",
    language: "lang",
    level: "level",
    addLanguage: "add lang",
  },
};

const emptySnapshot: ExportSnapshot = {
  asOfRirekisho: "2026　年　11月　13日現在",
  asOfShokumu: "2026年11月13日現在",
  fullName: "テスト",
  fullNameKana: "",
  birthLine: "",
  gender: "",
  addressKana: "",
  address: "",
  postalCode: "",
  phone: "",
  email: "",
  educationLines: [],
  workLines: [],
  licenseLines: [],
  residenceLines: [],
  salaryLines: [],
  languages: [],
  personalHope: "",
  jobCareerLine: "",
  jobSummary: "",
  strengths: [],
  employers: [],
  projects: [],
  skillRows: [],
  selfPr: "",
  selfStudyLinks: [],
};

describe("MyCareerCenter", () => {
  it("renders six module nav plus export", () => {
    render(
      <MyCareerCenter
        labels={labels}
        profileForm={{
          initial: {
            fullName: { ja: "山田" },
            fullNameKana: "",
            birthDate: "",
            age: null,
            gender: {},
            postalCode: "",
            dateFormat: "wareki",
            address: {},
            addressKana: "",
            phone: "",
            email: "",
            altContact: {},
            education: [],
            workHistory: [],
            licenses: [],
            storageReady: false,
          },
          labels: {
            edit: "e",
            save: "s",
            addRow: "a",
            removeRow: "r",
            savedMessage: "ok",
            errorMessages: {
              unauthenticated: "",
              fullNameRequired: "",
              invalidEmail: "",
              invalidDateFormat: "",
              saveFailed: "",
            },
            sections: {
              basic: "",
              education: "",
              workHistory: "",
              licenses: "",
            },
            basic: {
              fullName: "",
              fullNameKana: "",
              birthDate: "",
              ageSuffix: "",
              gender: "",
              postalCode: "",
              dateFormat: "",
              dateFormatWareki: "",
              dateFormatSeireki: "",
              address: "",
              addressKana: "",
              phone: "",
              email: "",
              altContact: "",
            },
            japaneseHint: "",
            education: { empty: "", school: "", event: "", yearMonth: "" },
            workHistory: {
              empty: "",
              workContent: "",
              event: "",
              yearMonth: "",
            },
            licenses: { empty: "", name: "", yearMonth: "" },
            events: {
              education: {
                enrolled: "",
                graduated: "",
                withdrawn: "",
                completed: "",
              },
              workHistory: { joined: "", left: "", transferred: "" },
            },
          },
        }}
        extras={{
          headline: "",
          directionTags: "",
          selfPrJa: "",
          jobSummaryJa: "",
          strengthsText: "",
          languages: [],
          residenceStatus: "",
          residencePeriod: "",
          residenceUntil: "",
          salaryAnnualMan: "",
          salaryBonusMan: "",
          salaryMonthlyMan: "",
          salaryOvertimeMan: "",
          salaryHope: "",
          personalHopeJa: "",
        }}
        employers={[]}
        projects={[]}
        skills={[]}
        goals={[]}
        licenses={[]}
        timeline={[]}
        exportSnapshot={emptySnapshot}
      />,
    );

    expect(screen.getByText("プロフィール")).toBeInTheDocument();
    expect(screen.getByText("プロジェクト")).toBeInTheDocument();
    expect(screen.getByText("タイムライン")).toBeInTheDocument();
    expect(screen.getByText("导出")).toBeInTheDocument();
    expect(screen.getByText("banner")).toBeInTheDocument();
    expect(screen.getByText("在留")).toBeInTheDocument();
    expect(screen.getByText("給与")).toBeInTheDocument();
    expect(screen.getByText("山田")).toBeInTheDocument();
    expect(document.querySelector(".mc-identity")).not.toBeNull();
    expect(document.querySelector(".mc-meta-grid")).not.toBeNull();
    expect(document.querySelector(".mc-resume-wrap")).not.toBeNull();
  });
});
