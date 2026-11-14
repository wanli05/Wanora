import { fireEvent, render, screen } from "@testing-library/react";
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

vi.mock("@/lib/profile-actions", () => ({
  saveLicenseAction: vi.fn(),
  deleteLicenseAction: vi.fn(),
}));

const labels: MyCareerLabels = {
  modules: {
    profile: "プロフィール",
    work: "職歴",
    projects: "プロジェクト",
    skills: "スキル",
    goals: "目標",
    timeline: "タイムライン",
    export: "書類出力",
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
  workSub: "work",
  projectsSub: "projects",
  projectsPendingHint: "pending hint",
  confirmDraft: "confirm",
  skillsSub: "skills",
  skillsLicensesSub: "licenses edit",
  skillsLicensesEmpty: "no licenses",
  goalsSub: "goals",
  goalShort: "short",
  goalLong: "long",
  timelineSub: "timeline",
  exportSub: "export",
  exportRireki: "履歴書",
  exportShokumu: "職務経歴書",
  exportDocx: "docx",
  exportPdf: "pdf",
  exportDownloading: "busy",
  exportFailed: "fail export",
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
  nationalityBlock: "国籍・在留",
  japaneseLocksHint: "日本国籍ロック",
  fields: {
    headline: "headline",
    headlinePlaceholder: "headline ph",
    directionTags: "tags",
    directionTagsPlaceholder: "tags ph",
    selfPr: "pr",
    jobSummary: "summary",
    strengths: "strengths",
    nationality: "nationality",
    residenceStatus: "status",
    residenceUntil: "until",
    salaryAnnual: "annual",
    salaryMonthly: "monthly",
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
  hasPhoto: false,
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
            licenses: [],
            storageReady: false,
            hasPhoto: false,
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
              photo: "",
              photoAlt: "",
              postalLookupHint: "",
              postalLookingUp: "",
              postalNotFound: "",
              postalLookupFailed: "",
              postalLineRemainderHint: "",
            },
            japaneseHint: "",
            education: { empty: "", school: "", event: "", yearMonth: "" },
            licenses: { empty: "", name: "", yearMonth: "" },
            events: {
              education: {
                enrolled: "",
                graduated: "",
                withdrawn: "",
                completed: "",
              },
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
          nationality: "",
          residenceStatus: "",
          residenceUntil: "",
          salaryAnnualMan: "",
          salaryMonthlyMan: "",
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
    expect(screen.getByText("書類出力")).toBeInTheDocument();
    expect(screen.getByText("国籍・在留")).toBeInTheDocument();
    expect(screen.getByText("給与")).toBeInTheDocument();
    expect(screen.getByText("山田")).toBeInTheDocument();
    expect(document.querySelector(".mc-identity")).not.toBeNull();
    expect(document.querySelector(".mc-meta-grid")).not.toBeNull();
    expect(document.querySelector(".mc-resume-wrap")).not.toBeNull();
  });

  it("opens 書類出力 with Word/PDF downloads and no print button", () => {
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
            licenses: [],
            storageReady: false,
            hasPhoto: false,
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
              photo: "",
              photoAlt: "",
              postalLookupHint: "",
              postalLookingUp: "",
              postalNotFound: "",
              postalLookupFailed: "",
              postalLineRemainderHint: "",
            },
            japaneseHint: "",
            education: { empty: "", school: "", event: "", yearMonth: "" },
            licenses: { empty: "", name: "", yearMonth: "" },
            events: {
              education: {
                enrolled: "",
                graduated: "",
                withdrawn: "",
                completed: "",
              },
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
          nationality: "",
          residenceStatus: "",
          residenceUntil: "",
          salaryAnnualMan: "",
          salaryMonthlyMan: "",
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

    fireEvent.click(screen.getByRole("button", { name: /書類出力/ }));
    expect(screen.getByRole("button", { name: "docx" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "pdf" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /print|印刷/i })).toBeNull();
  });

  it("renders same-month timeline events side by side and opens work card detail", () => {
    const baseProps = {
      labels,
      profileForm: {
        initial: {
          fullName: { ja: "山田" },
          fullNameKana: "",
          birthDate: "",
          age: null,
          gender: {},
          postalCode: "",
          dateFormat: "wareki" as const,
          address: {},
          addressKana: "",
          phone: "",
          email: "",
          altContact: {},
          education: [],
          licenses: [],
          storageReady: false,
          hasPhoto: false,
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
            photo: "",
            photoAlt: "",
            postalLookupHint: "",
            postalLookingUp: "",
            postalNotFound: "",
            postalLookupFailed: "",
            postalLineRemainderHint: "",
          },
          japaneseHint: "",
          education: { empty: "", school: "", event: "", yearMonth: "" },
          licenses: { empty: "", name: "", yearMonth: "" },
          events: {
            education: {
              enrolled: "",
              graduated: "",
              withdrawn: "",
              completed: "",
            },
          },
        },
      },
      extras: {
        headline: "",
        directionTags: "",
        selfPrJa: "",
        jobSummaryJa: "",
        strengthsText: "",
        languages: [],
        nationality: "",
        residenceStatus: "",
        residenceUntil: "",
        salaryAnnualMan: "",
        salaryMonthlyMan: "",
        salaryHope: "",
        personalHopeJa: "",
      },
      employers: [
        {
          id: "emp-1",
          companyNameJa: "テスト会社",
          title: "PM",
          startYm: "2024-04",
          endYm: "",
          capitalText: "",
          revenueText: "",
          employeesText: "",
          narrativeJa: "",
        },
      ],
      projects: [
        {
          id: "proj-1",
          titleJa: "作品A",
          titleUrl: "https://example.com/a",
          startYm: "2024-04",
          endYm: "",
          overviewJa: "概要",
          phasesJa: "",
          responsibilitiesJa: "",
          resultsJa: "",
          environment: "",
          roleText: "",
          scaleText: "",
          teamSizeText: "",
          status: "confirmed" as const,
        },
      ],
      skills: [],
      goals: [],
      licenses: [{ id: "lic-1", yearMonth: "2021-12", nameJa: "N1" }],
      timeline: [
        {
          id: "a",
          kind: "work" as const,
          at: "2024年4月",
          title: "先录入",
          module: "work" as const,
          entryOrder: 1,
        },
        {
          id: "b",
          kind: "license" as const,
          at: "2024年4月",
          title: "後录入",
          module: "skills" as const,
          entryOrder: 2,
        },
      ],
      exportSnapshot: emptySnapshot,
    };

    render(<MyCareerCenter {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /タイムライン/ }));
    const cluster = document.querySelector(".mc-tl-cluster");
    expect(cluster).not.toBeNull();
    expect(cluster?.querySelectorAll(".mc-tl-item")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /スキル/ }));
    expect(screen.getByText("免許・資格")).toBeInTheDocument();
    expect(screen.getByText("N1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /職歴/ }));
    fireEvent.click(screen.getByText("テスト会社"));
    expect(screen.getByDisplayValue("テスト会社")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /プロジェクト/ }));
    const link = screen.getByRole("link", { name: "作品A" });
    fireEvent.click(link);
    expect(screen.queryByDisplayValue("作品A")).toBeNull();
    fireEvent.click(screen.getByText("概要"));
    expect(screen.getByDisplayValue("作品A")).toBeInTheDocument();
  });
});
