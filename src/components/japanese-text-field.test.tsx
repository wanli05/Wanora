import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JapaneseTextField } from "./japanese-text-field";

describe("JapaneseTextField", () => {
  it("renders a single Japanese input with ja suffix name", () => {
    render(
      <JapaneseTextField
        fieldPrefix="fullName"
        label="氏名"
        value={{ ja: "山田", en: "Yamada" }}
        required
        hint="日本語で入力"
      />,
    );
    const input = screen.getByDisplayValue("山田");
    expect(input).toHaveAttribute("name", "fullName_ja");
    expect(input).toHaveAttribute("id", "fullName_ja");
    expect(input).toHaveValue("山田");
    expect(screen.getByText("日本語で入力")).toBeInTheDocument();
  });
});
