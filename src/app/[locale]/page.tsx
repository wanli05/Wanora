import { Suspense } from "react";
import { headers } from "next/headers";
import { ProgressBoard } from "@/components/progress-board/progress-board";
import { getDb } from "@/db";
import { loadBoard } from "@/lib/data/applications";
import { getSessionUser } from "@/lib/session";
import { Landing } from "./landing";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const user = await getSessionUser(await headers());
  if (!user) return <Landing />;
  const board = await loadBoard(getDb(), user.id);
  return <ProgressBoard initial={board} />;
}
