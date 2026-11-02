import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-utils/intl";
import { LocaleSwitcher } from "./locale-switcher";

const changeLocale = vi.fn();
vi.mock("@/lib/locale-actions", () => ({
  changeLocale: (l: string) => changeLocale(l),
}));

const reloadPage = vi.fn();
vi.mock("@/lib/reload", () => ({ reloadPage: () => reloadPage() }));

beforeEach(() => {
  vi.clearAllMocks();
  changeLocale.mockResolvedValue(undefined);
});

describe("LocaleSwitcher", () => {
  it("lists every language in its own name with the current one selected", () => {
    renderWithIntl(<LocaleSwitcher />, "zh-CN");
    const select = screen.getByRole("combobox", { name: "界面语言" });
    expect(select).toHaveValue("zh-CN");
    expect(
      screen.getAllByRole("option").map((o) => [o.textContent, o.getAttribute("lang")]),
    ).toEqual([
      ["日本語", "ja"],
      ["简体中文", "zh-CN"],
      ["English", "en"],
    ]);
  });

  it("saves the new language and reloads the page", async () => {
    renderWithIntl(<LocaleSwitcher />, "ja");
    fireEvent.change(screen.getByRole("combobox", { name: "表示言語" }), {
      target: { value: "en" },
    });
    await waitFor(() => expect(reloadPage).toHaveBeenCalled());
    expect(changeLocale).toHaveBeenCalledWith("en");
  });
});
