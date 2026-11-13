import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PostalAddressFields } from "./postal-address-fields";

const labels = {
  postalCode: "郵便番号",
  address: "現住所",
  addressKana: "ふりがな",
  japaneseHint: "日语",
  lookupHint: "hint",
  lookingUp: "looking",
  notFound: "not found",
  lookupFailed: "failed",
  lineRemainderHint: "remainder",
};

describe("PostalAddressFields", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fills address and kana after a 7-digit postal code", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        addressJa: "埼玉県さいたま市浦和区領家",
        addressKana: "さいたまけん",
        postalCode: "330-0072",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PostalAddressFields
        labels={labels}
        initialPostalCode=""
        initialAddressJa=""
        initialAddressKana=""
        inputClass=""
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "郵便番号" }), {
      target: { value: "3300072" },
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "現住所" })).toHaveValue(
        "埼玉県さいたま市浦和区領家",
      );
    });
    expect(screen.getByRole("textbox", { name: "ふりがな" })).toHaveValue(
      "さいたまけん",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profile/postal?zip=3300072",
    );
  });

  it("shows not-found without clearing a hand-filled address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "not_found" }),
      }),
    );

    render(
      <PostalAddressFields
        labels={labels}
        initialPostalCode=""
        initialAddressJa="手入力の住所"
        initialAddressKana=""
        inputClass=""
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "郵便番号" }), {
      target: { value: "0000000" },
    });

    await waitFor(() => {
      expect(screen.getByText("not found")).toBeInTheDocument();
    });
    expect(screen.getByRole("textbox", { name: "現住所" })).toHaveValue(
      "手入力の住所",
    );
  });
});
