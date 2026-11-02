"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-constants";

type Mode = "sign-in" | "sign-up";

const copy = {
  "sign-in": {
    title: "ログイン",
    submit: "ログイン",
    switchText: "アカウントをお持ちでない方",
    switchLabel: "新規登録",
    switchHref: "/sign-up",
    error: "メールアドレスまたはパスワードが正しくありません",
  },
  "sign-up": {
    title: "新規登録",
    submit: "登録する",
    switchText: "アカウントをお持ちの方",
    switchLabel: "ログイン",
    switchHref: "/sign-in",
    error: "登録できませんでした",
  },
} as const;

const EMAIL_TAKEN = "このメールアドレスは既に登録されています";

// UI copy moves to next-intl in M2; until then map Better Auth error codes here.
function errorMessage(mode: Mode, code: string | undefined): string {
  if (mode === "sign-up" && code?.startsWith("USER_ALREADY_EXISTS")) {
    return EMAIL_TAKEN;
  }
  return copy[mode].error;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const t = copy[mode];

  // Next.js keeps visited pages mounted (hidden) via <Activity>; clear
  // credentials whenever this page is hidden. Must be a stable ref, or the
  // cleanup would also run on every re-render.
  const resetWhenHidden = useCallback((form: HTMLFormElement | null) => {
    return () => {
      form?.reset();
      setError(null);
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setPending(true);
    setError(null);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({
            email,
            password,
            name: String(form.get("name")),
          })
        : await authClient.signIn.email({ email, password });
    setPending(false);
    if (error) {
      setError(errorMessage(mode, error.code));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <form
        method="post"
        onSubmit={onSubmit}
        ref={resetWhenHidden}
        className="flex flex-col gap-4"
      >
        {mode === "sign-up" && (
          <Field label="氏名" name="name" type="text" autoComplete="name" />
        )}
        <Field
          label="メールアドレス"
          name="email"
          type="email"
          autoComplete="email"
        />
        <Field
          label="パスワード"
          name="password"
          type="password"
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete={
            mode === "sign-up" ? "new-password" : "current-password"
          }
        />
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {t.submit}
        </button>
      </form>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t.switchText}{" "}
        <Link href={t.switchHref} className="underline">
          {t.switchLabel}
        </Link>
      </p>
    </main>
  );
}

function Field({
  label,
  ...input
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        required
        className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        {...input}
      />
    </label>
  );
}
