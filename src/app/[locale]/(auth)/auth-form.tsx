"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { authErrorMessageKey } from "@/lib/auth-errors";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-constants";
import { applyAccountLocale } from "@/lib/locale-actions";
import { loadPage } from "@/lib/reload";

type Mode = "sign-in" | "sign-up";

const SWITCH_HREF: Record<Mode, string> = {
  "sign-in": "/sign-up",
  "sign-up": "/sign-in",
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("Auth");
  const copy = mode === "sign-up" ? "signUp" : "signIn";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
            uiLocale: locale,
          })
        : await authClient.signIn.email({ email, password });
    if (error) {
      setPending(false);
      setError(t(authErrorMessageKey(mode, error)));
      return;
    }
    if (mode === "sign-in" && (await applyAccountLocale())) {
      loadPage("/");
      return;
    }
    setPending(false);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">{t(`${copy}.title`)}</h1>
      <form
        method="post"
        onSubmit={onSubmit}
        ref={resetWhenHidden}
        className="flex flex-col gap-4"
      >
        {mode === "sign-up" && (
          <Field label={t("name")} name="name" type="text" autoComplete="name" />
        )}
        <Field
          label={t("email")}
          name="email"
          type="email"
          autoComplete="email"
        />
        <Field
          label={t("password")}
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
          {t(`${copy}.submit`)}
        </button>
      </form>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t(`${copy}.switchText`)}{" "}
        <Link href={SWITCH_HREF[mode]} className="underline">
          {t(`${copy}.switchLabel`)}
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
