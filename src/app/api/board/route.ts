import { getDb } from "@/db";
import { loadBoard } from "@/lib/data/applications";
import { requireUser, unauthorized } from "./http";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return unauthorized();
  return Response.json(await loadBoard(getDb(), user.id));
}
