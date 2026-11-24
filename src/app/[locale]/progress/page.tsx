import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProgressBoard } from "@/components/progress-board/progress-board";
import { getDb } from "@/db";
import { loadBoard } from "@/lib/data/applications";
import { getSessionUser } from "@/lib/session";

export default function ProgressPage() {
  return (
    <Suspense fallback={null}>
      <ProgressContent />
    </Suspense>
  );
}

async function ProgressContent() {
  const user = await getSessionUser(await headers());
  if (!user) redirect("/sign-in");
  const board = await loadBoard(getDb(), user.id);
  return (
    <main className="mx-auto flex w-full flex-1 flex-col px-3 py-4 sm:px-5">
      <ProgressBoard initial={board} />
    </main>
  );
}
