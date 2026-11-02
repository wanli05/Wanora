import { z } from "zod";
import { getDb } from "@/db";
import { updateUiLocale } from "@/lib/data/users";
import { localeSchema } from "@/lib/locale";
import { getSessionUser } from "@/lib/session";

const unauthorized = () =>
  Response.json({ error: "unauthorized" }, { status: 401 });

export async function GET(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) return unauthorized();
  return Response.json(user);
}

const patchSchema = z.object({ uiLocale: localeSchema }).strict();

export async function PATCH(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) return unauthorized();

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  await updateUiLocale(getDb(), user.id, parsed.data.uiLocale);
  return Response.json({ ...user, uiLocale: parsed.data.uiLocale });
}
