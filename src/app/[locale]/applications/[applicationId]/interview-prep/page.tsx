import { Suspense } from "react";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import {
  InterviewPrepPage,
  InterviewPrepUnavailable,
} from "@/components/interview-prep/interview-prep-page";
import { getDb } from "@/db";
import { loadApplicationPrep } from "@/lib/interview-prep/load-application-prep";
import { getSessionUser } from "@/lib/session";

export default function InterviewPrepRoute({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  return (
    <Suspense fallback={<InterviewPrepLoadingFallback />}>
      <InterviewPrepContent params={params} />
    </Suspense>
  );
}

async function InterviewPrepLoadingFallback() {
  const t = await getTranslations("InterviewPrep");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6 lg:max-w-6xl">
      <p className="text-sm text-zinc-500" data-testid="interview-prep-loading">
        {t("loading")}
      </p>
    </main>
  );
}

async function InterviewPrepContent({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const user = await getSessionUser(await headers());
  if (!user) {
    return <InterviewPrepUnavailable kind="signed_out" />;
  }

  const application = await loadApplicationPrep(
    getDb(),
    user.id,
    applicationId,
  );
  if (!application) {
    return <InterviewPrepUnavailable kind="not_found" />;
  }

  return <InterviewPrepPage application={application} />;
}
