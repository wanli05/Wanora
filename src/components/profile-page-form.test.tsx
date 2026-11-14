import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProfilePageForm,
  type ProfilePageFormLabels,
  type ProfilePageInitial,
} from "./profile-page-form";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const saveFullProfileAction = vi.fn();
vi.mock("@/lib/profile-actions", () => ({
  saveFullProfileAction: (...args: unknown[]) => saveFullProfileAction(...args),
}));

vi.mock("@/components/photo-upload", () => ({
  PhotoUpload: () => null,
}));

const labels: ProfilePageFormLabels = {
  edit: "编辑",
  save: "保存",
  addRow: "添加一行",
  removeRow: "删除此行",
  savedMessage: "个人资料已保存。",
  errorMessages: {
    unauthenticated: "请重新登录后再保存。",
    fullNameRequired: "请填写姓名（日语）。",
    invalidEmail: "邮箱格式不正确。",
    invalidDateFormat: "日期格式选项无效。",
    saveFailed: "保存失败，请稍后重试。",
  },
  sections: {
    basic: "基本信息",
    education: "学历",
    licenses: "免许",
  },
  basic: {
    fullName: "姓名",
    fullNameKana: "假名",
    birthDate: "出生日期",
    ageSuffix: "24 岁",
    gender: "性别",
    postalCode: "邮编",
    dateFormat: "日期格式",
    dateFormatWareki: "和历",
    dateFormatSeireki: "公历",
    address: "住址",
    addressKana: "住址读音",
    phone: "电话",
    email: "邮箱",
    altContact: "其他联系",
    nearestStation: "最寄站",
    commuteTime: "通勤时间",
    commuteHours: "小时",
    commuteMinutes: "分",
    commuteApprox: "约",
    dependentsCount: "扶养家属数",
    dependentsUnit: "人",
    hasSpouse: "配偶",
    spouseDependent: "配偶扶养义务",
    yesNoYes: "有",
    yesNoNo: "无",
    photo: "证明写真",
    photoAlt: "证明写真预览",
    postalLookupHint: "lookup hint",
    postalLookingUp: "looking up",
    postalNotFound: "not found",
    postalLookupFailed: "lookup failed",
    postalLineRemainderHint: "add remainder",
  },
  japaneseHint: "日语",
  education: {
    empty: "暂无学历",
    school: "学校",
    event: "事项",
    yearMonth: "年月",
  },
  licenses: {
    empty: "暂无免许",
    name: "名称",
    yearMonth: "取得年月",
  },
  events: {
    education: {
      enrolled: "入学",
      graduated: "毕业",
      withdrawn: "退学",
      completed: "结业",
    },
  },
};

const initial: ProfilePageInitial = {
  fullName: { ja: "山田太郎" },
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
  nearestStation: "",
  commuteHours: "",
  commuteMinutes: "",
  dependentsCount: "",
  hasSpouse: "",
  spouseDependent: "",
  education: [],
  licenses: [],
  storageReady: false,
  hasPhoto: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  saveFullProfileAction.mockResolvedValue({ ok: true });
});

describe("ProfilePageForm edit mode", () => {
  it("does not call save when clicking 编辑 (no form submit)", async () => {
    const { container } = render(
      <ProfilePageForm initial={initial} labels={labels} />,
    );

    expect(container.querySelector("form")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    });
    expect(document.getElementById("fullName_ja")).toBeInTheDocument();
    expect(saveFullProfileAction).not.toHaveBeenCalled();
    expect(screen.queryByText("个人资料已保存。")).not.toBeInTheDocument();
  });

  it("calls save only when submitting the edit form", async () => {
    render(<ProfilePageForm initial={initial} labels={labels} />);

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(saveFullProfileAction).toHaveBeenCalledTimes(1));
  });

  it("keeps the saved banner after a successful submit", async () => {
    render(<ProfilePageForm initial={initial} labels={labels} />);

    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("个人资料已保存。");
    });
  });

  it("shows education rows in chronological order in view mode", () => {
    render(
      <ProfilePageForm
        initial={{
          ...initial,
          education: [
            {
              yearMonth: "2022-04",
              schoolJa: "後",
              eventCode: "enrolled",
            },
            {
              yearMonth: "2018-04",
              schoolJa: "先",
              eventCode: "graduated",
            },
          ],
        }}
        labels={labels}
      />,
    );

    const earlier = screen.getByText("先");
    const later = screen.getByText("後");
    expect(
      earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});