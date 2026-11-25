import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { NavChromeProvider } from "@/components/app-shell/nav-chrome-context";

const usePathname = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      primary: "メインナビゲーション",
      home: "ホーム",
      myCareer: "マイキャリア",
      progress: "応募進捗",
      version: "バージョン情報",
      contact: "お問い合わせ",
      settings: "設定",
      collapseNav: "閉じる",
      expandNav: "開く",
      closeNav: "メニューを閉じる",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/app/[locale]/sign-out-button", () => ({
  SignOutButton: () => <button type="button">ログアウト</button>,
}));

function renderSidebar(path: string) {
  usePathname.mockReturnValue(path);
  return render(
    <NavChromeProvider>
      <AppSidebar
        identity={{ label: "デモ", initial: "デ", hasPhoto: false }}
      />
    </NavChromeProvider>,
  );
}

describe("AppSidebar nav highlight", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/");
  });

  it("marks home active on /", () => {
    renderSidebar("/");
    expect(screen.getByRole("link", { name: "ホーム" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("link", { name: "応募進捗" })).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  it("marks My Career active on /profile", () => {
    renderSidebar("/profile");
    expect(screen.getByRole("link", { name: "マイキャリア" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("marks progress active on /progress", () => {
    const { unmount } = renderSidebar("/progress");
    expect(screen.getByRole("link", { name: "応募進捗" })).toHaveAttribute(
      "data-active",
      "true",
    );
    unmount();
  });

  it("marks progress active on interview-prep routes", () => {
    renderSidebar("/applications/app-1/interview-prep");
    expect(screen.getByRole("link", { name: "応募進捗" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });
});
