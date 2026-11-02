import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";

vi.mock("./account-status", () => ({ AccountStatus: () => null }));

describe("Home page", () => {
  it("renders the app name", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Wanora");
  });
});
