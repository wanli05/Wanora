import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test-utils/intl";
import Home from "./page";

describe("Home page", () => {
  it("renders the app name", () => {
    renderWithIntl(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Wanora");
  });

  it.each([
    ["ja", "日本で就職・転職活動をする人のための応募管理アプリ"],
    ["zh-CN", "为在日本求职、跳槽的人打造的投递进度管理应用"],
    ["en", "Job application tracker for job seekers in Japan"],
  ] as const)("shows the tagline in %s", (locale, tagline) => {
    renderWithIntl(<Home />, locale);
    expect(screen.getByText(tagline)).toBeInTheDocument();
  });
});
