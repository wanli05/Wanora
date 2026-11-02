import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocalizedTextField } from "./localized-text-field";
import { renderWithIntl } from "@/test-utils/intl";

describe("LocalizedTextField", () => {
  it("shows completion and switches locale tabs", () => {
    renderWithIntl(
      <LocalizedTextField
        fieldPrefix="fullName"
        label="氏名"
        value={{ ja: "山田", en: "Yamada" }}
      />,
      "ja",
    );
    expect(screen.getByText("2/3 言語入力済み")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /English/ }));
    expect(screen.getByDisplayValue("Yamada")).toBeInTheDocument();
  });
});
