"use client";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="underline"
      onClick={async () => {
        await authClient.signOut();
        // Full reload drops all client state of the previous user, including
        // pages Next.js keeps hidden for back/forward navigation.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/";
      }}
    >
      ログアウト
    </button>
  );
}
