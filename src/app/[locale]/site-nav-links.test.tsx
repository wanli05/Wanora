import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteNavLinks } from "./site-nav-links";

const usePathname = vi.fn(() => "/");

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

describe("SiteNavLinks", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/");
  });

  it("marks progress as active on home and never uses underline class", () => {
    render(
      <SiteNavLinks
        progressLabel="進捗ボード"
        myCareerLabel="My Career"
        ariaLabel="メインナビゲーション"
      />,
    );
    const progress = screen.getByRole("link", { name: "進捗ボード" });
    const career = screen.getByRole("link", { name: "My Career" });
    expect(progress).toHaveAttribute("data-active", "true");
    expect(career).toHaveAttribute("data-active", "false");
    expect(progress.className).not.toMatch(/underline/);
    expect(career.className).not.toMatch(/underline/);
  });

  it("marks My Career active on /profile", () => {
    usePathname.mockReturnValue("/profile");
    render(
      <SiteNavLinks
        progressLabel="進捗ボード"
        myCareerLabel="My Career"
        ariaLabel="メインナビゲーション"
      />,
    );
    expect(screen.getByRole("link", { name: "My Career" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("link", { name: "進捗ボード" })).toHaveAttribute(
      "data-active",
      "false",
    );
  });
});
