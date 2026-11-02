import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Activity } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const signUpEmail = vi.fn();
const signInEmail = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: (...a: unknown[]) => signUpEmail(...a) },
    signIn: { email: (...a: unknown[]) => signInEmail(...a) },
  },
}));

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthForm", () => {
  it("signs up and redirects home", async () => {
    signUpEmail.mockResolvedValue({ error: null });
    render(<AuthForm mode="sign-up" />);
    fill("氏名", "山田 太郎");
    fill("メールアドレス", "taro@example.test");
    fill("パスワード", "password123");
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(signUpEmail).toHaveBeenCalledWith({
      email: "taro@example.test",
      password: "password123",
      name: "山田 太郎",
    });
  });

  it("shows the error and stays on the page when sign-in fails", async () => {
    signInEmail.mockResolvedValue({
      error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
    });
    render(<AuthForm mode="sign-in" />);
    expect(screen.queryByLabelText("氏名")).toBeNull();
    fill("メールアドレス", "taro@example.test");
    fill("パスワード", "wrong-password");
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "メールアドレスまたはパスワードが正しくありません",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("explains when the email is already registered", async () => {
    signUpEmail.mockResolvedValue({
      error: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
    });
    render(<AuthForm mode="sign-up" />);
    fill("氏名", "山田 太郎");
    fill("メールアドレス", "taro@example.test");
    fill("パスワード", "password123");
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "このメールアドレスは既に登録されています",
    );
  });

  it("enforces the minimum password length in the input", () => {
    render(<AuthForm mode="sign-up" />);
    expect(screen.getByLabelText("パスワード")).toHaveAttribute(
      "minLength",
      "8",
    );
  });

  it("clears entered credentials when the page is hidden", () => {
    const { rerender } = render(
      <Activity mode="visible">
        <AuthForm mode="sign-in" />
      </Activity>,
    );
    fill("パスワード", "secret-password");
    rerender(
      <Activity mode="hidden">
        <AuthForm mode="sign-in" />
      </Activity>,
    );
    rerender(
      <Activity mode="visible">
        <AuthForm mode="sign-in" />
      </Activity>,
    );
    expect(screen.getByLabelText("パスワード")).toHaveValue("");
  });
});
