import { getDb } from "@/db";
import { getProfileByUserId, setProfilePhotoKey } from "@/lib/data/profiles";
import { isObjectStorageConfigured } from "@/lib/env";
import { getSessionUser } from "@/lib/session";
import {
  deleteUserObject,
  getUserObject,
  profilePhotoKey,
  putUserObject,
} from "@/lib/storage/object-storage";

export async function GET(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const profile = await getProfileByUserId(getDb(), user.id);
  if (!profile?.photoKey) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const obj = await getUserObject(profile.photoKey);
  if (!obj) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return new Response(new Uint8Array(obj.body), {
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "private, max-age=60",
      "X-Wanora-Photo-Backend": isObjectStorageConfigured() ? "s3" : "local",
    },
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const original = form.get("original");
  const print = form.get("print");
  if (!(original instanceof Blob) || !(print instanceof Blob)) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const maxBytes = 8 * 1024 * 1024;
  if (original.size > maxBytes || print.size > maxBytes) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  const originalKey = profilePhotoKey(user.id, "original");
  const printKey = profilePhotoKey(user.id, "print");
  const originalBuffer = Buffer.from(await original.arrayBuffer());
  const printBuffer = Buffer.from(await print.arrayBuffer());

  await putUserObject(originalKey, originalBuffer, original.type || "image/jpeg");
  await putUserObject(printKey, printBuffer, "image/jpeg");
  await setProfilePhotoKey(getDb(), user.id, printKey);

  return Response.json({
    ok: true,
    key: printKey,
    backend: isObjectStorageConfigured() ? "s3" : "local",
  });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await deleteUserObject(profilePhotoKey(user.id, "original"));
    await deleteUserObject(profilePhotoKey(user.id, "print"));
  } catch {
    /* object may already be missing */
  }
  await setProfilePhotoKey(getDb(), user.id, null);
  return Response.json({ ok: true });
}
