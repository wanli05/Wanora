import { Suspense } from "react";
import { AccountStatus } from "./account-status";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">Wanora</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Job application tracker for job seekers in Japan.
      </p>
      <Suspense fallback={null}>
        <AccountStatus />
      </Suspense>
    </main>
  );
}
