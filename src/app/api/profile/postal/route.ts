import {
  normalizePostalDigits,
  parseZipcloudResponse,
  type ZipcloudResponse,
} from "@/lib/domain/postal-address";
import { getSessionUser } from "@/lib/session";

const ZIPCLOUD_URL = "https://zipcloud.ibsnet.co.jp/api/search";

export async function GET(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const zip = new URL(request.url).searchParams.get("zip");
  const digits = zip ? normalizePostalDigits(zip) : null;
  if (!digits) {
    return Response.json(
      { error: "invalid_zip", hint: "7-digit Japanese postal code required" },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${ZIPCLOUD_URL}?zipcode=${digits}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return Response.json({ error: "upstream" }, { status: 502 });
  }

  if (!upstream.ok) {
    return Response.json({ error: "upstream" }, { status: 502 });
  }

  const data = (await upstream.json()) as ZipcloudResponse;
  const parsed = parseZipcloudResponse(data);
  if (!parsed.ok) {
    const status = parsed.reason === "invalid" ? 400 : 404;
    return Response.json({ error: parsed.reason }, { status });
  }

  return Response.json({ ok: true, ...parsed.hit });
}
