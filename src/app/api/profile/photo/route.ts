import { getDb } from "@/db";
import { setProfilePhotoKey } from "@/lib/data/profiles";
import { isObjectStorageConfigured } from "@/lib/env";
import { getSessionUser } from "@/lib/session";
import {
  profilePhotoKey,
  putUserObject,
} from "@/lib/storage/object-storage";

export async function POST(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isObjectStorageConfigured()) {
    return Response.json({ error: "storage_disabled" }, { status: 503 });
  }

  const form = await request.formData();
  const original = form.get("original");
  const print = form.get("print");
  if (!(original instanceof Blob) || !(print instanceof Blob)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const originalKey = profilePhotoKey(user.id, "original");
  const printKey = profilePhotoKey(user.id, "print");
  const originalBuffer = Buffer.from(await original.arrayBuffer());
  const printBuffer = Buffer.from(await print.arrayBuffer());

  await putUserObject(originalKey, originalBuffer, original.type || "image/jpeg");
  await putUserObject(printKey, printBuffer, "image/jpeg");
  await setProfilePhotoKey(getDb(), user.id, printKey);

  return Response.json({ ok: true, key: printKey });
}
