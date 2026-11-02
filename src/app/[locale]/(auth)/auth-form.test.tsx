import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Activity } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test-utils/intl";
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

const applyAccountLocale = vi.fn();
vi.mock("@/lib/locale-actions", () => ({
  applyAccountLocale: () => applyAccountLocale(),
}));

const loadPage = vi.fn();
vi.mock("@/lib/reload", () => ({
  loadPage: (path: string) => loadPage(path),
}));

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

beforeEach(() => {
  vi.clearAllMocks();
  applyAccountLocale.mockResolvedValue(false);
});

describe("AuthForm", () => {
  it("signs up with the current UI language and redirects home", async () => {
    signUpEmail.mockResolvedValue({ error: null });
    renderWithIntl(<AuthForm mode="sign-up" />);
    fill("氏名", "山田 太郎");
    fill("メールアドレス", "taro@example.test");
    fill("パスワード", "password123");
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(signUpEmail).toHaveBeenCalledWith({
      email: "taro@example.test",
      password: "password123",
      name: "山田 太郎",
      uiLocale: "ja",
    });
    expect(applyAccountLocale).not.toHaveBeenCalled();
  });

  it("sends the chosen language when signing up in Chinese", async () => {
    signUpEmail.mockResolvedValue({ error: null });
    renderWithIntl(<AuthForm mode="sign-up" />, "zh-CN");
    fill("姓名", "张三");
    fill("邮箱", "zhang@example.test");
    fill("密码", "password123");
    fireEvent.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() =>
      expect(signUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({ uiLocale: "zh-CN" }),
      ),
    );
  });

  it("shows the error and stays on the page when sign-in fails", async () => {
    signInEmail.mockResolvedValue({
      error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
    });
    renderWithIntl(<AuthForm mode="sign-in" />);
    expect(screen.queryByLabelText("氏名")).toBeNull();
    fill("メールアドレス", "taro@example.test");
    fill("パスワード", "wrong-password");
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "メールアドレスまたはパスワードが正しくありません",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("shows sign-in errors in English", async () => {
    signInEmail.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD" } });
    renderWithIntl(<AuthForm mode="sign-in" />, "en");
    fill("Email", "taro@example.test");
    fill("Password", "wrong-password");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect email or password",
    );
  });

  it("navigates client-side after sign-in when the language is unchanged", async () => {
    signInEmail.mockResolvedValue({ error: null });
    renderWithIntl(<AuthForm mode="sign-in" />);
    fill("メールアドレス", "taro@example.test");
    fill("パスワード", "password123");
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(loadPage).not.toHaveBeenCalled();
  });

  it("reloads into the account's language after sign-in", async () => {
    signInEmail.mockResolvedValue({ error: null });
    applyAccountLocale.mockResolvedValue(true);
    renderWithIntl(<AuthForm mode="sign-in" />);
    fill("メールアドレス", "taro@example.test");
    fill("パスワード", "password123");
    fireEvent.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => expect(loadPage).toHaveBeenCalledWith("/"));
    expect(push).not.toHaveBeenCalled();
  });

  it("explains when the email is already registered", async () => {
    signUpEmail.mockResolvedValue({
      error: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" },
    });
    renderWithIntl(<AuthForm mode="sign-up" />);
    fill("氏名", "山田 太郎");
    fill("メールアドレス", "taro@example.test");
    fill("パスワード", "password123");
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "このメールアドレスは既に登録されています",
    );
  });

  it("enforces the minimum password length in the input", () => {
    renderWithIntl(<AuthForm mode="sign-up" />);
    expect(screen.getByLabelText("パスワード")).toHaveAttribute(
      "minLength",
      "8",
    );
  });

  it("clears entered credentials when the page is hidden", () => {
    const { rerender } = renderWithIntl(
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
