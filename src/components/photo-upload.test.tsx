import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { PhotoUpload } from "./photo-upload";

const messages = {
  Profile: {
    photo: {
      title: "証明写真",
      hint: "hint",
      previewAlt: "alt",
      uploadError: "err",
      uploadSuccess: "ok",
      remove: "remove",
      tooLarge: "big",
      invalidType: "type",
      storageDisabled: "disabled msg",
      localBackendHint: "local hint",
    },
  },
};

function renderPhoto(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="ja" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("PhotoUpload", () => {
  it("keeps the file input enabled without S3 (local backend)", () => {
    renderPhoto(<PhotoUpload localBackend hasPhoto={false} />);
    const input = document.querySelector('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input).not.toBeDisabled();
    expect(screen.getByText("local hint")).toBeInTheDocument();
    expect(screen.queryByText("disabled msg")).not.toBeInTheDocument();
  });

  it("disables the input only when explicitly disabled", () => {
    renderPhoto(<PhotoUpload disabled hasPhoto={false} />);
    expect(document.querySelector('input[type="file"]')).toBeDisabled();
    expect(screen.getByText("disabled msg")).toBeInTheDocument();
  });
});
