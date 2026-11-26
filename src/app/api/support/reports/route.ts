import { getDb } from "@/db";
import { getSessionUser } from "@/lib/session";
import {
  submitSupportReport,
  submitSupportReportBodySchema,
  supportRateLimitKey,
} from "@/lib/support";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = submitSupportReportBodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      {
        error: "invalid_body",
        message: "invalid body",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const user = await getSessionUser(request.headers);
  const rateLimitKey = supportRateLimitKey({
    userId: user?.id,
    request,
  });

  const result = await submitSupportReport(getDb(), {
    body: parsed.data,
    userId: user?.id ?? null,
    rateLimitKey,
  });

  if (!result.ok) {
    if (result.code === "rate_limited") {
      return Response.json(
        { error: "rate_limited", message: result.message },
        { status: 429 },
      );
    }
    if (result.code === "unavailable") {
      return Response.json(
        { error: "unavailable", message: result.message },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "invalid_body", message: result.message },
      { status: 400 },
    );
  }

  return Response.json(
    {
      acceptanceNumber: result.acceptanceNumber,
      replayed: result.replayed,
      notifyStatus: result.notifyStatus,
    },
    { status: result.replayed ? 200 : 201 },
  );
}
