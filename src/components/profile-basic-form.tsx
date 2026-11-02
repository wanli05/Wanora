"use client";

import { useActionState, type ReactNode } from "react";
import {
  saveProfileAction,
  type ProfileSaveState,
} from "@/lib/profile-actions";

type Props = {
  saveLabel: string;
  savedMessage: string;
  errorMessages: Record<NonNullable<ProfileSaveState["error"]>, string>;
  children: ReactNode;
};

export function ProfileBasicForm({
  saveLabel,
  savedMessage,
  errorMessages,
  children,
}: Props) {
  const [state, formAction, pending] = useActionState<
    ProfileSaveState,
    FormData
  >(saveProfileAction, {});

  return (
    <form action={formAction} className="space-y-6">
      {state.ok ? (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
          role="status"
        >
          {savedMessage}
        </p>
      ) : null}
      {state.error ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {errorMessages[state.error]}
        </p>
      ) : null}
      {children}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "…" : saveLabel}
      </button>
    </form>
  );
}
